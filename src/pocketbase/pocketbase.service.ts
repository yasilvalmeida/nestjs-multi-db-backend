import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BookmakerData {
  id?: string;
  name: string;
  normalizedName: string;
  confidence: number;
  status: 'active' | 'inactive';
  lastSeen: Date;
  metadata?: Record<string, any>;
}

export interface PlayerData {
  id?: string;
  name: string;
  normalizedName: string;
  sport: string;
  team?: string;
  position?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PocketBaseService implements OnModuleInit {
  private readonly logger = new Logger(PocketBaseService.name);
  private pb: any;
  private readonly isEnabled: boolean;
  private readonly pocketbaseUrl: string | undefined;

  constructor(private configService: ConfigService) {
    this.pocketbaseUrl = this.configService.get<string>('POCKETBASE_URL');
    this.isEnabled = !!this.pocketbaseUrl;

    if (this.isEnabled) {
      this.logger.log(
        `PocketBase service will be initialized with URL: ${this.pocketbaseUrl}`,
      );
    } else {
      this.logger.warn(
        'PocketBase URL not provided. Service will be disabled.',
      );
    }
  }

  async onModuleInit() {
    if (!this.isEnabled || !this.pocketbaseUrl) return;

    try {
      // Dynamically import PocketBase
      const { default: PocketBase } = await import('pocketbase');
      this.pb = new PocketBase(this.pocketbaseUrl);
      this.logger.log(
        `PocketBase client initialized with URL: ${this.pocketbaseUrl}`,
      );

      // Try to authenticate with admin credentials if provided
      const adminEmail = this.configService.get<string>(
        'POCKETBASE_ADMIN_EMAIL',
      );
      const adminPassword = this.configService.get<string>(
        'POCKETBASE_ADMIN_PASSWORD',
      );

      if (adminEmail && adminPassword) {
        await this.pb.admins.authWithPassword(adminEmail, adminPassword);
        this.logger.log('PocketBase admin authentication successful');
      }

      // Initialize collections if they don't exist
      await this.initializeCollections();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PocketBase initialization error: ${errorMessage}`);
    }
  }

  private isPocketBaseReady(): boolean {
    return this.isEnabled && this.pb;
  }

  async saveBookmaker(data: BookmakerData): Promise<BookmakerData | null> {
    if (!this.isPocketBaseReady()) {
      this.logger.warn('PocketBase not ready or not configured');
      return null;
    }

    try {
      const record = await this.pb.collection('bookmakers').create({
        name: data.name,
        normalizedName: data.normalizedName,
        confidence: data.confidence,
        status: data.status,
        lastSeen: data.lastSeen.toISOString(),
        metadata: data.metadata || {},
      });

      this.logger.debug(`Bookmaker saved to PocketBase: ${data.name}`);
      return this.mapBookmakerRecord(record);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error saving bookmaker to PocketBase: ${errorMessage}`,
      );
      return null;
    }
  }

  async getBookmakers(filter?: string): Promise<BookmakerData[]> {
    if (!this.isPocketBaseReady()) return [];

    try {
      const records = await this.pb.collection('bookmakers').getFullList({
        filter: filter || '',
        sort: '-lastSeen',
      });

      return records.map((record: any) => this.mapBookmakerRecord(record));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error fetching bookmakers from PocketBase: ${errorMessage}`,
      );
      return [];
    }
  }

  async updateBookmaker(
    id: string,
    data: Partial<BookmakerData>,
  ): Promise<BookmakerData | null> {
    if (!this.isPocketBaseReady()) return null;

    try {
      const updateData: any = { ...data };
      if (data.lastSeen) {
        updateData.lastSeen = data.lastSeen.toISOString();
      }

      const record = await this.pb
        .collection('bookmakers')
        .update(id, updateData);
      return this.mapBookmakerRecord(record);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error updating bookmaker in PocketBase: ${errorMessage}`,
      );
      return null;
    }
  }

  async savePlayer(data: PlayerData): Promise<PlayerData | null> {
    if (!this.isPocketBaseReady()) return null;

    try {
      const record = await this.pb.collection('players').create({
        name: data.name,
        normalizedName: data.normalizedName,
        sport: data.sport,
        team: data.team || '',
        position: data.position || '',
        metadata: data.metadata || {},
      });

      this.logger.debug(`Player saved to PocketBase: ${data.name}`);
      return this.mapPlayerRecord(record);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error saving player to PocketBase: ${errorMessage}`);
      return null;
    }
  }

  async getPlayers(sport?: string): Promise<PlayerData[]> {
    if (!this.isPocketBaseReady()) return [];

    try {
      const filter = sport ? `sport = "${sport}"` : '';
      const records = await this.pb.collection('players').getFullList({
        filter,
        sort: 'name',
      });

      return records.map((record: any) => this.mapPlayerRecord(record));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error fetching players from PocketBase: ${errorMessage}`,
      );
      return [];
    }
  }

  async getAdminDashboardUrl(): Promise<string | null> {
    if (!this.isPocketBaseReady()) return null;

    const baseUrl = this.configService.get<string>('POCKETBASE_URL');
    return `${baseUrl}/_/`;
  }

  private async initializeCollections(): Promise<void> {
    try {
      // Create bookmakers collection schema
      const bookmakerSchema = {
        name: 'bookmakers',
        type: 'base',
        schema: [
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'normalizedName',
            type: 'text',
            required: true,
          },
          {
            name: 'confidence',
            type: 'number',
            required: true,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            options: {
              values: ['active', 'inactive'],
            },
          },
          {
            name: 'lastSeen',
            type: 'date',
            required: true,
          },
          {
            name: 'metadata',
            type: 'json',
            required: false,
          },
        ],
      };

      // Create players collection schema
      const playerSchema = {
        name: 'players',
        type: 'base',
        schema: [
          {
            name: 'name',
            type: 'text',
            required: true,
          },
          {
            name: 'normalizedName',
            type: 'text',
            required: true,
          },
          {
            name: 'sport',
            type: 'text',
            required: true,
          },
          {
            name: 'team',
            type: 'text',
            required: false,
          },
          {
            name: 'position',
            type: 'text',
            required: false,
          },
          {
            name: 'metadata',
            type: 'json',
            required: false,
          },
        ],
      };

      // Note: In a real implementation, you'd need to use PocketBase admin API
      // to create collections programmatically
      this.logger.log('Collection schemas ready for initialization');
    } catch (error) {
      this.logger.warn(
        'Could not initialize collections automatically. Please create them manually in PocketBase admin.',
      );
    }
  }

  private mapBookmakerRecord(record: any): BookmakerData {
    return {
      id: record.id,
      name: record.name,
      normalizedName: record.normalizedName,
      confidence: record.confidence,
      status: record.status,
      lastSeen: new Date(record.lastSeen),
      metadata: record.metadata || {},
    };
  }

  private mapPlayerRecord(record: any): PlayerData {
    return {
      id: record.id,
      name: record.name,
      normalizedName: record.normalizedName,
      sport: record.sport,
      team: record.team,
      position: record.position,
      metadata: record.metadata || {},
    };
  }
}
