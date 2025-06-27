import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, body, query, params } = request;
    const userAgent = request.get('User-Agent') || '';
    const ip = request.ip;

    const now = Date.now();

    this.logger.log(
      `📥 ${method} ${url} - ${ip} - ${userAgent} - Body: ${JSON.stringify(
        body
      )} - Query: ${JSON.stringify(query)} - Params: ${JSON.stringify(params)}`
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const delay = Date.now() - now;
          this.logger.log(
            `📤 ${method} ${url} - ${
              response.statusCode
            } - ${delay}ms - Response: ${JSON.stringify(data)}`
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `❌ ${method} ${url} - ${response.statusCode} - ${delay}ms - Error: ${error.message}`,
            error.stack
          );
        },
      })
    );
  }
}
