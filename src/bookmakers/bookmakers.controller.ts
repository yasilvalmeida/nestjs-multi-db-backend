import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BookmakersService } from './bookmakers.service';

@ApiTags('bookmakers')
@Controller('bookmakers')
@UseGuards(ThrottlerGuard)
export class BookmakersController {
  private readonly logger = new Logger(BookmakersController.name);

  constructor(private readonly bookmakersService: BookmakersService) {}

  @Post('integrate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Integrate a new bookmaker into the pipeline' })
  @ApiResponse({
    status: 201,
    description: 'Bookmaker successfully integrated',
  })
  @ApiResponse({ status: 400, description: 'Integration failed' })
  async integrateBookmaker(@Body() body: { bookmakerName: string }) {
    this.logger.log(`Integration request for: ${body.bookmakerName}`);
    return await this.bookmakersService.integrateBookmaker(body.bookmakerName);
  }

  @Get('odds')
  @ApiOperation({ summary: 'Fetch odds from a specific bookmaker' })
  @ApiResponse({ status: 200, description: 'Odds retrieved successfully' })
  async getOdds(
    @Query('bookmaker') bookmaker: string,
    @Query('sport') sport: string = 'football',
  ) {
    this.logger.log(`Fetching odds for ${bookmaker} - ${sport}`);
    return await this.bookmakersService.fetchOddsFromBookmaker(
      bookmaker,
      sport,
    );
  }

  @Get('odds/all')
  @ApiOperation({ summary: 'Fetch odds from all integrated bookmakers' })
  @ApiResponse({ status: 200, description: 'All odds retrieved successfully' })
  async getAllOdds(@Query('sport') sport: string = 'football') {
    this.logger.log(`Fetching all odds for ${sport}`);
    const oddsMap = await this.bookmakersService.getAllBookmakerOdds(sport);

    // Convert Map to object for JSON response
    const result: Record<string, any> = {};
    oddsMap.forEach((odds, bookmaker) => {
      result[bookmaker] = odds;
    });

    return result;
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bookmaker integration statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStats() {
    this.logger.log('Fetching bookmaker statistics');
    return await this.bookmakersService.getBookmakerStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check health of bookmaker integrations' })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  async healthCheck() {
    const stats = await this.bookmakersService.getBookmakerStats();

    return {
      status: 'healthy',
      timestamp: new Date(),
      bookmakers: {
        total: stats.totalBookmakers,
        enabled: stats.enabledBookmakers,
        rateLimits: stats.rateLimitStatus,
      },
      services: {
        openai: stats.normalizationStats,
        pocketbase: {
          configured: !!stats.pocketbaseStats.adminUrl,
          bookmakers: stats.pocketbaseStats.bookmakers.length,
        },
      },
    };
  }
}
