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
    this.compiledTemplatesDir = path.join(process.cwd(), 'dist', 'compiled-templates');

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

  private compileTemplate(templateName: string, variables: TemplateVariables = {}): string {
    try {
      // Path to MJML template
      const templatePath = path.join(this.templatesDir, `${templateName}.mjml`);

      // Path where compiled HTML will be saved
      const compiledTemplatePath = path.join(this.compiledTemplatesDir, `${templateName}.html`);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template ${templateName}.mjml not found at ${templatePath}`);
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
        this.logger.warn(`MJML compilation warnings for ${templateName}:`, compilationResult.errors);
      }

      const html = compilationResult.html;

      try {
        fs.writeFileSync(compiledTemplatePath, html, 'utf-8');
        this.logger.log(`Compiled template saved to: ${compiledTemplatePath}`);
      } catch (writeError) {
        this.logger.warn(`Failed to save compiled template to ${compiledTemplatePath}:`, writeError);
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
      this.logger.error(`Failed to send email to ${to} using template ${templateName}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string, role: string, status: string) {
    return this.sendTemplateEmail(to, 'Welcome to Our Platform', 'welcome-user', {
      name,
      email: to,
      role,
      status,
      isPendingApproval: status === 'pending_approval',
    });
  }

  async sendPasswordResetEmail(to: string, resetToken: string, userName: string) {
    const resetLink = `${this.configService.get(
      'app.frontendUrl',
      'http://localhost:3000',
    )}/reset-password?token=${resetToken}`;

    return this.sendTemplateEmail(to, 'Password Reset Request', 'password-reset', {
      userName,
      resetLink,
    });
  }

  async sendDeliveryStaffRegistrationToAdmin(adminEmail: string, deliveryStaff: any) {
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
    return this.sendTemplateEmail(to, 'Account Status Update', 'user-status-updated', {
      userName,
      oldStatus,
      newStatus,
      isApproved: newStatus === 'active',
      isSuspended: newStatus === 'suspended',
    });
  }

  getCompiledTemplatePath(templateName: string): string {
    return path.join(this.compiledTemplatesDir, `${templateName}.html`);
  }

  hasCompiledTemplate(templateName: string): boolean {
    const compiledPath = this.getCompiledTemplatePath(templateName);
    return fs.existsSync(compiledPath);
  }
}