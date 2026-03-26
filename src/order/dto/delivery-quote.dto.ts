import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, Min } from 'class-validator';

export class DeliveryQuoteDto {
  @Type(() => Number)
  @IsLatitude({ message: 'Latitude must be a valid latitude value' })
  latitude: number;

  @Type(() => Number)
  @IsLongitude({ message: 'Longitude must be a valid longitude value' })
  longitude: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Subtotal must be a valid number' })
  @Min(0, { message: 'Subtotal cannot be negative' })
  subtotal: number;
}
