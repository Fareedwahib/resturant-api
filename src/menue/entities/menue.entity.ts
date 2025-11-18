import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../category/entities/category.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('Menue')
export class Menue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 0 })
  stock: number;

  @Column()
  categoryId: number;

  @Column()
  userId: string;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Category, { eager: false })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
