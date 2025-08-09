import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
} from '@nestjs/common';
import { CategoriesService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { Roles } from '../decorators/roles.decorator';
import { RoleGuard } from '../guards/role.guard';
import { UserRole } from '../auth/entities/user.entity';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @UseGuards(AuthenticationGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createCategoryDto: CreateCategoryDto) {
        return await this.categoriesService.create(createCategoryDto);
    }

    @Get()
    async findAll() {
        return await this.categoriesService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
        return await this.categoriesService.findOne(id);
    }

    @UseGuards(AuthenticationGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    @Patch(':id')
    async update(
        @Param('id', ParseIntPipe) id: number, 
        @Body() updateCategoryDto: UpdateCategoryDto
    ) {
        return await this.categoriesService.update(id, updateCategoryDto);
    }

    @UseGuards(AuthenticationGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number) {
        return await this.categoriesService.remove(id);
    }
}