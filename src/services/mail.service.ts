import * as nodemailer from 'nodemailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('email.host'),
      port: this.configService.get('email.port'),
      secure: false, 
      auth: {
        username: this.configService.get('email.username'), 
        user: this.configService.get('email.user'),
        pass: this.configService.get('email.pass'),
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
    }
  }

  async sendPasswordResetEmail(to: string, token: string) {
    try {
      const resetLink = `http://yourapp.com/reset-password?token=${token}`;
      const mailOptions = {
        from: this.configService.get('email.username'), // Use the authenticated email
        to: to,
        subject: 'Password Reset Request - Ecommerce-APi',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Ecommerce API account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          </div>
        `,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully to ${to}`, result.messageId);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
      throw error;
    }
  }
  async sendDeliveryStaffRegistrationEmails(adminEmail: string, deliveryStaff: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  vehicleType: string;
  licenseNumber: string;
  selfieUrl: string;
  nationalIdFrontUrl: string;
  nationalIdBackUrl: string;
}) {
  const { email, firstName, lastName, phone, vehicleType, licenseNumber, selfieUrl, nationalIdFrontUrl, nationalIdBackUrl } = deliveryStaff;

  // Email to Admin
  const adminMailOptions = {
    from: this.configService.get('email.user'),
    to: adminEmail,
    subject: 'New Delivery Staff Registration Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>New Delivery Staff Registration</h2>
        <p>A new delivery staff member has submitted a registration request.</p>
        <ul>
          <li><strong>Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Selfie URL:</strong> <a href="${selfieUrl}" target="_blank">View Selfie</a></li>
          <li><strong>National ID Front URL:</strong> <a href="${nationalIdFrontUrl}" target="_blank">View ID Front</a></li>
          <li><strong>National ID Back URL:</strong> <a href="${nationalIdBackUrl}" target="_blank">View ID Back</a></li>
          <li><strong>Vehicle Type:</strong> ${vehicleType}</li>
          <li><strong>License Number:</strong> ${licenseNumber}</li>
        </ul>
        <p>Please review and approve this request in the admin panel.</p>
      </div>
    `,
  };

  // Email to Delivery Staff
  const userMailOptions = {
    from: this.configService.get('email.user'),
    to: email,
    subject: 'Delivery Staff Registration Received',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Registration Received</h2>
        <p>Dear ${firstName},</p>
        <p>Thank you for registering as a delivery staff. Your request has been received and is currently under review by our admin team.</p>
        <p>You will receive a confirmation email once your account is approved.</p>
        <p>Best regards,<br />Fareed.Developer</p>
      </div>
    `,
  };

  try {
    const adminResult = await this.transporter.sendMail(adminMailOptions);
    const userResult = await this.transporter.sendMail(userMailOptions);
    this.logger.log(`Registration notification sent to admin (${adminEmail}) and user (${email})`);
    return { adminResult, userResult };
  } catch (error) {
    this.logger.error('Error sending delivery staff registration emails', error);
    throw error;
  }
}

}