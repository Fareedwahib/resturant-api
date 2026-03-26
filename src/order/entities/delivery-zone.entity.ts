import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('delivery_zones')
export class DeliveryZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  baseFee: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  feePerKm: number;

  @Column('decimal', { precision: 8, scale: 2, default: 10 })
  maxDistanceKm: number;

  @Column({ type: 'int', default: 45 })
  averageDeliveryMinutes: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minimumOrderAmount: number;

  @Column('decimal', { precision: 10, scale: 7 })
  storeLatitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  storeLongitude: number;

  @Column({ type: 'simple-json', nullable: true })
  polygon?: Array<{ lat: number; lng: number }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
