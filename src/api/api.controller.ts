import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ApiService } from './api.service';

@ApiTags('External API')
@Controller('')
@UseGuards(ThrottlerGuard)
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('posts')
  @Public()
  @ApiOperation({ summary: 'Get all posts from external API' })
  @ApiQuery({
    name: 'cache',
    required: false,
    type: Boolean,
    description: 'Use cache for faster response',
  })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  @ApiResponse({ status: 503, description: 'External API unavailable' })
  async getPosts(
    @Query('cache', new DefaultValuePipe(true), ParseBoolPipe)
    useCache: boolean,
  ) {
    return this.apiService.getPosts(useCache);
  }

  @Get('posts/:id')
  @Public()
  @ApiOperation({ summary: 'Get a specific post by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  @ApiResponse({ status: 503, description: 'External API unavailable' })
  async getPost(@Param('id', ParseIntPipe) id: number) {
    return this.apiService.getPost(id);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all users from external API' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'External API unavailable' })
  async getUsers() {
    return this.apiService.getUsers();
  }

  @Get('mock/posts')
  @Public()
  @ApiOperation({ summary: 'Get mock posts data' })
  @ApiResponse({
    status: 200,
    description: 'Mock posts retrieved successfully',
  })
  getMockPosts() {
    return this.apiService.getMockPosts();
  }

  @Get('mock/users')
  @Public()
  @ApiOperation({ summary: 'Get mock users data' })
  @ApiResponse({
    status: 200,
    description: 'Mock users retrieved successfully',
  })
  getMockUsers() {
    return this.apiService.getMockUsers();
  }
}
