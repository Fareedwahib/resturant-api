import { PartialType } from '@nestjs/mapped-types';
import { CreateMenueDto } from './create-menue.dto';

export class UpdateMenueDto extends PartialType(CreateMenueDto) {}
