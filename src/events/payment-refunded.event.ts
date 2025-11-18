export class PaymentRefundedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly paymentReference: string,
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly originalAmount: number,
    public readonly refundAmount: number,
    public readonly totalRefunded: number,
    public readonly isFullyRefunded: boolean,
    public readonly reason: string,
    public readonly refundedBy: string,
  ) {}
}
