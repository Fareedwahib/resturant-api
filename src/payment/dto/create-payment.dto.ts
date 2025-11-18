import {
  IsEnum,
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsPhoneNumber,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { PaymentMethod, MobileMoneyProvider } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Max(999999.99, { message: 'Amount cannot exceed 999,999.99' })
  amount: number;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.MOBILE_MONEY)
  @IsEnum(MobileMoneyProvider)
  mobileMoneyProvider?: MobileMoneyProvider;

  @ValidateIf((o) => o.paymentMethod === PaymentMethod.MOBILE_MONEY)
  @IsPhoneNumber('UG')
  mobileMoneyNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
