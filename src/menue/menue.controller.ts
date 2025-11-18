import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenueService } from './menue.service';
import { CreateMenueDto } from './dto/create-menue.dto';
import { UpdateMenueDto } from './dto/update-menue.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RoleGuard } from '../guards/role.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('menu')
export class MenueController {
  constructor(private readonly menueService: MenueService) {}

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMenueDto: CreateMenueDto, @Req() req) {
    return await this.menueService.create(createMenueDto, req.user.userId);
  }

  @Get()
  async findAll() {
    return await this.menueService.findAll();
  }

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return await this.menueService.search(query.trim());
  }

  @Get('category/:categoryId')
  async findByCategory(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return await this.menueService.findByCategory(categoryId);
  }

  @UseGuards(AuthenticationGuard)
  @Get('my-products')
  async findMyProducts(@Req() req) {
    return await this.menueService.findByUser(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.menueService.findOne(id);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMenueDto: UpdateMenueDto,
    @Req() req,
  ) {
    return await this.menueService.update(id, updateMenueDto, req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('stock', ParseIntPipe) stock: number,
    @Req() req,
  ) {
    return await this.menueService.updateStock(id, stock, req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return await this.menueService.remove(id, req.user.userId);
  }
}
