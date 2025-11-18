import { PaymentStatus, PaymentMethod } from '../order/entities/order.entity';

export class OrderPaymentUpdatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly paymentStatus: PaymentStatus,
    public readonly paymentMethod: PaymentMethod,
    public readonly totalAmount: number,
    public readonly transactionId?: string,
  ) {}
}
