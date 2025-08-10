import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
// import { User } fromimport { Module } from '@nestjs/common';
import { User } from './auth/entities/user.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { ResetToken } from './auth/entities/reset-token.entity';
import { DeliveryStaff } from './auth/entities/delivery-staff.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from './category/category.module';
import { MenueModule } from './menue/menue.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { Order, OrderItem } from './order/entities/order.entity';
import { Payment, PaymentWebhook } from './payment/entities/payment.entity';
import config from './config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
      }),
      global: true,
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
          User,
          RefreshToken,
          ResetToken,
          DeliveryStaff,
          Order,
          OrderItem,
          Payment,
          PaymentWebhook,
        ],
        synchronize: true, // Set to false in production!
        autoLoadEntities: true,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      ResetToken,
      DeliveryStaff,
      Order,
      OrderItem,
      Payment,
      PaymentWebhook,
    ]), 
    // MongoDB connection configuration
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
      inject: [ConfigService],
    }), 
    CategoriesModule, 
    MenueModule,
    OrderModule,
    PaymentModule,
 ],

  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}