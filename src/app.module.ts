import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { UploadModule } from './upload/upload.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { User } from './auth/entities/user.entity';
import { UserListener } from './listeners/user.listener';
import { AuditListener } from './listeners/audit.listener';
import { OrderListener } from './listeners/order.listener'; // New
import { InventoryListener } from './listeners/inventory.listener'; // New
import { NotificationListener } from './listeners/notification.listener'; // New
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { ResetToken } from './auth/entities/reset-token.entity';
import { DeliveryStaff } from './auth/entities/delivery-staff.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from './category/category.module';
import { MenueModule } from './menue/menue.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { Order, OrderItem } from './order/entities/order.entity';
import { DeliveryZone } from './order/entities/delivery-zone.entity';
import { Payment, PaymentWebhook } from './payment/entities/payment.entity';
import config from './config/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailService } from './services/mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    // Rate limiting: 100 requests per minute globally
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // In-memory cache with 5 minute TTL
    CacheModule.register({
      isGlobal: true,
      ttl: 300,
    }),
    // Cron/scheduled tasks
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      // Set this to `true` to use wildcards
      wildcard: false,
      // The delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` if you want to emit the newListener event
      newListener: false,
      // Set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // The maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // Show event name in memory leak message when more than maximum amount of listeners are assigned
      verboseMemoryLeak: false,
      // Disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
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
          DeliveryZone,
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
      DeliveryZone,
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
    UploadModule,
 ],

  controllers: [AppController],
  providers: [
    AppService,
    MailService,
    // Rate limiting guard applied globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Event Listeners
    UserListener,
    AuditListener,
    OrderListener,
    InventoryListener,
    NotificationListener,
  ],
})

export class AppModule {}