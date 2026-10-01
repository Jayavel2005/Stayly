import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { RoomTypesModule } from './modules/room-types/room-types.module';
import { RoomsModule } from './modules/rooms/rooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    HotelsModule,
    RoomTypesModule,
    RoomsModule,
  ],
})
export class AppModule {}
