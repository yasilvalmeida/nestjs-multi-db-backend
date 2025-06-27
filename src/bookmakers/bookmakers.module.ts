import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BookmakersService } from './bookmakers.service';
import { BookmakersController } from './bookmakers.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  providers: [BookmakersService],
  controllers: [BookmakersController],
  exports: [BookmakersService],
})
export class BookmakersModule {}
