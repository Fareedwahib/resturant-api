export class InventoryUpdateRequiredEvent {
  constructor(
    public readonly items: Array<{
      menuItemId: number;
      quantity: number;
      operation: 'decrement' | 'increment'; // decrement for orders, increment for cancellations
    }>,
    public readonly orderId: string,
    public readonly orderNumber: string,
  ) {}
}