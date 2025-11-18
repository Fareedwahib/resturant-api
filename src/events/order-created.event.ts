export class OrderCreatedEvent {
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
      unitPrice: number;
      totalPrice: number;
    }>,
    public readonly totalAmount: number,
    public readonly deliveryAddress: string,
    public readonly paymentMethod: string,
  ) {}
}
