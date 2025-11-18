import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from '../services/mail.service';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { PasswordResetRequestedEvent } from '../events/password-reset-requested.event';
import { DeliveryStaffRegisteredEvent } from '../events/delivery-staff-registered.event';
import { UserStatusUpdatedEvent } from '../events/user-status-updated.event';

@Injectable()
export class UserListener {
  private readonly logger = new Logger(UserListener.name);

  constructor(private readonly mailService: MailService) {}

  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`Handling user registered event for: ${event.email}`);

    try {
      await this.mailService.sendWelcomeEmail(
        event.email,
        event.name,
        event.role,
        event.status,
      );

      this.logger.log(`Welcome email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${event.email}:`,
        error,
      );
    }
  }

  @OnEvent('user.password-reset-requested')
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    this.logger.log(`Handling password reset event for: ${event.email}`);

    try {
      await this.mailService.sendPasswordResetEmail(
        event.email,
        event.resetToken,
        event.userName,
      );

      this.logger.log(`Password reset email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${event.email}:`,
        error,
      );
    }
  }

  @OnEvent('delivery-staff.registered')
  async handleDeliveryStaffRegistered(event: DeliveryStaffRegisteredEvent) {
    this.logger.log(
      `Handling delivery staff registration for: ${event.deliveryStaff.email}`,
    );

    try {
      await this.mailService.sendDeliveryStaffRegistrationToAdmin(
        event.adminEmail,
        event.deliveryStaff,
      );

      await this.mailService.sendDeliveryStaffConfirmation(
        event.deliveryStaff.email,
        event.deliveryStaff.firstName,
      );

      this.logger.log(
        `Delivery staff registration emails sent for ${event.deliveryStaff.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send delivery staff registration emails:`,
        error,
      );
    }
  }

  @OnEvent('user.status-updated')
  async handleUserStatusUpdated(event: UserStatusUpdatedEvent) {
    this.logger.log(`Handling user status update for: ${event.userEmail}`);

    try {
      await this.mailService.sendUserStatusUpdateEmail(
        event.userEmail,
        event.userName,
        event.oldStatus,
        event.newStatus,
      );

      this.logger.log(`Status update email sent to ${event.userEmail}`);
    } catch (error) {
      this.logger.error(
        `Failed to send status update email to ${event.userEmail}:`,
        error,
      );
    }
  }
}
