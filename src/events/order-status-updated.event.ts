import { OrderStatus } from '../order/entities/order.entity';

export class OrderStatusUpdatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly oldStatus: OrderStatus,
    public readonly newStatus: OrderStatus,
    public readonly deliveryStaffId?: string,
    public readonly deliveryStaffName?: string,
    public readonly estimatedDeliveryTime?: Date,
    public readonly actualDeliveryTime?: Date,
  ) {}
}