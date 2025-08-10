import {
  IsEnum,
  IsPhoneNumber,
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { MobileMoneyProvider } from '../entities/payment.entity';

export class MobileMoneyPaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(MobileMoneyProvider)
  provider: MobileMoneyProvider;

  @IsPhoneNumber('UG')
  phoneNumber: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}