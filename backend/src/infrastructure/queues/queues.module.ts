import { Module, Global, forwardRef } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CleanupProcessor } from './processors/cleanup.processor';
import { BookingsModule } from '../../modules/bookings/bookings.module';

@Global()
@Module({
  imports: [forwardRef(() => BookingsModule)],
  providers: [QueueService, CleanupProcessor],
  exports: [QueueService],
})
export class QueuesModule {}
