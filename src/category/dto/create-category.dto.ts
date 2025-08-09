import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Category name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Category name must not exceed 50 characters' })
  name: string;
}