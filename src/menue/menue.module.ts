import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenueService } from './menue.service';
import { MenueController } from './menue.controller';
import { Menue} from './entities/menue.entity';
import { Category } from '../category/entities/category.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menue, Category, User])
  ],
  controllers: [MenueController],
  providers: [MenueService],
  exports: [MenueService, TypeOrmModule],
})
export class MenueModule {}