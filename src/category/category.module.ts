import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesController } from './category.controller';
import { CategoriesService } from './category.service';
import { Category } from './entities/category.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [TypeOrmModule],
})
export class CategoriesModule {}
