import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  IsBoolean, 
  Min, 
  IsNotEmpty,
  MaxLength,
  MinLength,
  Max
} from 'class-validator';

export class CreateMenueDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Product name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Product name must not exceed 100 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must have at most 2 decimal places' })
  @Min(0.01, { message: 'Price must be greater than 0' })
  @Max(999999.99, { message: 'Price must not exceed 999,999.99' })
  price: number;

  @IsNumber({}, { message: 'Stock must be a valid number' })
  @Min(0, { message: 'Stock cannot be negative' })
  stock: number;

  @IsNumber({}, { message: 'Category ID must be a valid number' })
  @Min(1, { message: 'Category ID must be a positive number' })
  categoryId: number; 

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}