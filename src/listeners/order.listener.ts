import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from '../services/mail.service';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderStatusUpdatedEvent } from '../events/order-status-updated.event';
import { OrderCancelledEvent } from '../events/order-cancelled.event';
import { OrderPaymentUpdatedEvent } from '../events/order-payment-updated.event';

@Injectable()
export class OrderListener {
  private readonly logger = new Logger(OrderListener.name);

  constructor(private readonly mailService: MailService) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(`Handling order created event - Order: ${event.orderNumber}`);
    
    try {
      await this.mailService.sendOrderConfirmationEmail(
        event.customerEmail,
        {
          orderNumber: event.orderNumber,
          customerName: event.customerName,
          items: event.items,
          totalAmount: event.totalAmount,
          deliveryAddress: event.deliveryAddress,
          paymentMethod: event.paymentMethod,
        }
      );
      
      this.logger.log(`Order confirmation email sent to ${event.customerEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send order confirmation email:`, error);
    }
  }

  @OnEvent('order.status-updated')
  async handleOrderStatusUpdated(event: OrderStatusUpdatedEvent) {
    this.logger.log(
      `Handling order status update - Order: ${event.orderNumber}, Status: ${event.oldStatus} → ${event.newStatus}`
    );
    
    try {
      await this.mailService.sendOrderStatusUpdateEmail(
        event.customerEmail,
        {
          orderNumber: event.orderNumber,
          customerName: event.customerName,
          oldStatus: event.oldStatus,
          newStatus: event.newStatus,
          deliveryStaffName: event.deliveryStaffName,
          estimatedDeliveryTime: event.estimatedDeliveryTime,
          actualDeliveryTime: event.actualDeliveryTime,
        }
      );
      
      this.logger.log(`Order status update email sent to ${event.customerEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send order status update email:`, error);
    }
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(event: OrderCancelledEvent) {
    this.logger.log(`Handling order cancellation - Order: ${event.orderNumber}`);
    
    try {
      await this.mailService.sendOrderCancellationEmail(
        event.customerEmail,
        {
          orderNumber: event.orderNumber,
          customerName: event.customerName,
          reason: event.reason,
        }
      );
      
      this.logger.log(`Order cancellation email sent to ${event.customerEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send order cancellation email:`, error);
    }
  }

  @OnEvent('order.payment-updated')
  async handleOrderPaymentUpdated(event: OrderPaymentUpdatedEvent) {
    this.logger.log(
      `Handling payment update - Order: ${event.orderNumber}, Status: ${event.paymentStatus}`
    );
    
    try {
      if (event.paymentStatus === 'paid') {
        await this.mailService.sendPaymentConfirmationEmail(
          event.customerId,
          {
              orderNumber: event.orderNumber,
              totalAmount: event.totalAmount,
              paymentMethod: event.paymentMethod,
              transactionId: event.transactionId,
              customerName: ''
          }
        );
      } else if (event.paymentStatus === 'failed') {
        await this.mailService.sendPaymentFailedEmail(
          event.customerId,
          {
              orderNumber: event.orderNumber,
              totalAmount: event.totalAmount,
              customerName: ''
          }
        );
      }
      
      this.logger.log(`Payment update email sent for order ${event.orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send payment update email:`, error);
    }
  }
}