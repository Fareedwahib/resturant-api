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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RoleGuard } from '../guards/role.guard';
import { Roles } from '../decorators/roles.decorator';
import { User, UserRole } from '../auth/entities/user.entity';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.CUSTOMER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto, @Req() req) {
    return await this.orderService.create(createOrderDto, req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  async findAll(@Query() queryDto: OrderQueryDto) {
    return await this.orderService.findAll(queryDto);
  }

  @UseGuards(AuthenticationGuard)
  @Get('my-orders')
  async findMyOrders(@Req() req) {
    return await this.orderService.findCustomerOrders(req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.DELIVERY_STAFF)
  @Get('my-deliveries')
  async findMyDeliveries(@Req() req) {
    return await this.orderService.findDeliveryStaffOrders(req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get('statistics')
  async getStatistics(@Req() req) {
    return await this.orderService.getOrderStatistics(req.user.userId);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Get('delivery-staff')
  async getAvailableDeliveryStaff() {
    return await this.orderService.getAvailableDeliveryStaff();
  }

  @UseGuards(AuthenticationGuard)
  @Get('number/:orderNumber')
  async findByOrderNumber(@Param('orderNumber') orderNumber: string, @Req() req) {
    const order = await this.orderService.findByOrderNumber(orderNumber);
    const user = await this.userRepository.findOne({ where: { id: req.user.userId } });

    // Check if user can view this order
    if (order.customerId !== req.user.userId &&
      (!user || ![UserRole.ADMIN, UserRole.STAFF, UserRole.DELIVERY_STAFF].includes(user.role))) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }

  @UseGuards(AuthenticationGuard)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const order = await this.orderService.findOne(id);
    const user = await this.userRepository.findOne({ where: { id: req.user.userId } });

    // Check if user can view this order
    if (order.customerId !== req.user.userId &&
      (!user || ![UserRole.ADMIN, UserRole.STAFF, UserRole.DELIVERY_STAFF].includes(user.role))) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }

  @UseGuards(AuthenticationGuard)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Req() req
  ) {
    return await this.orderService.updateStatus(id, updateStatusDto, req.user.userId);
  }

  @UseGuards(AuthenticationGuard)
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req
  ) {
    return await this.orderService.cancelOrderAndDelete(id, req.user.userId, reason);
  }

  @UseGuards(AuthenticationGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/assign-delivery-staff')
  async assignDeliveryStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('deliveryStaffId', ParseUUIDPipe) deliveryStaffId: string,
    @Req() req
  ) {
    return await this.orderService.assignDeliveryStaff(id, deliveryStaffId, req.user.userId);
  }
}