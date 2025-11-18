import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from '../services/mail.service';
import { PaymentCreatedEvent } from '../events/payment-created.event';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { PaymentCancelledEvent } from '../events/payment-cancelled.event';
import { PaymentRefundedEvent } from '../events/payment-refunded.event';

@Injectable()
export class PaymentListener {
  private readonly logger = new Logger(PaymentListener.name);

  constructor(private readonly mailService: MailService) {}

  @OnEvent('payment.created')
  async handlePaymentCreated(event: PaymentCreatedEvent) {
    try {
      this.logger.log(
        `Processing payment created event: ${event.paymentReference}`,
      );
      this.logger.log(
        `Payment created: ${event.paymentReference} for order ${event.orderNumber} by ${event.customerName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process payment created event: ${event.paymentReference}`,
        error,
      );
    }
  }

  @OnEvent('payment.completed')
  async handlePaymentCompleted(event: PaymentCompletedEvent) {
    try {
      this.logger.log(
        `Processing payment completed event: ${event.paymentReference}`,
      );
      await this.mailService.sendPaymentConfirmationEmail(event.customerEmail, {
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        totalAmount: event.amount,
        paymentMethod: event.paymentMethod,
        transactionId: event.transactionId,
      });

      this.logger.log(
        `Payment confirmation email sent for payment ${event.paymentReference} to ${event.customerEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment confirmation email for payment ${event.paymentReference}`,
        error,
      );
    }
  }

  @OnEvent('payment.failed')
  async handlePaymentFailed(event: PaymentFailedEvent) {
    try {
      this.logger.log(
        `Processing payment failed event: ${event.paymentReference}`,
      );
      await this.mailService.sendPaymentFailedEmail(event.customerEmail, {
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        totalAmount: event.amount,
      });

      this.logger.log(
        `Payment failed email sent for payment ${event.paymentReference} to ${event.customerEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment failed email for payment ${event.paymentReference}`,
        error,
      );
    }
  }

  @OnEvent('payment.cancelled')
  async handlePaymentCancelled(event: PaymentCancelledEvent) {
    try {
      this.logger.log(
        `Processing payment cancelled event: ${event.paymentReference}`,
      );
      await this.mailService.sendPaymentCancelledEmail(event.customerEmail, {
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        paymentReference: event.paymentReference,
        amount: event.amount,
        reason: event.reason,
      });

      this.logger.log(
        `Payment cancellation email sent for payment ${event.paymentReference} to ${event.customerEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment cancellation email for payment ${event.paymentReference}`,
        error,
      );
    }
  }

  @OnEvent('payment.refunded')
  async handlePaymentRefunded(event: PaymentRefundedEvent) {
    try {
      this.logger.log(
        `Processing payment refunded event: ${event.paymentReference}`,
      );
      await this.mailService.sendPaymentRefundEmail(event.customerEmail, {
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        paymentReference: event.paymentReference,
        originalAmount: event.originalAmount,
        refundAmount: event.refundAmount,
        totalRefunded: event.totalRefunded,
        isFullyRefunded: event.isFullyRefunded,
        reason: event.reason,
      });

      this.logger.log(
        `Payment refund email sent for payment ${event.paymentReference} to ${event.customerEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send payment refund email for payment ${event.paymentReference}`,
        error,
      );
    }
  }
}
