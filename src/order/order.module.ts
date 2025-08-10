import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order, OrderItem } from './entities/order.entity';
import { User } from '../auth/entities/user.entity';
import { Menue } from '../menue/entities/menue.entity';
import { MailService } from '../services/mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User, Menue])
  ],
  controllers: [OrderController],
  providers: [OrderService, MailService],
  exports: [OrderService, TypeOrmModule],
})
export class OrderModule {}