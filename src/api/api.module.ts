import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiService } from './api.service';
import { ApiController } from './api.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000'),
      maxRedirects: 5,
    }),
  ],
  providers: [ApiService],
  controllers: [ApiController],
  exports: [ApiService],
})
export class ApiModule {}
