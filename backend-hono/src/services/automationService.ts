import type { Env, AutomationRule, AutomationTriggerEvent } from '../types';
import axios from 'axios';

export class AutomationService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Replace variables in message template with actual data
   */
  replaceVariables(template: string, rowData: { [key: string]: any }): string {
    let message = template;
    
    // Replace #{columnName} with actual values
    const variablePattern = /#\{([^}]+)\}/g;
    message = message.replace(variablePattern, (match, columnName) => {
      const value = rowData[columnName];
      return value !== undefined ? String(value) : match;
    });

    return message;
  }

  /**
   * Check if trigger condition is met
   */
  checkCondition(rule: AutomationRule, oldValue: string, newValue: string): boolean {
    const { operator, triggerValue } = rule.conditions;

    switch (operator) {
      case 'equals':
        return newValue === triggerValue;
      case 'contains':
        return newValue.includes(triggerValue);
      case 'changes_to':
        return oldValue !== newValue && newValue === triggerValue;
      default:
        return false;
    }
  }

  /**
   * Calculate message byte size (Korean characters = 2 bytes, ASCII = 1 byte)
   */
  calculateMessageBytes(message: string): number {
    let bytes = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charAt(i);
      // Korean characters (Hangul), Chinese, Japanese characters = 2 bytes
      if (char >= '\u0080') {
        bytes += 2;
      } else {
        bytes += 1;
      }
    }
    return bytes;
  }

  /**
   * Send SMS/LMS message using SOLAPI (auto-detect based on message byte size)
   */
  async sendSMS(
    accessToken: string,
    senderNumber: string,
    recipientNumber: string,
    message: string
  ): Promise<boolean> {
    try {
      // Auto-detect message type based on byte size
      // SMS: up to 90 bytes (SOLAPI standard)
      // LMS: 91+ bytes (up to 2000 bytes)
      const messageBytes = this.calculateMessageBytes(message);
      const messageType = messageBytes <= 90 ? 'SMS' : 'LMS';
      
      console.log(`Message length: ${message.length} characters (${messageBytes} bytes), using ${messageType}`);

      const response = await axios.post(
        'https://api.solapi.com/messages/v4/send',
        {
          message: {
            type: messageType,
            from: senderNumber.replace(/-/g, ''),
            to: recipientNumber.replace(/-/g, ''),
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          // Skip SSL verification for development
          ...(process.env.NODE_ENV === 'development' && {
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false
            })
          })
        }
      );

      console.log(`${messageType} sent successfully:`, {
        messageId: response.data.messageId,
        statusCode: response.data.statusCode,
        messageLength: message.length,
        messageBytes: messageBytes,
        messageType: messageType
      });

      return true;
    } catch (error: any) {
      console.error(`Failed to send ${messageType}:`, error);
      console.error('SOLAPI error details:', error.response?.data);
      return false;
    }
  }

  /**
   * Send KakaoTalk message using SOLAPI
   */
  async sendKakaoTalk(
    accessToken: string,
    senderNumber: string,
    recipientNumber: string,
    message: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://api.solapi.com/messages/v4/send',
        {
          message: {
            type: 'ATA', // KakaoTalk Alimtalk
            from: senderNumber.replace(/-/g, ''),
            to: recipientNumber.replace(/-/g, ''),
            text: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          // Skip SSL verification for development
          ...(process.env.NODE_ENV === 'development' && {
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false
            })
          })
        }
      );

      console.log('KakaoTalk sent successfully:', {
        messageId: response.data.messageId,
        statusCode: response.data.statusCode
      });

      return true;
    } catch (error: any) {
      console.error('Failed to send KakaoTalk:', error);
      // Fallback to SMS if KakaoTalk fails
      console.log('Falling back to SMS...');
      return await this.sendSMS(accessToken, senderNumber, recipientNumber, message);
    }
  }

  /**
   * Execute automation action
   */
  async executeAction(
    rule: AutomationRule,
    rowData: { [key: string]: any },
    solapiAccessToken?: string
  ): Promise<boolean> {
    try {
      if (!solapiAccessToken) {
        console.error('SOLAPI access token is required for automation actions');
        return false;
      }

      const { actions } = rule;
      const { type, senderNumber, recipientColumn, messageTemplate } = actions;

      // Get recipient number from row data
      const recipientNumber = rowData[recipientColumn];
      if (!recipientNumber) {
        console.error(`Recipient number not found in column: ${recipientColumn}`);
        return false;
      }

      // Replace variables in message template
      const message = this.replaceVariables(messageTemplate, rowData);

      // Send message based on type
      let success = false;
      if (type === 'sms') {
        success = await this.sendSMS(solapiAccessToken, senderNumber, recipientNumber, message);
      } else if (type === 'kakao') {
        success = await this.sendKakaoTalk(solapiAccessToken, senderNumber, recipientNumber, message);
      }

      if (success) {
        console.log(`Automation executed successfully: ${rule.name}`);
        console.log(`Message sent to ${recipientNumber}: ${message}`);
      }

      return success;
    } catch (error: any) {
      console.error('Failed to execute automation action:', error);
      return false;
    }
  }

  /**
   * Process automation trigger event
   */
  async processTriggerEvent(
    event: AutomationTriggerEvent,
    rules: AutomationRule[],
    solapiAccessToken?: string
  ): Promise<void> {
    try {
      console.log('Processing trigger event:', event);

      for (const rule of rules) {
        if (!rule.enabled) {
          continue;
        }

        // Check if this rule matches the column that changed
        if (rule.conditions.columnName !== event.columnName) {
          continue;
        }

        // Check if condition is met
        if (this.checkCondition(rule, event.oldValue, event.newValue)) {
          console.log(`Automation rule triggered: ${rule.name}`);
          
          const success = await this.executeAction(rule, event.rowData, solapiAccessToken);
          
          if (success) {
            console.log(`Automation rule executed successfully: ${rule.name}`);
          } else {
            console.error(`Failed to execute automation rule: ${rule.name}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to process trigger event:', error);
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^01[0-9]{8,9}$/;
    return phoneRegex.test(phoneNumber.replace(/-/g, ''));
  }

  /**
   * Get available sheet columns from session data
   */
  async getSheetColumns(sessionData: any): Promise<string[]> {
    try {
      // Extract columns from Google Sheets data
      const headers = sessionData.lastSheetHeaders || [];
      return headers;
    } catch (error) {
      console.error('Failed to get sheet columns:', error);
      return [];
    }
  }
}