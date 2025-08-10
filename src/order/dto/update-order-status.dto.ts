import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsUUID()
  deliveryStaffId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}