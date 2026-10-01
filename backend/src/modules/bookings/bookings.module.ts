import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { HotelsModule } from '../hotels/hotels.module';
import { AvailabilityModule } from '../availability/availability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResourceOwnershipService } from '../../common/authorization/resource-ownership.service';

@Module({
  imports: [HotelsModule, AvailabilityModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingLifecycleService, ResourceOwnershipService],
  exports: [BookingsService, BookingLifecycleService],
})
export class BookingsModule {}
