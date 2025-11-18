export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly orderNumber: string,
    public readonly customerId: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly items: Array<{
      menuItemId: number;
      menuItemName: string;
      quantity: number;
    }>,
    public readonly cancelledBy: string, // userId who cancelled
    public readonly reason?: string,
  ) {}
}
