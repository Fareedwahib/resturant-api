import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { ResetToken } from './reset-token.entity';

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  DELIVERY_STAFF = 'delivery_staff',
  STAFF = 'staff',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_APPROVAL = 'pending_approval',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_APPROVAL,
  })
  status: UserStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district?: string; // Required for customers and delivery staff

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => ResetToken, (resetToken) => resetToken.user)
  resetTokens: ResetToken[];
  payments: any;
}
