import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Category } from '../../category/entities/category.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;

    @Column({ default: 0 })
    stock: number;

    @Column()
    categoryId: number;

    @Column()
    userId: string;

    @ManyToOne(() => Category)
    @JoinColumn({ name: 'categoryId' })
    category: Category;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    // // One-to-Many relationship with OrderItems
    // @OneToMany(() => OrderItem, orderItem => orderItem.product)
    // orderItems: OrderItem[];

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}