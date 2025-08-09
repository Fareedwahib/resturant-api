import { Module } from '@nestjs/common';
import { MenueService } from './menue.service';
import { MenueController } from './menue.controller';

@Module({
  controllers: [MenueController],
  providers: [MenueService],
})
export class MenueModule {}
