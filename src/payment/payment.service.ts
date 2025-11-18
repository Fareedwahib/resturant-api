import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  MobileMoneyProvider,
  PaymentWebhook,
} from './entities/payment.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { MobileMoneyPaymentDto } from './dto/mobile-money-payment.dto';
import { MailService } from '../services/mail.service';
import { PaymentCreatedEvent } from '../events/payment-created.event';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { PaymentCancelledEvent } from '../events/payment-cancelled.event';
import { PaymentRefundedEvent } from '../events/payment-refunded.event';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentWebhook)
    private webhookRepository: Repository<PaymentWebhook>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private mailService: MailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
    userId: string,
  ): Promise<Payment> {
    // Validating order exists and belongs to user or user has permission
    const order = await this.orderRepository.findOne({
      where: { id: createPaymentDto.orderId },
      relations: ['customer'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'], // Add select for event data
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get customer info for event
    const customer = await this.userRepository.findOne({
      where: { id: order.customerId },
      select: ['id', 'name', 'email'],
    });

    // Check permissions
    if (
      order.customerId !== userId &&
      ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)
    ) {
      throw new ForbiddenException(
        'You can only create payments for your own orders',
      );
    }

    // Check if order is in valid state for payment
    if ([OrderStatus.CANCELLED, OrderStatus.DELIVERED].includes(order.status)) {
      throw new BadRequestException(
        'Cannot create payment for this order status',
      );
    }

    // Check if payment already exists for this order (any active payment)
    const existingPayment = await this.paymentRepository.findOne({
      where: {
        orderId: createPaymentDto.orderId,
        status: In([
          PaymentStatus.COMPLETED,
          PaymentStatus.PENDING,
          PaymentStatus.PROCESSING,
        ]),
      },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          'Order has already been paid successfully',
        );
      } else if (existingPayment.status === PaymentStatus.PENDING) {
        throw new BadRequestException(
          'A payment for this order is already pending. Please complete or cancel the existing payment first.',
        );
      } else if (existingPayment.status === PaymentStatus.PROCESSING) {
        throw new BadRequestException(
          'A payment for this order is currently being processed. Please wait for it to complete.',
        );
      }
    }

    // Convert both amounts to numbers and round to 2 decimal places for comparison
    const paymentAmount = Number(Number(createPaymentDto.amount).toFixed(2));
    const orderTotal = Number(Number(order.totalAmount).toFixed(2));

    // Use a tolerance for floating point comparison (1 cent tolerance)
    const tolerance = 0.01;
    if (Math.abs(paymentAmount - orderTotal) > tolerance) {
      throw new BadRequestException(
        `Payment amount (${paymentAmount}) must match order total (${orderTotal}). Difference: ${Math.abs(paymentAmount - orderTotal)}`,
      );
    }

    const paymentReference = await this.generatePaymentReference();

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      userId,
      paymentReference,
      currency: 'UGX',
      description:
        createPaymentDto.description ||
        `Payment for order ${order.orderNumber}`,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Emitting payment created event
    if (customer) {
      this.eventEmitter.emit(
        'payment.created',
        new PaymentCreatedEvent(
          savedPayment.id,
          savedPayment.paymentReference,
          order.id,
          order.orderNumber,
          customer.id,
          customer.email,
          customer.name,
          savedPayment.amount,
          savedPayment.paymentMethod,
          savedPayment.status,
        ),
      );
    }

    this.logger.log(
      `Payment created: ${savedPayment.paymentReference} for order ${order.orderNumber}`,
    );

    // Processing payment based on method
    switch (createPaymentDto.paymentMethod) {
      case PaymentMethod.MOBILE_MONEY:
        return await this.processMobileMoneyPayment(savedPayment);
      case PaymentMethod.CARD:
        return await this.processCardPayment(savedPayment);
      case PaymentMethod.CASH_ON_DELIVERY:
        return await this.processCashOnDeliveryPayment(savedPayment);
      default:
        throw new BadRequestException('Unsupported payment method');
    }
  }

  async processMobileMoneyPayment(payment: Payment): Promise<Payment> {
    try {
      payment.status = PaymentStatus.PROCESSING;
      await this.paymentRepository.save(payment);

      // Here you would integrate with actual mobile money APIs
      // For now, we'll simulate the process
      const result = await this.simulateMobileMoneyTransaction(payment);

      if (result.success) {
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        payment.gatewayTransactionId = result.transactionId;
        payment.gatewayResponse = JSON.stringify(result);

        // Updating order payment status
        await this.updateOrderPaymentStatus(
          payment.orderId,
          PaymentStatus.COMPLETED,
        );

        // Emit payment completed event
        await this.emitPaymentCompletedEvent(payment);
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.failedAt = new Date();
        payment.gatewayResponse = JSON.stringify(result);

        // Emit payment failed event
        await this.emitPaymentFailedEvent(payment, result.error);
      }

      const updatedPayment = await this.paymentRepository.save(payment);

      // Send notification
      await this.sendPaymentNotification(updatedPayment);

      return updatedPayment;
    } catch (error) {
      this.logger.error('Mobile money payment processing failed:', error);
      payment.status = PaymentStatus.FAILED;
      payment.failedAt = new Date();
      payment.gatewayResponse = JSON.stringify({ error: error.message });

      // Emit payment failed event
      await this.emitPaymentFailedEvent(payment, error.message);

      return await this.paymentRepository.save(payment);
    }
  }

  async processCardPayment(payment: Payment): Promise<Payment> {
    try {
      payment.status = PaymentStatus.PROCESSING;
      await this.paymentRepository.save(payment);

      // Here you would integrate with card payment gateways (Stripe, Flutterwave, etc.)
      const result = await this.simulateCardTransaction(payment);

      if (result.success) {
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        payment.gatewayTransactionId = result.transactionId;
        payment.gatewayReference = result.reference;
        payment.gatewayResponse = JSON.stringify(result);

        await this.updateOrderPaymentStatus(
          payment.orderId,
          PaymentStatus.COMPLETED,
        );

        // Emit payment completed event
        await this.emitPaymentCompletedEvent(payment);
      } else {
        payment.status = PaymentStatus.FAILED;
        payment.failedAt = new Date();
        payment.gatewayResponse = JSON.stringify(result);

        // Emit payment failed event
        await this.emitPaymentFailedEvent(payment, result.error);
      }

      const updatedPayment = await this.paymentRepository.save(payment);
      await this.sendPaymentNotification(updatedPayment);

      return updatedPayment;
    } catch (error) {
      this.logger.error('Card payment processing failed:', error);
      payment.status = PaymentStatus.FAILED;
      payment.failedAt = new Date();

      // Emit payment failed event
      await this.emitPaymentFailedEvent(payment, error.message);

      return await this.paymentRepository.save(payment);
    }
  }

  async processCashOnDeliveryPayment(payment: Payment): Promise<Payment> {
    // Cash on delivery payments are marked as pending until delivery confirmation
    payment.status = PaymentStatus.PENDING;
    payment.description = 'Cash payment to be collected on delivery';
    return await this.paymentRepository.save(payment);
  }

  async confirmCashPayment(
    paymentId: string,
    staffId: string,
  ): Promise<Payment> {
    const staff = await this.userRepository.findOne({
      where: { id: staffId },
      select: ['id', 'name', 'email', 'role'],
    });
    if (
      !staff ||
      ![UserRole.ADMIN, UserRole.STAFF, UserRole.DELIVERY_STAFF].includes(
        staff.role,
      )
    ) {
      throw new ForbiddenException('Only staff can confirm cash payments');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY) {
      throw new BadRequestException(
        'This endpoint is only for cash on delivery payments',
      );
    }

    payment.status = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    payment.gatewayResponse = JSON.stringify({ confirmedBy: staffId });

    await this.updateOrderPaymentStatus(
      payment.orderId,
      PaymentStatus.COMPLETED,
    );

    // Emit payment completed event
    await this.emitPaymentCompletedEvent(payment, staffId);

    return await this.paymentRepository.save(payment);
  }

  // Keep all your existing methods (findAll, findOne, etc.) unchanged...
  async findAll(queryDto: PaymentQueryDto = {}): Promise<Payment[]> {
    const where: any = {};

    if (queryDto.status) where.status = queryDto.status;
    if (queryDto.paymentMethod) where.paymentMethod = queryDto.paymentMethod;
    if (queryDto.userId) where.userId = queryDto.userId;
    if (queryDto.orderId) where.orderId = queryDto.orderId;
    if (queryDto.paymentReference)
      where.paymentReference = queryDto.paymentReference;

    if (queryDto.startDate && queryDto.endDate) {
      where.createdAt = Between(
        new Date(queryDto.startDate),
        new Date(queryDto.endDate),
      );
    }

    return await this.paymentRepository.find({
      where,
      relations: ['order', 'user'],
      order: { createdAt: 'DESC' },
      select: {
        user: { id: true, name: true, email: true },
        order: { id: true, orderNumber: true, totalAmount: true },
      },
    });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order', 'user'],
      select: {
        user: { id: true, name: true, email: true },
        order: { id: true, orderNumber: true, totalAmount: true, status: true },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByReference(paymentReference: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { paymentReference },
      relations: ['order', 'user'],
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment with reference ${paymentReference} not found`,
      );
    }

    return payment;
  }

  async findUserPayments(userId: string): Promise<Payment[]> {
    return await this.paymentRepository.find({
      where: { userId },
      relations: ['order'],
      order: { createdAt: 'DESC' },
      select: {
        order: { id: true, orderNumber: true, totalAmount: true, status: true },
      },
    });
  }

  async refundPayment(
    paymentId: string,
    refundDto: RefundPaymentDto,
    adminId: string,
  ): Promise<Payment> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      select: ['id', 'name', 'email', 'role'],
    });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can process refunds');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    const totalRefunded = payment.refundedAmount + refundDto.amount;
    if (totalRefunded > payment.amount) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    // Process refund through payment gateway
    const refundResult = await this.processRefund(payment, refundDto.amount);

    if (refundResult.success) {
      const oldStatus = payment.status;
      payment.refundedAmount = totalRefunded;
      payment.refundedAt = new Date();

      if (totalRefunded === payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }

      payment.gatewayResponse = JSON.stringify({
        ...JSON.parse(payment.gatewayResponse || '{}'),
        refund: refundResult,
      });

      // Update order status if fully refunded
      if (payment.status === PaymentStatus.REFUNDED) {
        await this.orderRepository.update(
          { id: payment.orderId },
          { status: OrderStatus.CANCELLED },
        );
      }

      // Emit payment refunded event
      await this.emitPaymentRefundedEvent(
        payment,
        refundDto.amount,
        refundDto.reason ?? 'No reason provided',
        adminId,
      );
    }

    return await this.paymentRepository.save(payment);
  }

  async getPaymentStatistics(adminId: string) {
    const admin = await this.userRepository.findOne({ where: { id: adminId } });
    if (!admin || ![UserRole.ADMIN, UserRole.STAFF].includes(admin.role)) {
      throw new ForbiddenException('Access denied');
    }

    const totalPayments = await this.paymentRepository.count();
    const completedPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.COMPLETED },
    });
    const failedPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.FAILED },
    });
    const pendingPayments = await this.paymentRepository.count({
      where: { status: PaymentStatus.PENDING },
    });

    const totalRevenue = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    const totalRefunded = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.refundedAmount)', 'total')
      .getRawOne();

    // Payment method breakdown
    const paymentMethodStats = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.paymentMethod', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .groupBy('payment.paymentMethod')
      .getRawMany();

    return {
      totalPayments,
      completedPayments,
      failedPayments,
      pendingPayments,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
      totalRefunded: parseFloat(totalRefunded?.total || '0'),
      paymentMethodBreakdown: paymentMethodStats,
    };
  }

  async handleWebhook(
    provider: string,
    payload: any,
    signature?: string,
  ): Promise<void> {
    try {
      // Save webhook for audit trail
      const webhook = this.webhookRepository.create({
        provider,
        eventType: payload.event_type || payload.type || 'unknown',
        payload: JSON.stringify(payload),
        paymentReference: payload.payment_reference || payload.reference,
      });

      await this.webhookRepository.save(webhook);

      // Verify webhook signature (implement based on your payment provider)
      if (!this.verifyWebhookSignature(provider, payload, signature)) {
        this.logger.warn(`Invalid webhook signature from ${provider}`);
        return;
      }

      // Process webhook based on provider
      await this.processWebhookEvent(provider, payload, webhook.id);

      // Mark webhook as processed
      await this.webhookRepository.update(webhook.id, { processed: true });
    } catch (error) {
      this.logger.error(`Webhook processing failed for ${provider}:`, error);
      throw new InternalServerErrorException('Webhook processing failed');
    }
  }

  private async processWebhookEvent(
    provider: string,
    payload: any,
    webhookId: string,
  ): Promise<void> {
    const paymentReference = payload.payment_reference || payload.reference;

    if (!paymentReference) {
      this.logger.warn('No payment reference in webhook payload');
      return;
    }

    const payment = await this.paymentRepository.findOne({
      where: { paymentReference },
      relations: ['order'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for reference: ${paymentReference}`);
      return;
    }

    switch (payload.event_type || payload.type) {
      case 'payment.successful':
      case 'charge.success':
        await this.handleSuccessfulPayment(payment, payload);
        break;
      case 'payment.failed':
      case 'charge.failed':
        await this.handleFailedPayment(payment, payload);
        break;
      default:
        this.logger.log(
          `Unhandled webhook event: ${payload.event_type || payload.type}`,
        );
    }
  }

  private async handleSuccessfulPayment(
    payment: Payment,
    payload: any,
  ): Promise<void> {
    payment.status = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    payment.gatewayTransactionId = payload.transaction_id || payload.id;
    payment.gatewayResponse = JSON.stringify(payload);

    await this.paymentRepository.save(payment);
    await this.updateOrderPaymentStatus(
      payment.orderId,
      PaymentStatus.COMPLETED,
    );

    // Emit payment completed event
    await this.emitPaymentCompletedEvent(payment);

    await this.sendPaymentNotification(payment);
  }

  private async handleFailedPayment(
    payment: Payment,
    payload: any,
  ): Promise<void> {
    payment.status = PaymentStatus.FAILED;
    payment.failedAt = new Date();
    payment.gatewayResponse = JSON.stringify(payload);

    await this.paymentRepository.save(payment);

    // Emit payment failed event
    await this.emitPaymentFailedEvent(
      payment,
      payload.error || 'Payment failed via webhook',
    );

    await this.sendPaymentNotification(payment);
  }

  private async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (order) {
      if (paymentStatus === PaymentStatus.COMPLETED) {
        order.status = OrderStatus.CONFIRMED;
      }
      await this.orderRepository.save(order);
    }
  }

  async getPaymentByOrder(orderId: string, userId: string): Promise<Payment[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (
      order.customerId !== userId &&
      ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)
    ) {
      throw new ForbiddenException(
        'You can only view payments for your own orders',
      );
    }

    return await this.paymentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderPaymentStatus(
    orderId: string,
    userId: string,
  ): Promise<{
    hasActivePayment: boolean;
    paymentStatus?: PaymentStatus;
    paymentId?: string;
    canCreateNewPayment: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check permissions
    if (
      order.customerId !== userId &&
      ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)
    ) {
      throw new ForbiddenException(
        'You can only check payment status for your own orders',
      );
    }

    const activePayment = await this.paymentRepository.findOne({
      where: {
        orderId,
        status: In([
          PaymentStatus.COMPLETED,
          PaymentStatus.PENDING,
          PaymentStatus.PROCESSING,
        ]),
      },
      order: { createdAt: 'DESC' },
    });

    if (activePayment) {
      return {
        hasActivePayment: true,
        paymentStatus: activePayment.status,
        paymentId: activePayment.id,
        canCreateNewPayment: false,
      };
    }

    return {
      hasActivePayment: false,
      canCreateNewPayment: true,
    };
  }

  async cancelPendingPayment(
    paymentId: string,
    userId: string,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check permissions
    if (
      payment.userId !== userId &&
      ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)
    ) {
      throw new ForbiddenException('You can only cancel your own payments');
    }

    // Only allow cancellation of pending or processing payments
    if (
      ![PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(
        payment.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot cancel payment with status: ${payment.status}`,
      );
    }

    payment.status = PaymentStatus.CANCELLED;
    payment.gatewayResponse = JSON.stringify({
      ...JSON.parse(payment.gatewayResponse || '{}'),
      cancellation: {
        reason: reason || 'Cancelled by user',
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
    });

    const updatedPayment = await this.paymentRepository.save(payment);

    // Emit payment cancelled event
    await this.emitPaymentCancelledEvent(
      updatedPayment,
      reason ?? 'Cancelled by user',
      userId,
    );

    this.logger.log(
      `Payment ${payment.paymentReference} cancelled by user ${userId}`,
    );

    return updatedPayment;
  }

  private async emitPaymentCompletedEvent(
    payment: Payment,
    confirmedBy?: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
      });
      const customer = await this.userRepository.findOne({
        where: { id: payment.userId },
        select: ['id', 'name', 'email'],
      });

      if (customer && order) {
        this.eventEmitter.emit(
          'payment.completed',
          new PaymentCompletedEvent(
            payment.id,
            payment.paymentReference,
            order.id,
            order.orderNumber,
            customer.id,
            customer.email,
            customer.name,
            payment.amount,
            payment.paymentMethod,
            payment.gatewayTransactionId,
            confirmedBy,
          ),
        );
      }
    } catch (error) {
      this.logger.error('Failed to emit payment completed event:', error);
    }
  }

  private async emitPaymentFailedEvent(
    payment: Payment,
    errorMessage: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
      });
      const customer = await this.userRepository.findOne({
        where: { id: payment.userId },
        select: ['id', 'name', 'email'],
      });

      if (customer && order) {
        this.eventEmitter.emit(
          'payment.failed',
          new PaymentFailedEvent(
            payment.id,
            payment.paymentReference,
            order.id,
            order.orderNumber,
            customer.id,
            customer.email,
            customer.name,
            payment.amount,
            payment.paymentMethod,
            errorMessage,
          ),
        );
      }
    } catch (error) {
      this.logger.error('Failed to emit payment failed event:', error);
    }
  }

  private async emitPaymentCancelledEvent(
    payment: Payment,
    reason: string,
    cancelledBy: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
      });
      const customer = await this.userRepository.findOne({
        where: { id: payment.userId },
        select: ['id', 'name', 'email'],
      });

      if (customer && order) {
        this.eventEmitter.emit(
          'payment.cancelled',
          new PaymentCancelledEvent(
            payment.id,
            payment.paymentReference,
            order.id,
            order.orderNumber,
            customer.id,
            customer.email,
            customer.name,
            payment.amount,
            payment.paymentMethod,
            reason,
            cancelledBy,
          ),
        );
      }
    } catch (error) {
      this.logger.error('Failed to emit payment cancelled event:', error);
    }
  }

  private async emitPaymentRefundedEvent(
    payment: Payment,
    refundAmount: number,
    reason: string,
    adminId: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
      });
      const customer = await this.userRepository.findOne({
        where: { id: payment.userId },
        select: ['id', 'name', 'email'],
      });

      if (customer && order) {
        this.eventEmitter.emit(
          'payment.refunded',
          new PaymentRefundedEvent(
            payment.id,
            payment.paymentReference,
            order.id,
            order.orderNumber,
            customer.id,
            customer.email,
            customer.name,
            payment.amount,
            refundAmount,
            payment.refundedAmount,
            payment.status === PaymentStatus.REFUNDED,
            reason,
            adminId,
          ),
        );
      }
    } catch (error) {
      this.logger.error('Failed to emit payment refunded event:', error);
    }
  }

  // Keep all your existing private methods unchanged...
  private async generatePaymentReference(): Promise<string> {
    const prefix = 'PAY';
    const timestamp = Date.now().toString().slice(-8);
    let reference: string;
    let attempts = 0;

    do {
      const randomSuffix = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      reference = `${prefix}${timestamp}${randomSuffix}`;
      attempts++;

      const existing = await this.paymentRepository.findOne({
        where: { paymentReference: reference },
      });

      if (!existing) break;

      if (attempts > 10) {
        throw new InternalServerErrorException(
          'Failed to generate unique payment reference',
        );
      }
    } while (true);

    return reference;
  }

  private async simulateMobileMoneyTransaction(payment: Payment): Promise<any> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate 90% success rate
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        transactionId: `MM${Date.now()}${Math.floor(Math.random() * 1000)}`,
        message: 'Payment successful',
        provider: payment.mobileMoneyProvider,
        phoneNumber: payment.mobileMoneyNumber,
      };
    } else {
      return {
        success: false,
        error: 'Insufficient funds or payment declined',
        provider: payment.mobileMoneyProvider,
      };
    }
  }

  private async simulateCardTransaction(payment: Payment): Promise<any> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate 95% success rate for cards
    const success = Math.random() > 0.05;

    if (success) {
      return {
        success: true,
        transactionId: `CARD${Date.now()}${Math.floor(Math.random() * 1000)}`,
        reference: `REF${Date.now()}`,
        message: 'Card payment successful',
        last4: '****1234',
      };
    } else {
      return {
        success: false,
        error: 'Card declined or insufficient funds',
      };
    }
  }

  private async processRefund(payment: Payment, amount: number): Promise<any> {
    // Simulate refund processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate 98% success rate for refunds
    const success = Math.random() > 0.02;

    if (success) {
      return {
        success: true,
        refundId: `REF${Date.now()}${Math.floor(Math.random() * 1000)}`,
        amount,
        message: 'Refund processed successfully',
      };
    } else {
      return {
        success: false,
        error: 'Refund processing failed',
      };
    }
  }

  private verifyWebhookSignature(
    provider: string,
    payload: any,
    signature?: string,
  ): boolean {
    // Implement webhook signature verification based on your payment provider
    // This is a placeholder - you should implement actual verification

    switch (provider.toLowerCase()) {
      case 'flutterwave':
        // Implement Flutterwave signature verification
        return true;
      case 'stripe':
        // Implement Stripe signature verification
        return true;
      case 'paystack':
        // Implement Paystack signature verification
        return true;
      default:
        this.logger.warn(`Unknown payment provider: ${provider}`);
        return false;
    }
  }

  private async sendPaymentNotification(payment: Payment): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: payment.userId },
      });

      if (user?.email) {
        // You can extend your MailService to include payment notifications
        // await this.mailService.sendPaymentNotificationEmail(user.email, payment);
        this.logger.log(
          `Payment notification sent for payment ${payment.paymentReference}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send payment notification:', error);
    }
  }
}
