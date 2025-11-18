import * as nodemailer from 'nodemailer';
import mjml from 'mjml'; // Change this import
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TemplateVariables {
  [key: string]: any;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly templatesDir: string;
  private readonly compiledTemplatesDir: string;

  constructor(private configService: ConfigService) {
    // Setting up template directories
    this.templatesDir = path.join(process.cwd(), 'src', 'templates');
    this.compiledTemplatesDir = path.join(
      process.cwd(),
      'dist',
      'compiled-templates',
    );

    // Ensuring compiled templates directory exist
    if (!fs.existsSync(this.compiledTemplatesDir)) {
      fs.mkdirSync(this.compiledTemplatesDir, { recursive: true });
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.get('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: false,
      auth: {
        user: this.configService.get('email.user'),
        pass: this.configService.get('email.pass'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

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

  private compileTemplate(
    templateName: string,
    variables: TemplateVariables = {},
  ): string {
    try {
      // Path to MJML template
      const templatePath = path.join(this.templatesDir, `${templateName}.mjml`);

      // Path where compiled HTML will be saved
      const compiledTemplatePath = path.join(
        this.compiledTemplatesDir,
        `${templateName}.html`,
      );

      if (!fs.existsSync(templatePath)) {
        throw new Error(
          `Template ${templateName}.mjml not found at ${templatePath}`,
        );
      }

      // this.logger.log(`Using template at: ${templatePath}`);

      let mjmlContent = fs.readFileSync(templatePath, 'utf-8');

      // Simple variable replacement
      Object.keys(variables).forEach((key) => {
        const value = variables[key];

        // Replace {{variableName}}
        const simpleRegex = new RegExp(`{{${key}}}`, 'g');
        mjmlContent = mjmlContent.replace(simpleRegex, String(value));

        // Handle conditionals {{#if key}}...{{/if}}
        if (typeof value === 'boolean') {
          const ifRegex = new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'g');
          mjmlContent = mjmlContent.replace(ifRegex, value ? '$1' : '');
        }
      });

      // Removing unused handlebars-style expressions
      mjmlContent = mjmlContent.replace(/{{[^}]*}}/g, '');

      // Compile MJML to HTML - Fixed import usage
      const compilationResult = mjml(mjmlContent);

      if (compilationResult.errors && compilationResult.errors.length > 0) {
        this.logger.warn(
          `MJML compilation warnings for ${templateName}:`,
          compilationResult.errors,
        );
      }

      const html = compilationResult.html;

      try {
        fs.writeFileSync(compiledTemplatePath, html, 'utf-8');
        this.logger.log(`Compiled template saved to: ${compiledTemplatePath}`);
      } catch (writeError) {
        this.logger.warn(
          `Failed to save compiled template to ${compiledTemplatePath}:`,
          writeError,
        );
      }

      return html;
    } catch (error) {
      this.logger.error(`Failed to compile template ${templateName}:`, error);
      throw error;
    }
  }

  async sendTemplateEmail(
    to: string,
    subject: string,
    templateName: string,
    variables: TemplateVariables = {},
  ) {
    try {
      const html = this.compileTemplate(templateName, variables);

      const mailOptions = {
        from: this.configService.get('email.user'),
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${to} using template ${templateName}`,
        result.messageId,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to} using template ${templateName}:`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    role: string,
    status: string,
  ) {
    return this.sendTemplateEmail(
      to,
      'Welcome to Our Platform',
      'welcome-user',
      {
        name,
        email: to,
        role,
        status,
        isPendingApproval: status === 'pending_approval',
      },
    );
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    userName: string,
  ) {
    const resetLink = `${this.configService.get(
      'app.frontendUrl',
      'http://localhost:3000',
    )}/reset-password?token=${resetToken}`;

    return this.sendTemplateEmail(
      to,
      'Password Reset Request',
      'password-reset',
      {
        userName,
        resetLink,
      },
    );
  }

  async sendDeliveryStaffRegistrationToAdmin(
    adminEmail: string,
    deliveryStaff: any,
  ) {
    return this.sendTemplateEmail(
      adminEmail,
      'New Delivery Staff Registration Request',
      'delivery-staff-registration-admin',
      deliveryStaff,
    );
  }

  async sendDeliveryStaffConfirmation(to: string, firstName: string) {
    return this.sendTemplateEmail(
      to,
      'Registration Received - Under Review',
      'delivery-staff-confirmation',
      { firstName },
    );
  }

  async sendUserStatusUpdateEmail(
    to: string,
    userName: string,
    oldStatus: string,
    newStatus: string,
  ) {
    return this.sendTemplateEmail(
      to,
      'Account Status Update',
      'user-status-updated',
      {
        userName,
        oldStatus,
        newStatus,
        isApproved: newStatus === 'active',
        isSuspended: newStatus === 'suspended',
      },
    );
  }

  getCompiledTemplatePath(templateName: string): string {
    return path.join(this.compiledTemplatesDir, `${templateName}.html`);
  }

  hasCompiledTemplate(templateName: string): boolean {
    const compiledPath = this.getCompiledTemplatePath(templateName);
    return fs.existsSync(compiledPath);
  }

  // Order confirmation email
  async sendOrderConfirmationEmail(
    to: string,
    orderDetails: {
      orderNumber: string;
      customerName: string;
      items: Array<{
        menuItemName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      totalAmount: number;
      deliveryAddress: string;
      paymentMethod: string;
    },
  ) {
    return this.sendTemplateEmail(
      to,
      `Order Confirmation - ${orderDetails.orderNumber}`,
      'order-confirmation',
      {
        ...orderDetails,
        itemsHtml: orderDetails.items
          .map(
            (item) =>
              `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.menuItemName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">UGX ${item.unitPrice.toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">UGX ${item.totalPrice.toLocaleString()}</td>
        </tr>`,
          )
          .join(''),
        formattedTotalAmount: `UGX ${orderDetails.totalAmount.toLocaleString()}`,
      },
    );
  }

  // Order status update email
  async sendOrderStatusUpdateEmail(
    to: string,
    statusDetails: {
      orderNumber: string;
      customerName: string;
      oldStatus: string;
      newStatus: string;
      deliveryStaffName?: string;
      estimatedDeliveryTime?: Date;
      actualDeliveryTime?: Date;
    },
  ) {
    const statusMessages = {
      pending: 'Your order has been received and is being processed.',
      confirmed: 'Your order has been confirmed and will be prepared shortly.',
      preparing: 'Your delicious meal is being prepared by our chefs.',
      ready: 'Your order is ready! Our delivery team will pick it up soon.',
      out_for_delivery: 'Your order is on its way to you!',
      delivered: 'Your order has been delivered. Enjoy your meal!',
      cancelled: 'Your order has been cancelled.',
    };

    return this.sendTemplateEmail(
      to,
      `Order Update - ${statusDetails.orderNumber}`,
      'order-status-update',
      {
        ...statusDetails,
        statusMessage:
          statusMessages[statusDetails.newStatus] ||
          'Your order status has been updated.',
        isOutForDelivery: statusDetails.newStatus === 'out_for_delivery',
        isDelivered: statusDetails.newStatus === 'delivered',
        isCancelled: statusDetails.newStatus === 'cancelled',
        hasDeliveryStaff: !!statusDetails.deliveryStaffName,
        estimatedDeliveryTimeFormatted:
          statusDetails.estimatedDeliveryTime?.toLocaleString(),
        actualDeliveryTimeFormatted:
          statusDetails.actualDeliveryTime?.toLocaleString(),
      },
    );
  }

  // Order cancellation email
  async sendOrderCancellationEmail(
    to: string,
    cancellationDetails: {
      orderNumber: string;
      customerName: string;
      reason?: string;
    },
  ) {
    return this.sendTemplateEmail(
      to,
      `Order Cancelled - ${cancellationDetails.orderNumber}`,
      'order-cancellation',
      {
        ...cancellationDetails,
        hasReason: !!cancellationDetails.reason,
      },
    );
  }

  // Payment confirmation email
  async sendPaymentConfirmationEmail(
    customerEmail: string,
    paymentDetails: {
      orderNumber: string;
      customerName: string;
      totalAmount: number;
      paymentMethod: string;
      transactionId?: string;
    },
  ) {
    return this.sendTemplateEmail(
      customerEmail,
      `Payment Confirmed - ${paymentDetails.orderNumber}`,
      'payment-confirmation',
      {
        ...paymentDetails,
        formattedAmount: `UGX ${paymentDetails.totalAmount.toLocaleString()}`,
        hasTransactionId: !!paymentDetails.transactionId,
      },
    );
  }

  // Payment failed email
  async sendPaymentFailedEmail(
    customerEmail: string,
    paymentDetails: {
      orderNumber: string;
      customerName: string;
      totalAmount: number;
    },
  ) {
    return this.sendTemplateEmail(
      customerEmail,
      `Payment Failed - ${paymentDetails.orderNumber}`,
      'payment-failed',
      {
        ...paymentDetails,
        formattedAmount: `UGX ${paymentDetails.totalAmount.toLocaleString()}`,
      },
    );
  }

  // New order notification to staff
  async sendNewOrderNotificationToStaff(
    staffEmail: string,
    orderDetails: {
      staffName: string;
      orderNumber: string;
      customerName: string;
      totalAmount: number;
      itemsCount: number;
    },
  ) {
    return this.sendTemplateEmail(
      staffEmail,
      `New Order Received - ${orderDetails.orderNumber}`,
      'new-order-staff-notification',
      {
        ...orderDetails,
        formattedAmount: `UGX ${orderDetails.totalAmount.toLocaleString()}`,
      },
    );
  }

  // Delivery assignment notification
  async sendDeliveryAssignmentNotification(
    deliveryStaffEmail: string,
    assignmentDetails: {
      deliveryStaffName: string;
      orderNumber: string;
      customerName: string;
      deliveryAddress: string;
      estimatedDeliveryTime?: Date;
    },
  ) {
    return this.sendTemplateEmail(
      deliveryStaffEmail,
      `Delivery Assignment - ${assignmentDetails.orderNumber}`,
      'delivery-assignment',
      {
        ...assignmentDetails,
        estimatedTimeFormatted:
          assignmentDetails.estimatedDeliveryTime?.toLocaleString(),
      },
    );
  }

  // Low stock alert to admin
  async sendLowStockAlert(
    adminEmail: string,
    stockDetails: {
      menuItemName: string;
      currentStock: number;
      menuItemId: number;
    },
  ) {
    return this.sendTemplateEmail(
      adminEmail,
      `Low Stock Alert - ${stockDetails.menuItemName}`,
      'low-stock-alert',
      stockDetails,
    );
  }
  // Payment cancellation email
  async sendPaymentCancelledEmail(
    customerEmail: string,
    cancellationDetails: {
      orderNumber: string;
      customerName: string;
      paymentReference: string;
      amount: number;
      reason: string;
    },
  ) {
    return this.sendTemplateEmail(
      customerEmail,
      `Payment Cancelled - ${cancellationDetails.orderNumber}`,
      'payment-cancelled',
      {
        ...cancellationDetails,
        formattedAmount: `UGX ${cancellationDetails.amount.toLocaleString()}`,
      },
    );
  }

  // Payment refund email
  async sendPaymentRefundEmail(
    customerEmail: string,
    refundDetails: {
      orderNumber: string;
      customerName: string;
      paymentReference: string;
      originalAmount: number;
      refundAmount: number;
      totalRefunded: number;
      isFullyRefunded: boolean;
      reason: string;
    },
  ) {
    return this.sendTemplateEmail(
      customerEmail,
      `Payment Refund - ${refundDetails.orderNumber}`,
      'payment-refund',
      {
        ...refundDetails,
        formattedOriginalAmount: `UGX ${refundDetails.originalAmount.toLocaleString()}`,
        formattedRefundAmount: `UGX ${refundDetails.refundAmount.toLocaleString()}`,
        formattedTotalRefunded: `UGX ${refundDetails.totalRefunded.toLocaleString()}`,
      },
    );
  }

  // Payment initiated email (optional)
  async sendPaymentInitiatedEmail(
    customerEmail: string,
    paymentDetails: {
      customerName: string;
      orderNumber: string;
      paymentReference: string;
      amount: number;
      paymentMethod: string;
    },
  ) {
    return this.sendTemplateEmail(
      customerEmail,
      `Payment Initiated - ${paymentDetails.orderNumber}`,
      'payment-initiated',
      {
        ...paymentDetails,
        formattedAmount: `UGX ${paymentDetails.amount.toLocaleString()}`,
      },
    );
  }
}
