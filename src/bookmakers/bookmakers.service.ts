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

  async getAustralianBookmakerOdds(
    sport: string = 'football',
  ): Promise<Map<string, BookmakerOdds[]>> {
    const results = new Map<string, BookmakerOdds[]>();
    const australianBookmakers = this.bookmakerConfigs.filter(
      (config) => config.enabled && ['sportsbet', 'tab'].includes(config.name),
    );

    this.logger.log(
      `Fetching odds from ${australianBookmakers.length} Australian bookmakers for ${sport}`,
    );

    // Fetch odds from Australian bookmakers in parallel
    const promises = australianBookmakers.map(async (config) => {
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

  async getAggregatedAustralianOdds(sport: string = 'football'): Promise<any> {
    const oddsMap = await this.getAustralianBookmakerOdds(sport);

    // Convert to array format for aggregation
    const allOdds: BookmakerOdds[] = [];
    oddsMap.forEach((odds) => {
      allOdds.push(...odds);
    });

    // Group by event and market
    const eventGroups = this.groupOddsByEventAndMarket(allOdds);

    // Calculate aggregated statistics
    const aggregatedData = this.calculateAggregatedStats(eventGroups);

    return {
      timestamp: new Date(),
      sport,
      totalBookmakers: oddsMap.size,
      totalMarkets: allOdds.length,
      bookmakers: Object.fromEntries(oddsMap),
      aggregated: aggregatedData,
      summary: {
        availableEvents: Object.keys(eventGroups).length,
        avgOddsVariance: this.calculateAverageVariance(eventGroups),
        bestOddsOpportunities: this.findBestOdds(eventGroups),
      },
    };
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
      // Australian Bookmakers
      {
        name: 'sportsbet',
        baseUrl: 'https://api.sportsbet.com.au',
        rateLimit: 100,
        enabled: true,
        endpoints: {
          sports: '/racing/sport-categories',
          events: '/racing/events',
          odds: '/racing/live-odds',
        },
      },
      {
        name: 'tab',
        baseUrl: 'https://api.tab.com.au',
        rateLimit: 80,
        enabled: true,
        endpoints: {
          sports: '/v1/sports',
          events: '/v1/tab-info-service/sports/events',
          odds: '/v1/tab-info-service/sports/events/odds',
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
      let mockOdds: any[];

      // Different mock data for Australian bookmakers
      if (['sportsbet', 'tab'].includes(config.name)) {
        mockOdds = [
          {
            event: 'Sydney FC vs Melbourne City',
            market: '1X2',
            selections: [
              {
                name: 'Sydney FC',
                odds: config.name === 'sportsbet' ? 2.3 : 2.4,
              },
              { name: 'Draw', odds: config.name === 'sportsbet' ? 3.1 : 3.0 },
              {
                name: 'Melbourne City',
                odds: config.name === 'sportsbet' ? 2.9 : 2.8,
              },
            ],
          },
          {
            event: 'Brisbane Roar vs Perth Glory',
            market: '1X2',
            selections: [
              {
                name: 'Brisbane Roar',
                odds: config.name === 'sportsbet' ? 1.9 : 1.95,
              },
              { name: 'Draw', odds: config.name === 'sportsbet' ? 3.4 : 3.3 },
              {
                name: 'Perth Glory',
                odds: config.name === 'sportsbet' ? 4.1 : 4.0,
              },
            ],
          },
          {
            event: 'Western Sydney vs Adelaide United',
            market: '1X2',
            selections: [
              {
                name: 'Western Sydney',
                odds: config.name === 'sportsbet' ? 2.6 : 2.7,
              },
              { name: 'Draw', odds: config.name === 'sportsbet' ? 3.2 : 3.15 },
              {
                name: 'Adelaide United',
                odds: config.name === 'sportsbet' ? 2.5 : 2.45,
              },
            ],
          },
        ];
      } else {
        // Standard international bookmaker mock data
        mockOdds = [
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
      }

      // Simulate some delay and potential failure
      await new Promise((resolve) =>
        setTimeout(resolve, 200 + Math.random() * 300),
      );

      if (Math.random() < 0.05) {
        // 5% chance of failure (reduced for better demo)
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

  private groupOddsByEventAndMarket(
    odds: BookmakerOdds[],
  ): Record<string, Record<string, BookmakerOdds[]>> {
    const groups: Record<string, Record<string, BookmakerOdds[]>> = {};

    odds.forEach((odd) => {
      const eventKey = odd.event;
      const marketKey = `${odd.market}_${odd.selection}`;

      if (!groups[eventKey]) {
        groups[eventKey] = {};
      }
      if (!groups[eventKey][marketKey]) {
        groups[eventKey][marketKey] = [];
      }
      groups[eventKey][marketKey].push(odd);
    });

    return groups;
  }

  private calculateAggregatedStats(
    eventGroups: Record<string, Record<string, BookmakerOdds[]>>,
  ): any {
    const aggregated: Record<string, any> = {};

    Object.entries(eventGroups).forEach(([event, markets]) => {
      aggregated[event] = {};

      Object.entries(markets).forEach(([marketKey, odds]) => {
        const oddsValues = odds.map((o) => o.odds);

        aggregated[event][marketKey] = {
          selection: odds[0]?.selection,
          market: odds[0]?.market,
          bookmakers: odds.map((o) => ({
            name: o.bookmaker,
            odds: o.odds,
            confidence: o.confidence,
            timestamp: o.timestamp,
          })),
          stats: {
            min: Math.min(...oddsValues),
            max: Math.max(...oddsValues),
            avg: oddsValues.reduce((a, b) => a + b, 0) / oddsValues.length,
            variance: this.calculateVariance(oddsValues),
            count: oddsValues.length,
          },
          bestOdds: {
            bookmaker: odds.find((o) => o.odds === Math.max(...oddsValues))
              ?.bookmaker,
            odds: Math.max(...oddsValues),
          },
        };
      });
    });

    return aggregated;
  }

  private calculateAverageVariance(
    eventGroups: Record<string, Record<string, BookmakerOdds[]>>,
  ): number {
    const variances: number[] = [];

    Object.values(eventGroups).forEach((markets) => {
      Object.values(markets).forEach((odds) => {
        const oddsValues = odds.map((o) => o.odds);
        if (oddsValues.length > 1) {
          variances.push(this.calculateVariance(oddsValues));
        }
      });
    });

    return variances.length > 0
      ? variances.reduce((a, b) => a + b, 0) / variances.length
      : 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length <= 1) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private findBestOdds(
    eventGroups: Record<string, Record<string, BookmakerOdds[]>>,
  ): any[] {
    const bestOdds: any[] = [];

    Object.entries(eventGroups).forEach(([event, markets]) => {
      Object.entries(markets).forEach(([marketKey, odds]) => {
        const maxOdds = Math.max(...odds.map((o) => o.odds));
        const bestOdd = odds.find((o) => o.odds === maxOdds);

        if (bestOdd) {
          bestOdds.push({
            event,
            market: bestOdd.market,
            selection: bestOdd.selection,
            bookmaker: bestOdd.bookmaker,
            odds: bestOdd.odds,
            advantage: maxOdds - Math.min(...odds.map((o) => o.odds)),
          });
        }
      });
    });

    return bestOdds.sort((a, b) => b.advantage - a.advantage).slice(0, 10); // Top 10 best odds opportunities
  }
}
