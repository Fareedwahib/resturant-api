export class PaymentCompletedEvent {
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
    public readonly transactionId?: string,
    public readonly confirmedBy?: string,
  ) {}
}
