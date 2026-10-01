import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentGateway } from './gateways/mock-payment.gateway';
import { PAYMENT_GATEWAY } from './gateways/payment-gateway.interface';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResourceOwnershipService } from '../../common/authorization/resource-ownership.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
    ResourceOwnershipService,
  ],
  exports: [PaymentsService, PAYMENT_GATEWAY],
})
export class PaymentsModule {}
