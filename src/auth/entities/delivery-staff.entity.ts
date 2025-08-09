import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class DeliveryStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  address?: string;

  @Column()
  vehicleType: string;

  @Column()
  licenseNumber: string;

  // === New image fields ===
  @Column()
  selfieUrl: string; // or passport photo

  @Column()
  nationalIdFrontUrl: string; // or passport front

  @Column()
  nationalIdBackUrl: string; // or passport back

  // === Status fields ===
  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: true })
  isActive: boolean;
}
