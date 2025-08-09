
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
// import { Product } from '../../products/entities/product.entity';

@Entity()
export class Category {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column({ unique: true })
    name: string;

}