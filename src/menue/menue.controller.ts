import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MenueService } from './menue.service';
import { CreateMenueDto } from './dto/create-menue.dto';
import { UpdateMenueDto } from './dto/update-menue.dto';

@Controller('menue')
export class MenueController {
  constructor(private readonly menueService: MenueService) {}

  @Post()
  create(@Body() createMenueDto: CreateMenueDto) {
    return this.menueService.create(createMenueDto);
  }

  @Get()
  findAll() {
    return this.menueService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menueService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMenueDto: UpdateMenueDto) {
    return this.menueService.update(+id, updateMenueDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menueService.remove(+id);
  }
}
