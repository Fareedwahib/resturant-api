import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MobileMoneyProvider } from './entities/payment.entity';

export interface MobileMoneyTransaction {
  success: boolean;
  transactionId?: string;
  reference?: string;
  message: string;
  error?: string;
  provider: MobileMoneyProvider;
}

@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);

  constructor(private configService: ConfigService) {}

  async initiateMTNPayment(
    phoneNumber: string,
    amount: number,
    reference: string,
    description: string
  ): Promise<MobileMoneyTransaction> {
    try {
      // MTN MoMo API integration
      const mtnApiKey = this.configService.get('MTN_API_KEY');
      const mtnSubscriptionKey = this.configService.get('MTN_SUBSCRIPTION_KEY');
      
      if (!mtnApiKey || !mtnSubscriptionKey) {
        this.logger.warn('MTN MoMo credentials not configured');
        return this.simulateTransaction(MobileMoneyProvider.MTN);
      }

      // Real MTN MoMo API call would go here
      // const response = await fetch('https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${mtnApiKey}`,
      //     'X-Reference-Id': reference,
      //     'X-Target-Environment': 'sandbox',
      //     'Ocp-Apim-Subscription-Key': mtnSubscriptionKey,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     amount: amount.toString(),
      //     currency: 'UGX',
      //     externalId: reference,
      //     payer: {
      //       partyIdType: 'MSISDN',
      //       partyId: phoneNumber
      //     },
      //     payerMessage: description,
      //     payeeNote: description
      //   })
      // });

      // For now, simulate the transaction
      return this.simulateTransaction(MobileMoneyProvider.MTN);

    } catch (error) {
      this.logger.error('MTN payment failed:', error);
      return {
        success: false,
        message: 'MTN payment initiation failed',
        error: error.message,
        provider: MobileMoneyProvider.MTN,
      };
    }
  }

  async initiateAirtelPayment(
    phoneNumber: string,
    amount: number,
    reference: string,
    description: string
  ): Promise<MobileMoneyTransaction> {
    try {
      // Airtel Money API integration
      const airtelApiKey = this.configService.get('AIRTEL_API_KEY');
      
      if (!airtelApiKey) {
        this.logger.warn('Airtel Money credentials not configured');
        return this.simulateTransaction(MobileMoneyProvider.AIRTEL);
      }

      // Real Airtel Money API call would go here
      // Implementation similar to MTN but with Airtel's API structure
      
      return this.simulateTransaction(MobileMoneyProvider.AIRTEL);

    } catch (error) {
      this.logger.error('Airtel payment failed:', error);
      return {
        success: false,
        message: 'Airtel payment initiation failed',
        error: error.message,
        provider: MobileMoneyProvider.AIRTEL,
      };
    }
  }

  async checkTransactionStatus(
    provider: MobileMoneyProvider,
    transactionId: string
  ): Promise<MobileMoneyTransaction> {
    switch (provider) {
      case MobileMoneyProvider.MTN:
        return await this.checkMTNTransactionStatus(transactionId);
      case MobileMoneyProvider.AIRTEL:
        return await this.checkAirtelTransactionStatus(transactionId);
    
      default:
        throw new BadRequestException('Unsupported mobile money provider');
    }
  }

  private async checkMTNTransactionStatus(transactionId: string): Promise<MobileMoneyTransaction> {
    try {
      // Real MTN status check API call would go here
      // For now, simulate response
      return this.simulateStatusCheck(MobileMoneyProvider.MTN, transactionId);
    } catch (error) {
      this.logger.error('MTN status check failed:', error);
      return {
        success: false,
        message: 'Failed to check MTN transaction status',
        error: error.message,
        provider: MobileMoneyProvider.MTN,
      };
    }
  }

  private async checkAirtelTransactionStatus(transactionId: string): Promise<MobileMoneyTransaction> {
    try {
      // Real Airtel status check API call would go here
      return this.simulateStatusCheck(MobileMoneyProvider.AIRTEL, transactionId);
    } catch (error) {
      this.logger.error('Airtel status check failed:', error);
      return {
        success: false,
        message: 'Failed to check Airtel transaction status',
        error: error.message,
        provider: MobileMoneyProvider.AIRTEL,
      };
    }
  }


  private simulateTransaction(provider: MobileMoneyProvider): MobileMoneyTransaction {
    // Simulate different success rates for different providers
    const successRates = {
      [MobileMoneyProvider.MTN]: 0.92,
      [MobileMoneyProvider.AIRTEL]: 0.88,
    };

    const success = Math.random() < successRates[provider];

    if (success) {
      return {
        success: true,
        transactionId: `${provider.toUpperCase()}${Date.now()}${Math.floor(Math.random() * 1000)}`,
        reference: `REF${Date.now()}`,
        message: `${provider.toUpperCase()} payment successful`,
        provider,
      };
    } else {
      const errors = [
        'Insufficient funds',
        'Invalid phone number',
        'Transaction timeout',
        'Service temporarily unavailable',
        'User cancelled transaction',
      ];

      return {
        success: false,
        message: `${provider.toUpperCase()} payment failed`,
        error: errors[Math.floor(Math.random() * errors.length)],
        provider,
      };
    }
  }

  private simulateStatusCheck(provider: MobileMoneyProvider, transactionId: string): MobileMoneyTransaction {
    // Simulate status check - in real implementation, you'd query the provider's API
    const statuses = ['completed', 'pending', 'failed'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      success: status === 'completed',
      transactionId,
      message: `Transaction ${status}`,
      provider,
    };
  }

  validatePhoneNumber(phoneNumber: string, provider: MobileMoneyProvider): boolean {
    // Remove any formatting
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    switch (provider) {
      case MobileMoneyProvider.MTN:
        // MTN Uganda numbers: 077, 078, 039
        return /^(256)?(77|78|39)\d{7}$/.test(cleanPhone);
      case MobileMoneyProvider.AIRTEL:
        // Airtel Uganda numbers: 070, 075, 020
        return /^(256)?(70|75|20)\d{7}$/.test(cleanPhone);
      default:
        return false;
    }
  }

  formatPhoneNumber(phoneNumber: string): string {
    let formatted = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    if (formatted.startsWith('0')) {
      formatted = '256' + formatted.substring(1);
    } else if (!formatted.startsWith('256')) {
      formatted = '256' + formatted;
    }
    
    return formatted;
  }
}