import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { HotelsModule } from '../hotels/hotels.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [HotelsModule, NotificationsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
