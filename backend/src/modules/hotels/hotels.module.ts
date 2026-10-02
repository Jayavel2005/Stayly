import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { HotelAuthorizationService } from './authorization/hotel-authorization.service';

@Module({
  controllers: [HotelsController],
  providers: [HotelsService, HotelAuthorizationService],
  exports: [HotelsService, HotelAuthorizationService],
})
export class HotelsModule {}
