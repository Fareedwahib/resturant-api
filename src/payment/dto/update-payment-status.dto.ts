import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @IsOptional()
  @IsString()
  gatewayTransactionId?: string;

  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @IsOptional()
  @IsString()
  gatewayResponse?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
