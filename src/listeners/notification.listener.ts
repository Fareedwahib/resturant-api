import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/entities/user.entity';
import { MailService } from '../services/mail.service';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderStatusUpdatedEvent } from '../events/order-status-updated.event';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  @OnEvent('order.created')
  async notifyStaffOfNewOrder(event: OrderCreatedEvent) {
    this.logger.log(`Notifying staff of new order: ${event.orderNumber}`);
    
    try {
      // Get all admin and staff users
      const staffUsers = await this.userRepository.find({
        where: [
          { role: UserRole.ADMIN },
          { role: UserRole.STAFF }
        ],
        select: ['id', 'email', 'name']
      });

      // Send notification to all staff
      for (const staff of staffUsers) {
        await this.mailService.sendNewOrderNotificationToStaff(
          staff.email,
          {
            staffName: staff.name,
            orderNumber: event.orderNumber,
            customerName: event.customerName,
            totalAmount: event.totalAmount,
            itemsCount: event.items.length,
          }
        );
      }
      
      this.logger.log(`New order notifications sent to ${staffUsers.length} staff members`);
    } catch (error) {
      this.logger.error(`Failed to send new order notifications:`, error);
    }
  }

  @OnEvent('order.status-updated')
  async notifyDeliveryStaffOfAssignment(event: OrderStatusUpdatedEvent) {
    if (event.newStatus === 'out_for_delivery' && event.deliveryStaffId) {
      this.logger.log(
        `Notifying delivery staff of order assignment: ${event.orderNumber}`
      );
      
      try {
        const deliveryStaff = await this.userRepository.findOne({
          where: { id: event.deliveryStaffId },
          select: ['id', 'email', 'name']
        });

        if (deliveryStaff) {
          await this.mailService.sendDeliveryAssignmentNotification(
            deliveryStaff.email,
            {
              deliveryStaffName: deliveryStaff.name,
              orderNumber: event.orderNumber,
              customerName: event.customerName,
              deliveryAddress: 'Address from order', // You might need to pass this in the event
              estimatedDeliveryTime: event.estimatedDeliveryTime,
            }
          );
        }
        
        this.logger.log(`Delivery assignment notification sent to ${deliveryStaff?.email}`);
      } catch (error) {
        this.logger.error(`Failed to send delivery assignment notification:`, error);
      }
    }
  }
}