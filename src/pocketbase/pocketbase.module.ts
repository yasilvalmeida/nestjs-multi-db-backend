import { Module, Global } from '@nestjs/common';
import { PocketBaseService } from './pocketbase.service';

@Global()
@Module({
  providers: [PocketBaseService],
  exports: [PocketBaseService],
})
export class PocketBaseModule {}
