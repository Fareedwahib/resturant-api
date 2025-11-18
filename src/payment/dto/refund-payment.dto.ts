import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class RefundPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Refund amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
