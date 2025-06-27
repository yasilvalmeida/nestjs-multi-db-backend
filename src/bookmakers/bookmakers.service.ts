import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CacheService } from '../cache/cache.service';
import { OpenAIService } from '../openai/openai.service';
import {
  PocketBaseService,
  BookmakerData,
} from '../pocketbase/pocketbase.service';
import { firstValueFrom, retry, catchError, timer } from 'rxjs';
import { throwError } from 'rxjs';

export interface BookmakerOdds {
  bookmaker: string;
  normalizedBookmaker: string;
  sport: string;
  event: string;
  market: string;
  selection: string;
  odds: number;
  timestamp: Date;
  confidence: number;
}

export interface BookmakerConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimit: number; // requests per minute
  enabled: boolean;
  endpoints: {
    sports: string;
    events: string;
    odds: string;
  };
}

@Injectable()
export class BookmakersService {
  private readonly logger = new Logger(BookmakersService.name);
  private readonly bookmakerConfigs: BookmakerConfig[];
  private readonly rateLimitTracker = new Map<string, number[]>();

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private cacheService: CacheService,
    private openaiService: OpenAIService,
    private pocketbaseService: PocketBaseService,
  ) {
    this.bookmakerConfigs = this.loadBookmakerConfigs();
    this.logger.log(
      `Initialized ${this.bookmakerConfigs.length} bookmaker configurations`,
    );
  }

  async integrateBookmaker(
    bookmakerName: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Starting integration for bookmaker: ${bookmakerName}`);

    try {
      // 1. Normalize the bookmaker name using OpenAI
      const normalizationResult =
        await this.openaiService.normalizeBookmakerName({
          originalName: bookmakerName,
          context: 'Sports betting integration',
          category: 'Bookmaker',
        });

      this.logger.log(
        `Normalized "${bookmakerName}" to "${normalizationResult.normalizedName}" (confidence: ${normalizationResult.confidence})`,
      );

      // 2. Save bookmaker data to PocketBase
      const bookmakerData: BookmakerData = {
        name: bookmakerName,
        normalizedName: normalizationResult.normalizedName,
        confidence: normalizationResult.confidence,
        status: 'active',
        lastSeen: new Date(),
        metadata: {
          reasoning: normalizationResult.reasoning,
          suggestions: normalizationResult.suggestions,
        },
      };

      await this.pocketbaseService.saveBookmaker(bookmakerData);

      // 3. Test connection and fetch sample data
      const testResult = await this.testBookmakerConnection(bookmakerName);

      return {
        success: true,
        message: `Successfully integrated ${normalizationResult.normalizedName}. ${testResult.message}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to integrate bookmaker ${bookmakerName}: ${errorMessage}`,
      );
      return {
        success: false,
        message: `Integration failed: ${errorMessage}`,
      };
    }
  }

  async fetchOddsFromBookmaker(
    bookmakerName: string,
    sport: string = 'football',
  ): Promise<BookmakerOdds[]> {
    const cacheKey = `odds:${bookmakerName}:${sport}`;

    // Check cache first
    const cachedOdds = await this.cacheService.get<BookmakerOdds[]>(cacheKey);
    if (cachedOdds) {
      this.logger.debug(`Retrieved cached odds for ${bookmakerName}`);
      return cachedOdds;
    }

    const config = this.getBookmakerConfig(bookmakerName);
    if (!config) {
      this.logger.warn(
        `No configuration found for bookmaker: ${bookmakerName}`,
      );
      return [];
    }

    if (!this.checkRateLimit(bookmakerName)) {
      this.logger.warn(`Rate limit exceeded for bookmaker: ${bookmakerName}`);
      return [];
    }

    try {
      // Normalize bookmaker name
      const normalizationResult =
        await this.openaiService.normalizeBookmakerName({
          originalName: bookmakerName,
          context: 'Odds fetching',
        });

      const odds = await this.fetchOddsFromAPI(config, sport);

      // Process and normalize the odds data
      const processedOdds = await this.processOddsData(
        odds,
        normalizationResult.normalizedName,
      );

      // Cache the results
      await this.cacheService.set(cacheKey, processedOdds, 300); // 5 minutes cache

      // Update bookmaker status in PocketBase
      const bookmakers = await this.pocketbaseService.getBookmakers(
        `name = "${bookmakerName}"`,
      );
      if (bookmakers.length > 0) {
        await this.pocketbaseService.updateBookmaker(bookmakers[0].id!, {
          lastSeen: new Date(),
          status: 'active',
        });
      }

      this.logger.log(
        `Fetched ${processedOdds.length} odds from ${normalizationResult.normalizedName}`,
      );
      return processedOdds;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error fetching odds from ${bookmakerName}: ${errorMessage}`,
      );
      return [];
    }
  }

  async getAllBookmakerOdds(
    sport: string = 'football',
  ): Promise<Map<string, BookmakerOdds[]>> {
    const results = new Map<string, BookmakerOdds[]>();
    const enabledBookmakers = this.bookmakerConfigs.filter(
      (config) => config.enabled,
    );

    this.logger.log(
      `Fetching odds from ${enabledBookmakers.length} bookmakers for ${sport}`,
    );

    // Fetch odds from all bookmakers in parallel (with rate limiting)
    const promises = enabledBookmakers.map(async (config) => {
      try {
        const odds = await this.fetchOddsFromBookmaker(config.name, sport);
        results.set(config.name, odds);
      } catch (error) {
        this.logger.error(`Failed to fetch from ${config.name}: ${error}`);
        results.set(config.name, []);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  async getBookmakerStats(): Promise<any> {
    const stats: {
      totalBookmakers: number;
      enabledBookmakers: number;
      rateLimitStatus: Record<string, any>;
      recentActivity: any[];
      normalizationStats: any;
      pocketbaseStats: any;
    } = {
      totalBookmakers: this.bookmakerConfigs.length,
      enabledBookmakers: this.bookmakerConfigs.filter((c) => c.enabled).length,
      rateLimitStatus: {},
      recentActivity: [],
      normalizationStats: await this.openaiService.getUsageStats(),
      pocketbaseStats: {
        adminUrl: await this.pocketbaseService.getAdminDashboardUrl(),
        bookmakers: await this.pocketbaseService.getBookmakers(),
      },
    };

    // Get rate limit status for each bookmaker
    for (const config of this.bookmakerConfigs) {
      const requests = this.rateLimitTracker.get(config.name) || [];
      const recentRequests = requests.filter(
        (time) => Date.now() - time < 60000,
      );
      stats.rateLimitStatus[config.name] = {
        requestsLastMinute: recentRequests.length,
        limit: config.rateLimit,
        available: Math.max(0, config.rateLimit - recentRequests.length),
      };
    }

    return stats;
  }

  private loadBookmakerConfigs(): BookmakerConfig[] {
    // In a real implementation, these would come from database/config files
    return [
      {
        name: 'bet365',
        baseUrl: 'https://api.bet365.com',
        rateLimit: 60,
        enabled: true,
        endpoints: {
          sports: '/sports',
          events: '/events',
          odds: '/odds',
        },
      },
      {
        name: 'william_hill',
        baseUrl: 'https://api.williamhill.com',
        rateLimit: 30,
        enabled: true,
        endpoints: {
          sports: '/sports',
          events: '/events',
          odds: '/odds',
        },
      },
      {
        name: 'betfair',
        baseUrl: 'https://api.betfair.com',
        rateLimit: 120,
        enabled: true,
        endpoints: {
          sports: '/betting/v1/listEventTypes',
          events: '/betting/v1/listEvents',
          odds: '/betting/v1/listMarketBook',
        },
      },
      {
        name: 'paddy_power',
        baseUrl: 'https://api.paddypower.com',
        rateLimit: 45,
        enabled: true,
        endpoints: {
          sports: '/sports',
          events: '/events',
          odds: '/odds',
        },
      },
    ];
  }

  private getBookmakerConfig(name: string): BookmakerConfig | null {
    return (
      this.bookmakerConfigs.find(
        (config) =>
          config.name.toLowerCase() === name.toLowerCase() ||
          config.name.replace('_', ' ').toLowerCase() === name.toLowerCase(),
      ) || null
    );
  }

  private checkRateLimit(bookmakerName: string): boolean {
    const config = this.getBookmakerConfig(bookmakerName);
    if (!config) return false;

    const now = Date.now();
    const requests = this.rateLimitTracker.get(bookmakerName) || [];

    // Remove requests older than 1 minute
    const recentRequests = requests.filter((time) => now - time < 60000);

    if (recentRequests.length >= config.rateLimit) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.rateLimitTracker.set(bookmakerName, recentRequests);

    return true;
  }

  private async testBookmakerConnection(
    bookmakerName: string,
  ): Promise<{ success: boolean; message: string }> {
    const config = this.getBookmakerConfig(bookmakerName);
    if (!config) {
      return { success: false, message: 'No configuration found' };
    }

    try {
      // For demo purposes, we'll just test a basic connection
      // In reality, this would make an actual API call
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate API call

      return {
        success: true,
        message: `Connection test successful. Rate limit: ${config.rateLimit} req/min`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  private async fetchOddsFromAPI(
    config: BookmakerConfig,
    sport: string,
  ): Promise<any[]> {
    try {
      // For demo purposes, return mock data
      // In reality, this would make actual API calls to the bookmaker
      const mockOdds = [
        {
          event: 'Manchester United vs Chelsea',
          market: '1X2',
          selections: [
            { name: 'Manchester United', odds: 2.5 },
            { name: 'Draw', odds: 3.2 },
            { name: 'Chelsea', odds: 2.8 },
          ],
        },
        {
          event: 'Liverpool vs Arsenal',
          market: '1X2',
          selections: [
            { name: 'Liverpool', odds: 1.85 },
            { name: 'Draw', odds: 3.5 },
            { name: 'Arsenal', odds: 4.2 },
          ],
        },
      ];

      // Simulate some delay and potential failure
      await new Promise((resolve) =>
        setTimeout(resolve, 200 + Math.random() * 300),
      );

      if (Math.random() < 0.1) {
        // 10% chance of failure
        throw new Error('API temporarily unavailable');
      }

      return mockOdds;
    } catch (error) {
      throw error;
    }
  }

  private async processOddsData(
    rawOdds: any[],
    normalizedBookmaker: string,
  ): Promise<BookmakerOdds[]> {
    const processedOdds: BookmakerOdds[] = [];

    for (const eventData of rawOdds) {
      for (const selection of eventData.selections) {
        // Normalize player/team names using OpenAI
        const normalizedSelection =
          await this.openaiService.normalizePlayerName(selection.name);

        processedOdds.push({
          bookmaker: normalizedBookmaker,
          normalizedBookmaker,
          sport: 'football',
          event: eventData.event,
          market: eventData.market,
          selection: normalizedSelection.normalizedName,
          odds: selection.odds,
          timestamp: new Date(),
          confidence: normalizedSelection.confidence,
        });
      }
    }

    return processedOdds;
  }
}
