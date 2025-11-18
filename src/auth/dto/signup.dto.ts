import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  ValidateIf,
  IsNotEmpty,
  isNotEmpty,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class SignupDto {
  @IsString()
  name: string;

  @IsEmail()
  @ValidateIf((o) => o.email !== undefined)
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  @Matches(/^(?=.*[0-9])/, {
    message: 'Password must contain at least one number',
  })
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role: UserRole = UserRole.CUSTOMER;

  @IsOptional()
  @IsPhoneNumber('UG')
  phone?: string;
}
