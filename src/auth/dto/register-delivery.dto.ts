import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  IsUrl,
} from 'class-validator';

export class RegisterDeliveryStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  vehicleType: string;

  @IsString()
  @IsNotEmpty()
  licenseNumber: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty({ message: 'A selfie/passport photo is required' })
  @IsUrl({}, { message: 'selfieUrl must be a valid URL' })
  selfieUrl: string;

  @IsNotEmpty({ message: 'Front image of National ID or passport is required' })
  @IsUrl({}, { message: 'nationalIdFrontUrl must be a valid URL' })
  nationalIdFrontUrl: string;

  @IsNotEmpty({ message: 'Back image of National ID or passport is required' })
  @IsUrl({}, { message: 'nationalIdBackUrl must be a valid URL' })
  nationalIdBackUrl: string;
}
