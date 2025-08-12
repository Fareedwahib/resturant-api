import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Order } from '../../order/entities/order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash',
  MOBILE_MONEY = 'mobilemoney',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
}

export enum MobileMoneyProvider {
  MTN = 'mtn',
  AIRTEL = 'airtel',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  paymentReference: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'UGX' })
  currency: string;

  // Mobile Money specific fields
  @Column({
    type: 'enum',
    enum: MobileMoneyProvider,
    nullable: true,
  })
  mobileMoneyProvider?: MobileMoneyProvider;

  @Column({ type: 'varchar', length: 15, nullable: true })
  mobileMoneyNumber?: string;

  // Payment gateway fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayTransactionId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayReference?: string;

  @Column({ type: 'text', nullable: true })
  gatewayResponse?: string;

  // Metadata
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  // Timestamps
  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;
}

@Entity('payment_webhooks')
export class PaymentWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  provider: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'text' })
  payload: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference?: string;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'text', nullable: true })
  processingError?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}