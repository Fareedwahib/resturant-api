import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Headers,
  RawBody,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { MobileMoneyPaymentDto } from './dto/mobile-money-payment.dto';
import { PaymentMethod } from './entities/payment.entity';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RoleGuard } from '../guards/role.guard';
import { Roles } from '../decorators/roles.decorator';
import { User, UserRole } from '../auth/entities/user.entity';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @UseGuards(AuthenticationGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Body() createPaymentDto: CreatePaymentDto, @Req() req) {
    return await this.paymentService.createPayment(createPaymentDto, req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  async findAll(@Query() queryDto: PaymentQueryDto) {
    return await this.paymentService.findAll(queryDto);
  }

  @UseGuards(AuthenticationGuard)
  @Get('my-payments')
  async findMyPayments(@Req() req) {
    return await this.paymentService.findUserPayments(req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('statistics')
  async getStatistics(@Req() req) {
    return await this.paymentService.getPaymentStatistics(req.user.userId);
  }

  @UseGuards(AuthenticationGuard)
  @Get('order/:orderId')
  async getPaymentsByOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req
  ) {
    return await this.paymentService.getPaymentByOrder(orderId, req.user.userId);
  }

  @UseGuards(AuthenticationGuard)
  @Get('reference/:reference')
  async findByReference(@Param('reference') reference: string, @Req() req) {
    const payment = await this.paymentService.findByReference(reference);
    
    // Check if user can view this payment
    if (payment.userId !== req.user.userId) {
      const user = await this.userRepository.findOne({ where: { id: req.user.userId } });
      if (!user || ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)) {
        throw new ForbiddenException('You can only view your own payments');
      }
    }
    
    return payment;
  }

  @UseGuards(AuthenticationGuard)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const payment = await this.paymentService.findOne(id);
    
    // Check if user can view this payment
    if (payment.userId !== req.user.userId) {
      const user = await this.userRepository.findOne({ where: { id: req.user.userId } });
      if (!user || ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)) {
        throw new ForbiddenException('You can only view your own payments');
      }
    }
    
    return payment;
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.DELIVERY_STAFF)
  @Patch(':id/confirm-cash')
  async confirmCashPayment(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return await this.paymentService.confirmCashPayment(id, req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/refund')
  async refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() refundDto: RefundPaymentDto,
    @Req() req
  ) {
    return await this.paymentService.refundPayment(id, refundDto, req.user.userId);
  }

  @UseGuards(AuthenticationGuard)
  @Patch(':id/cancel')
  async cancelPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req
  ) {
    return await this.paymentService.cancelPayment(id, req.user.userId, reason);
  }

  // Webhook endpoints for payment providers
  @Post('webhooks/flutterwave')
  @HttpCode(HttpStatus.OK)
  async flutterwaveWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    await this.paymentService.handleWebhook('flutterwave', payload, signature);
    return { status: 'success' };
  }

  @Post('webhooks/paystack')
  @HttpCode(HttpStatus.OK)
  async paystackWebhook(
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    await this.paymentService.handleWebhook('paystack', payload, signature);
    return { status: 'success' };
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @RawBody() payload: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    const parsedPayload = JSON.parse(payload.toString());
    await this.paymentService.handleWebhook('stripe', parsedPayload, signature);
    return { status: 'success' };
  }

  // Mobile Money specific endpoints
  @UseGuards(AuthenticationGuard)
  @Post('mobile-money')
  async initiateMobileMoneyPayment(
    @Body() mobileMoneyDto: MobileMoneyPaymentDto,
    @Req() req
  ) {
    const createPaymentDto: CreatePaymentDto = {
      orderId: mobileMoneyDto.orderId,
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      amount: mobileMoneyDto.amount,
      mobileMoneyProvider: mobileMoneyDto.provider,
      mobileMoneyNumber: mobileMoneyDto.phoneNumber,
      description: mobileMoneyDto.description,
    };

    return await this.paymentService.createPayment(createPaymentDto, req.user.userId);
  }

  // Payment status check endpoint
  @UseGuards(AuthenticationGuard)
  @Get(':id/status')
  async checkPaymentStatus(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const payment = await this.paymentService.findOne(id);
    
    // Check permissions
    if (payment.userId !== req.user.userId) {
      const user = await this.userRepository.findOne({ where: { id: req.user.userId } });
      if (!user || ![UserRole.ADMIN, UserRole.STAFF].includes(user.role)) {
        throw new ForbiddenException('You can only check your own payment status');
      }
    }

    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      status: payment.status,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
    };
  }
}