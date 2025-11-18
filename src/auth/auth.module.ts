import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ResetToken } from './entities/reset-token.entity';
import { DeliveryStaff } from './entities/delivery-staff.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, ResetToken, DeliveryStaff]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
