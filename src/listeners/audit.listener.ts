import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { PasswordResetRequestedEvent } from '../events/password-reset-requested.event';
import { UserStatusUpdatedEvent } from '../events/user-status-updated.event';

@Injectable()
export class AuditListener {
  private readonly logger = new Logger(AuditListener.name);

  @OnEvent('user.registered')
  async logUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`New User registered - ID: ${event.userId}, Email: ${event.email}, Role: ${event.role}`);
  }

  @OnEvent('user.password-reset-requested')
  async logPasswordResetRequested(event: PasswordResetRequestedEvent) {
    this.logger.log(`New Password reset requested for email: ${event.email}`);
  }

  @OnEvent('user.status-updated')
  async logUserStatusUpdated(event: UserStatusUpdatedEvent) {
    this.logger.log(`User status changed - Email: ${event.userEmail}, From: ${event.oldStatus}, To: ${event.newStatus}`);
  }

  @OnEvent('delivery-staff.registered')
  async logDeliveryStaffRegistered(event: any) {
    this.logger.log(`New Delivery staff registered - Email: ${event.deliveryStaff.email}`);
  }
}