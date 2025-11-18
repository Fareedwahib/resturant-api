import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  orderNumber: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true })
  deliveryStaffId?: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH_ON_DELIVERY,
  })
  paymentMethod: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  specialInstructions?: string;

  @Column({ type: 'varchar', length: 500 })
  deliveryAddress: string;

  @Column({ type: 'timestamp', nullable: true })
  estimatedDeliveryTime?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualDeliveryTime?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'deliveryStaffId' })
  deliveryStaff?: User;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[];
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'int' })
  menuItemId: number;

  @Column({ type: 'varchar', length: 100 })
  menuItemName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  specialRequests?: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
