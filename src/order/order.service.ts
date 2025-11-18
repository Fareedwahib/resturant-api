import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions, Not, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter'; // Add EventEmitter2 import
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from './entities/order.entity';
import { User, UserRole, UserStatus } from '../auth/entities/user.entity';
import { Menue } from '../menue/entities/menue.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { MailService } from '../services/mail.service';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderStatusUpdatedEvent } from '../events/order-status-updated.event';
import { OrderCancelledEvent } from '../events/order-cancelled.event';
import { OrderPaymentUpdatedEvent } from '../events/order-payment-updated.event';
import { InventoryUpdateRequiredEvent } from '../events/inventory-update-required.event';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name); // Add logger

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Menue)
    private menuRepository: Repository<Menue>,
    private mailService: MailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    customerId: string,
  ): Promise<Order> {
    try {
      // Check if customer exists
      const customer = await this.userRepository.findOne({
        where: { id: customerId },
        select: ['id', 'name', 'email', 'phone'],
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      let subtotal = 0;
      const orderItems: Array<{
        menuItemId: number;
        menuItemName: string;
        unitPrice: number;
        quantity: number;
        totalPrice: number;
        specialRequests?: string;
      }> = [];

      // Tracking inventory updates for event
      const inventoryUpdates: Array<{
        menuItemId: number;
        quantity: number;
        operation: 'decrement' | 'increment';
      }> = [];

      for (const item of createOrderDto.items) {
        const menuItem = await this.menuRepository.findOne({
          where: { id: item.menuItemId },
        });

        if (!menuItem) {
          throw new BadRequestException(
            `Menu item with ID ${item.menuItemId} not found`,
          );
        }

        if (!menuItem.isActive) {
          throw new BadRequestException(
            `Menu item "${menuItem.name}" is not available`,
          );
        }

        if (menuItem.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${menuItem.name}". Available: ${menuItem.stock}, Requested: ${item.quantity}`,
          );
        }

        const itemTotal = menuItem.price * item.quantity;
        subtotal += itemTotal;

        orderItems.push({
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          unitPrice: menuItem.price,
          quantity: item.quantity,
          totalPrice: itemTotal,
          specialRequests: item.specialRequests,
        });

        // Preparing inventory update for event
        inventoryUpdates.push({
          menuItemId: menuItem.id,
          quantity: item.quantity,
          operation: 'decrement',
        });
      }

      // Calculate fees
      const deliveryFee = this.calculateDeliveryFee(subtotal);
      const totalAmount = subtotal + deliveryFee;

      // Generating unique order number
      const orderNumber = await this.generateOrderNumber();

      // Creating order
      const order = this.orderRepository.create({
        orderNumber,
        customerId,
        subtotal,
        deliveryFee,
        totalAmount,
        paymentMethod: createOrderDto.paymentMethod,
        deliveryAddress: createOrderDto.deliveryAddress,
        specialInstructions: createOrderDto.specialInstructions,
        estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(),
      });

      const savedOrder = await this.orderRepository.save(order);

      // Creating order items
      for (const itemData of orderItems) {
        const orderItem = this.orderItemRepository.create({
          ...itemData,
          orderId: savedOrder.id,
        });

        await this.orderItemRepository.save(orderItem);

        // Updating menu item stock
        await this.menuRepository.decrement(
          { id: itemData.menuItemId },
          'stock',
          itemData.quantity,
        );
      }

      // Sending order confirmation email
      await this.sendOrderConfirmationEmail(savedOrder);

      // Emitting inventory update event
      this.eventEmitter.emit(
        'inventory.update-required',
        new InventoryUpdateRequiredEvent(
          inventoryUpdates,
          savedOrder.id,
          savedOrder.orderNumber,
        ),
      );

      // Emitting order created event
      this.eventEmitter.emit(
        'order.created',
        new OrderCreatedEvent(
          savedOrder.id,
          savedOrder.orderNumber,
          customer.id,
          customer.email,
          customer.name,
          orderItems.map((item) => ({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          totalAmount,
          createOrderDto.deliveryAddress,
          createOrderDto.paymentMethod,
        ),
      );

      this.logger.log(`Order created successfully: ${savedOrder.orderNumber}`);

      return await this.findOne(savedOrder.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to create order: ${error.message}`,
      );
    }
  }

  async findAll(queryDto: OrderQueryDto = {}): Promise<Order[]> {
    const where: any = {};

    if (queryDto.status) where.status = queryDto.status;
    if (queryDto.paymentStatus) where.paymentStatus = queryDto.paymentStatus;
    if (queryDto.customerId) where.customerId = queryDto.customerId;
    if (queryDto.deliveryStaffId)
      where.deliveryStaffId = queryDto.deliveryStaffId;
    if (queryDto.orderNumber) where.orderNumber = queryDto.orderNumber;

    if (queryDto.startDate && queryDto.endDate) {
      where.createdAt = Between(
        new Date(queryDto.startDate),
        new Date(queryDto.endDate),
      );
    }

    return await this.orderRepository.find({
      where,
      relations: ['customer', 'deliveryStaff', 'items'],
      order: { createdAt: 'DESC' },
      select: {
        customer: { id: true, name: true, email: true, phone: true },
        deliveryStaff: { id: true, name: true, phone: true },
      },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['customer', 'deliveryStaff', 'items'],
      select: {
        customer: { id: true, name: true, email: true, phone: true },
        deliveryStaff: { id: true, name: true, phone: true },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
      relations: ['customer', 'deliveryStaff', 'items'],
      select: {
        customer: { id: true, name: true, email: true, phone: true },
        deliveryStaff: { id: true, name: true, phone: true },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found`);
    }

    return order;
  }

  async findCustomerOrders(customerId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: {
        customerId,
        status: Not(In([OrderStatus.CANCELLED, OrderStatus.DELIVERED])),
      },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findDeliveryStaffOrders(deliveryStaffId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { deliveryStaffId },
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
      select: {
        customer: { id: true, name: true, phone: true },
      },
    });
  }

  async updateStatus(
    orderId: string,
    updateStatusDto: UpdateOrderStatusDto,
    userId: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const customer = await this.userRepository.findOne({
      where: { id: order.customerId },
      select: ['id', 'name', 'email'],
    });

    this.validateStatusTransition(order.status, updateStatusDto.status);

    this.validateUpdatePermissions(user, order, updateStatusDto.status);

    const oldStatus = order.status;
    let deliveryStaff: User | null = null;

    order.status = updateStatusDto.status;

    if (updateStatusDto.deliveryStaffId) {
      deliveryStaff = await this.userRepository.findOne({
        where: {
          id: updateStatusDto.deliveryStaffId,
          role: UserRole.DELIVERY_STAFF,
        },
        select: ['id', 'name', 'email'],
      });

      if (!deliveryStaff) {
        throw new BadRequestException('Invalid delivery staff ID');
      }

      order.deliveryStaffId = updateStatusDto.deliveryStaffId;
    }

    if (updateStatusDto.status === OrderStatus.DELIVERED) {
      order.actualDeliveryTime = new Date();
      order.paymentStatus = PaymentStatus.PAID; // Assume payment on delivery

      // Emitting payment updated event
      this.eventEmitter.emit(
        'order.payment-updated',
        new OrderPaymentUpdatedEvent(
          order.id,
          order.orderNumber,
          order.customerId,
          PaymentStatus.PAID,
          order.paymentMethod,
          order.totalAmount,
        ),
      );
    }

    const updatedOrder = await this.orderRepository.save(order);

    // Sending status update notifications
    await this.sendStatusUpdateNotification(updatedOrder);

    // Emitting order status updated event
    if (customer) {
      this.eventEmitter.emit(
        'order.status-updated',
        new OrderStatusUpdatedEvent(
          order.id,
          order.orderNumber,
          customer.id,
          customer.email,
          customer.name,
          oldStatus,
          updateStatusDto.status,
          deliveryStaff?.id,
          deliveryStaff?.name,
          order.estimatedDeliveryTime,
          order.actualDeliveryTime,
        ),
      );
    }

    this.logger.log(
      `Order status updated: ${order.orderNumber} from ${oldStatus} to ${updateStatusDto.status}`,
    );

    return await this.findOne(updatedOrder.id);
  }

  async cancelOrderAndDelete(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<{ message: string }> {
    // Find the order by ID including its items
    const order = await this.findOne(id);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const customer = await this.userRepository.findOne({
      where: { id: order.customerId },
      select: ['id', 'name', 'email'],
    });

    // Only the customer who placed the order, or admins/staff can cancel/delete it
    if (
      order.customerId !== userId &&
      ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)
    ) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    // Prevent deletion if the order is already delivered
    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Delivered orders cannot be cancelled or deleted.',
      );
    }

    // Prepare inventory restoration for event
    const inventoryUpdates: Array<{
      menuItemId: number;
      quantity: number;
      operation: 'increment' | 'decrement';
    }> = order.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      operation: 'increment' as const,
    }));

    // Restore stock for each ordered menu item
    for (const item of order.items) {
      await this.menuRepository.increment(
        { id: item.menuItemId },
        'stock',
        item.quantity,
      );
    }

    // Emitting inventory update event for stock restoration
    this.eventEmitter.emit(
      'inventory.update-required',
      new InventoryUpdateRequiredEvent(
        inventoryUpdates,
        order.id,
        order.orderNumber,
      ),
    );

    // Emitting order cancelled event
    if (customer) {
      this.eventEmitter.emit(
        'order.cancelled',
        new OrderCancelledEvent(
          order.id,
          order.orderNumber,
          customer.id,
          customer.email,
          customer.name,
          order.items.map((item) => ({
            menuItemId: item.menuItemId,
            menuItemName: item.menuItemName,
            quantity: item.quantity,
          })),
          reason ?? '',
          userId,
        ),
      );
    }

    // Delete all order items first to avoid foreign key constraint errors
    await this.orderItemRepository.delete({ orderId: id });

    await this.orderRepository.delete(id);

    await this.sendCancellationNotification(order, reason);

    this.logger.log(`Order cancelled and deleted: ${order.orderNumber}`);

    return {
      message: `Order ${order.orderNumber} and its details have been deleted successfully.`,
    };
  }

  async getOrderStatistics(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    const totalOrders = await this.orderRepository.count();
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });
    const completedOrders = await this.orderRepository.count({
      where: { status: OrderStatus.DELIVERED },
    });
    const cancelledOrders = await this.orderRepository.count({
      where: { status: OrderStatus.CANCELLED },
    });

    const totalRevenue = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status = :status', { status: OrderStatus.DELIVERED })
      .getRawOne();

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: parseFloat(totalRevenue?.total || '0'),
    };
  }

  async assignDeliveryStaff(
    orderId: string,
    deliveryStaffId: string,
    adminId: string,
  ): Promise<Order> {
    const admin = await this.userRepository.findOne({ where: { id: adminId } });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can assign delivery staff');
    }

    const order = await this.findOne(orderId);
    const deliveryStaff = await this.userRepository.findOne({
      where: { id: deliveryStaffId, role: UserRole.DELIVERY_STAFF },
    });

    if (!deliveryStaff) {
      throw new BadRequestException('Invalid delivery staff ID');
    }

    if (order.status !== OrderStatus.READY) {
      throw new BadRequestException(
        'Order must be ready before assigning delivery staff',
      );
    }

    order.deliveryStaffId = deliveryStaffId;
    order.status = OrderStatus.OUT_FOR_DELIVERY;

    return await this.orderRepository.save(order);
  }

  async getAvailableDeliveryStaff(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.DELIVERY_STAFF, status: UserStatus.ACTIVE },
      select: ['id', 'name', 'phone', 'email'],
    });
  }

  // Method to update order payment status
  async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    transactionId?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    const oldPaymentStatus = order.paymentStatus;
    order.paymentStatus = paymentStatus;

    const updatedOrder = await this.orderRepository.save(order);

    // Emitting payment updated event
    this.eventEmitter.emit(
      'order.payment-updated',
      new OrderPaymentUpdatedEvent(
        order.id,
        order.orderNumber,
        order.customerId,
        paymentStatus,
        order.paymentMethod,
        order.totalAmount,
        transactionId,
      ),
    );

    this.logger.log(
      `Payment status updated for order ${order.orderNumber}: ${oldPaymentStatus} → ${paymentStatus}`,
    );

    return updatedOrder;
  }

  // Keep all existing private methods exactly the same...
  private calculateDeliveryFee(subtotal: number): number {
    // Simple delivery fee calculation
    if (subtotal >= 50000) return 0; // Free delivery for orders above 50k UGX
    return 5000; // 5k UGX delivery fee
  }

  private calculateEstimatedDeliveryTime(): Date {
    const now = new Date();
    // 45 minutes for preparation and delivery
    now.setMinutes(now.getMinutes() + 45);
    return now;
  }

  private async generateOrderNumber(): Promise<string> {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    let orderNumber: string;
    let attempts = 0;

    do {
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      orderNumber = `${prefix}${timestamp}${randomSuffix}`;
      attempts++;

      const existing = await this.orderRepository.findOne({
        where: { orderNumber },
      });

      if (!existing) break;

      if (attempts > 10) {
        throw new InternalServerErrorException(
          'Failed to generate unique order number',
        );
      }
    } while (true);

    return orderNumber;
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.PARTIALLY_REFUNDED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private validateUpdatePermissions(
    user: User,
    order: Order,
    newStatus: OrderStatus,
  ): void {
    switch (user.role) {
      case UserRole.ADMIN:
        break;
      case UserRole.STAFF:
        if (
          [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED].includes(
            newStatus,
          )
        ) {
          throw new ForbiddenException(
            'Only delivery staff can update delivery statuses',
          );
        }
        break;
      case UserRole.DELIVERY_STAFF:
        if (
          ![OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED].includes(
            newStatus,
          )
        ) {
          throw new ForbiddenException(
            'Delivery staff can only update delivery statuses',
          );
        }
        if (order.deliveryStaffId !== user.id) {
          throw new ForbiddenException(
            'You can only update orders assigned to you',
          );
        }
        break;
      case UserRole.CUSTOMER:
        if (
          newStatus !== OrderStatus.CANCELLED ||
          order.customerId !== user.id
        ) {
          throw new ForbiddenException(
            'Customers can only cancel their own pending orders',
          );
        }
        if (order.status !== OrderStatus.PENDING) {
          throw new ForbiddenException(
            'Order cannot be cancelled at this stage',
          );
        }
        break;
      default:
        throw new ForbiddenException('Invalid user role');
    }
  }

  private async sendOrderConfirmationEmail(order: Order): Promise<void> {
    try {
      const customer = await this.userRepository.findOne({
        where: { id: order.customerId },
      });

      if (customer?.email) {
        // Implementation would go here - similar to your existing mail service
        // await this.mailService.sendOrderConfirmationEmail(customer.email, order);
      }
    } catch (error) {
      // Log error but don't fail the order creation
      console.error('Failed to send order confirmation email:', error);
    }
  }

  private async sendStatusUpdateNotification(order: Order): Promise<void> {
    try {
      const customer = await this.userRepository.findOne({
        where: { id: order.customerId },
      });

      if (customer?.email) {
        // Implementation would go here
        // await this.mailService.sendOrderStatusUpdateEmail(customer.email, order);
      }
    } catch (error) {
      console.error('Failed to send status update notification:', error);
    }
  }

  private async sendCancellationNotification(
    order: Order,
    reason?: string,
  ): Promise<void> {
    try {
      const customer = await this.userRepository.findOne({
        where: { id: order.customerId },
      });

      if (customer?.email) {
        // Implementation would go here
        // await this.mailService.sendOrderCancellationEmail(customer.email, order, reason);
      }
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }
  }
}
