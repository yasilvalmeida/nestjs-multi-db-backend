import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { firstValueFrom, retry, catchError, timer } from 'rxjs';
import { throwError } from 'rxjs';

export interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
}

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);
  private readonly baseUrl: string;
  private readonly retryAttempts: number;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private cacheService: CacheService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'EXTERNAL_API_BASE_URL',
      'https://jsonplaceholder.typicode.com',
    );
    this.retryAttempts = parseInt(
      this.configService.get<string>('EXTERNAL_API_RETRY_ATTEMPTS', '3'),
    );
  }

  async getPosts(useCache: boolean = true): Promise<Post[]> {
    const cacheKey = 'api:posts';

    if (useCache) {
      const cached = await this.cacheService.get<Post[]>(cacheKey);
      if (cached) {
        this.logger.debug('Posts retrieved from cache');
        return cached;
      }
    }

    try {
      this.logger.log('Fetching posts from external API');

      const response = await firstValueFrom(
        this.httpService.get<Post[]>(`${this.baseUrl}/posts`).pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(
                `Retry attempt ${retryCount} for getPosts: ${errorMessage}`,
              );
              return timer(1000 * Math.pow(2, retryCount - 1)); // Exponential backoff
            },
          }),
          catchError((error) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              'Failed to fetch posts after retries:',
              errorMessage,
            );
            return throwError(
              () =>
                new HttpException(
                  'External API unavailable',
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            );
          }),
        ),
      );

      const posts = response.data;

      if (useCache) {
        await this.cacheService.set(cacheKey, posts, 300); // Cache for 5 minutes
      }

      this.logger.log(`Successfully fetched ${posts.length} posts`);
      return posts;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error fetching posts:', errorMessage);
      throw error;
    }
  }

  async getPost(id: number): Promise<Post> {
    const cacheKey = `api:post:${id}`;

    const cached = await this.cacheService.get<Post>(cacheKey);
    if (cached) {
      this.logger.debug(`Post ${id} retrieved from cache`);
      return cached;
    }

    try {
      this.logger.log(`Fetching post ${id} from external API`);

      const response = await firstValueFrom(
        this.httpService.get<Post>(`${this.baseUrl}/posts/${id}`).pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(
                `Retry attempt ${retryCount} for getPost ${id}: ${errorMessage}`,
              );
              return timer(1000 * Math.pow(2, retryCount - 1));
            },
          }),
          catchError((error) => {
            if (error.response?.status === 404) {
              return throwError(
                () => new HttpException('Post not found', HttpStatus.NOT_FOUND),
              );
            }
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `Failed to fetch post ${id} after retries:`,
              errorMessage,
            );
            return throwError(
              () =>
                new HttpException(
                  'External API unavailable',
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            );
          }),
        ),
      );

      const post = response.data;
      await this.cacheService.set(cacheKey, post, 600); // Cache for 10 minutes

      this.logger.log(`Successfully fetched post ${id}`);
      return post;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching post ${id}:`, errorMessage);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    const cacheKey = 'api:users';

    const cached = await this.cacheService.get<User[]>(cacheKey);
    if (cached) {
      this.logger.debug('Users retrieved from cache');
      return cached;
    }

    try {
      this.logger.log('Fetching users from external API');

      const response = await firstValueFrom(
        this.httpService.get<User[]>(`${this.baseUrl}/users`).pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(
                `Retry attempt ${retryCount} for getUsers: ${errorMessage}`,
              );
              return timer(1000 * Math.pow(2, retryCount - 1));
            },
          }),
          catchError((error) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              'Failed to fetch users after retries:',
              errorMessage,
            );
            return throwError(
              () =>
                new HttpException(
                  'External API unavailable',
                  HttpStatus.SERVICE_UNAVAILABLE,
                ),
            );
          }),
        ),
      );

      const users = response.data;
      await this.cacheService.set(cacheKey, users, 600); // Cache for 10 minutes

      this.logger.log(`Successfully fetched ${users.length} users`);
      return users;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error fetching users:', errorMessage);
      throw error;
    }
  }

  // Mock data methods
  getMockPosts(): Post[] {
    this.logger.log('Returning mock posts data');
    return [
      {
        userId: 1,
        id: 1,
        title: 'Mock Post 1',
        body: 'This is a mock post for testing purposes.',
      },
      {
        userId: 1,
        id: 2,
        title: 'Mock Post 2',
        body: 'Another mock post with sample content.',
      },
      {
        userId: 2,
        id: 3,
        title: 'Mock Post 3',
        body: 'Third mock post for demonstration.',
      },
    ];
  }

  getMockUsers(): User[] {
    this.logger.log('Returning mock users data');
    return [
      {
        id: 1,
        name: 'John Doe',
        username: 'johndoe',
        email: 'john@example.com',
        phone: '555-0123',
        website: 'john.example.com',
      },
      {
        id: 2,
        name: 'Jane Smith',
        username: 'janesmith',
        email: 'jane@example.com',
        phone: '555-0456',
        website: 'jane.example.com',
      },
    ];
  }
}
