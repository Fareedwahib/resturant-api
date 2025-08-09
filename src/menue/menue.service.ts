import { Injectable } from '@nestjs/common';
import { CreateMenueDto } from './dto/create-menue.dto';
import { UpdateMenueDto } from './dto/update-menue.dto';

@Injectable()
export class MenueService {
  create(createMenueDto: CreateMenueDto) {
    return 'This action adds a new menue';
  }

  findAll() {
    return `This action returns all menue`;
  }

  findOne(id: number) {
    return `This action returns a #${id} menue`;
  }

  update(id: number, updateMenueDto: UpdateMenueDto) {
    return `This action updates a #${id} menue`;
  }

  remove(id: number) {
    return `This action removes a #${id} menue`;
  }
}
