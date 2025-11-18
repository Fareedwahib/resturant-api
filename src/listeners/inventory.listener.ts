import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menue } from '../menue/entities/menue.entity';
import { InventoryUpdateRequiredEvent } from '../events/inventory-update-required.event';

@Injectable()
export class InventoryListener {
  private readonly logger = new Logger(InventoryListener.name);

  constructor(
    @InjectRepository(Menue)
    private menuRepository: Repository<Menue>,
  ) {}

  @OnEvent('inventory.update-required')
  async handleInventoryUpdateRequired(event: InventoryUpdateRequiredEvent) {
    this.logger.log(
      `Handling inventory update for order: ${event.orderNumber}`,
    );

    try {
      for (const item of event.items) {
        if (item.operation === 'decrement') {
          await this.menuRepository.decrement(
            { id: item.menuItemId },
            'stock',
            item.quantity,
          );
          this.logger.log(
            `Decremented stock for menu item ${item.menuItemId} by ${item.quantity}`,
          );
        } else if (item.operation === 'increment') {
          await this.menuRepository.increment(
            { id: item.menuItemId },
            'stock',
            item.quantity,
          );
          this.logger.log(
            `Incremented stock for menu item ${item.menuItemId} by ${item.quantity}`,
          );
        }
      }

      this.logger.log(
        `Inventory updated successfully for order ${event.orderNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update inventory for order ${event.orderNumber}:`,
        error,
      );
    }
  }

  @OnEvent('inventory.low-stock-alert')
  async handleLowStockAlert(menuItemId: number, currentStock: number) {
    this.logger.warn(
      `Low stock alert: Menu item ${menuItemId} has only ${currentStock} items left`,
    );

    // You could send notification to admin here
    // await this.mailService.sendLowStockAlert(adminEmail, menuItem);
  }
}
