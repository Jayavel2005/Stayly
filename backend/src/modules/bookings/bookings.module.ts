import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { HotelsModule } from '../hotels/hotels.module';
import { AvailabilityModule } from '../availability/availability.module';
import { ResourceOwnershipService } from '../../common/authorization/resource-ownership.service';

@Module({
  imports: [HotelsModule, AvailabilityModule],
  controllers: [BookingsController],
  providers: [BookingsService, ResourceOwnershipService],
  exports: [BookingsService],
})
export class BookingsModule {}
