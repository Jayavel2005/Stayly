import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { RealtimeModule } from '../../infrastructure/realtime/realtime.module';

@Module({
  imports: [PrismaModule, RedisModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
