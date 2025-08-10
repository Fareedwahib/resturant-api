import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
  Min,
  Max,
  IsPhoneNumber,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class CreateOrderItemDto {
  @IsNumber({}, { message: 'Menu item ID must be a valid number' })
  @Min(1, { message: 'Menu item ID must be positive' })
  menuItemId: number;

  @IsNumber({}, { message: 'Quantity must be a valid number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(100, { message: 'Quantity cannot exceed 100' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Special requests must not exceed 200 characters' })
  specialRequests?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Delivery address must not exceed 500 characters' })
  deliveryAddress: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Customer name must be at least 2 characters' })
  @MaxLength(100, { message: 'Customer name must not exceed 100 characters' })
  customerName: string;

  @IsPhoneNumber('UG')
  customerPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Special instructions must not exceed 300 characters' })
  specialInstructions?: string;
}