import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ValidationPipe,
    HttpStatus,
    HttpCode,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { CategoriesService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
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
    async create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

}
