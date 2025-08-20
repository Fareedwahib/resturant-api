import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment, PaymentWebhook } from './entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { User } from '../auth/entities/user.entity';
import { MailService } from '../services/mail.service';
import { PaymentListener } from '../listeners/payment.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentWebhook, Order, User])
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService, 
    MailService, 
    PaymentListener  // Add the payment listener
  ],
  exports: [PaymentService, TypeOrmModule],
})
export class PaymentModule {}