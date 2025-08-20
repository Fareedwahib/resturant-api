export class PaymentCreatedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly paymentReference: string,
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly amount: number,
    public readonly paymentMethod: string,
    public readonly status: string,
  ) {}
}