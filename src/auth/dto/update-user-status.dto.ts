import { IsEmail, IsEnum, IsString, IsUUID } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class UpdateUserStatusDto {
  @IsEmail()
  email: string;

  @IsEnum(UserStatus)
  status: UserStatus;
}
