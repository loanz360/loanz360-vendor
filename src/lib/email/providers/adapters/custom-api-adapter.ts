/**
 * Custom API Email Provider Adapter
 * Flexible adapter for integrating any third-party email API
 * Supports various authentication methods and request formats
 */

import { BaseEmailProviderAdapter } from '../base-adapter';
import {
  EmailProviderType,
  ProviderCategory,
  ProviderCapabilities,
  SendEmailRequest,
  SendEmailResponse,
  HealthCheckResult,
} from '../types';
import crypto from 'crypto';

interface CustomConfig {
  authType: 'api_key' | 'bearer' | 'basic';
  authHeaderName: string;
  requestBodyFormat: 'json' | 'form';
  customHeaders?: Record<string, string>;

  // Field mappings (how to map our fields to the API's expected fields)
  fieldMappings?: {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    attachments?: string;
    replyTo?: string;
  };

  // Response parsing
  responseMessageIdPath?: string; // JSON path to message ID in response
  successStatusCodes?: number[];

  // Health check endpoint
  healthCheckEndpoint?: string;
  healthCheckMethod?: 'GET' | 'POST';
}

const DEFAULT_FIELD_MAPPINGS = {
  from: 'from',
  to: 'to',
  cc: 'cc',
  bcc: 'bcc',
  subject: 'subject',
  bodyText: 'text',
  bodyHtml: 'html',
  attachments: 'attachments',
  replyTo: 'reply_to',
};

export class CustomAPIAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'custom_api';
  readonly providerType: ProviderCategory = 'transactional';
  readonly capabilities: ProviderCapabilities = {
    canSendEmail: true,
    canReceiveEmail: false,
    canManageAccounts: false,
    canManageFolders: false,
    canSearchEmails: false,
    supportsOAuth: false,
    supportsWebhooks: false,
    supportsTracking: false,
    supportsTemplates: false,
    supportsAttachments: true,
    supportsBulkSend: true,
    supportsScheduledSend: false,
    maxAttachmentSize: 25 * 1024 * 1024,
    maxRecipientsPerEmail: 100,
    maxEmailsPerBatch: 50,
    defaultRateLimitPerSecond: 10,
    defaultRateLimitPerMinute: 100,
    defaultRateLimitPerHour: 1000,
    defaultRateLimitPerDay: 10000,
  };

  private config: CustomConfig = {
    authType: 'api_key',
    authHeaderName: 'X-API-Key',
    requestBodyFormat: 'json',
  };

  protected async onInitialize(): Promise<void> {
    if (!this.credentials?.apiEndpoint) {
      throw new Error('API endpoint is required for custom API adapter');
    }
    if (!this.credentials?.apiKey) {
      throw new Error('API key is required for custom API adapter');
    }

    // Parse custom config
    if (this.credentials.customConfig) {
      this.config = {
        ...this.config,
        ...(this.credentials.customConfig as CustomConfig),
      };
    }
  }

  protected async performCredentialValidation(): Promise<boolean> {
    try {
      const healthResult = await this.healthCheck();
      return healthResult.healthy;
    } catch (error) {
      this.log('error', 'Custom API credential validation failed', { error });
      return false;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const healthEndpoint = this.config.healthCheckEndpoint || this.credentials?.apiEndpoint;
      const method = this.config.healthCheckMethod || 'GET';

      const response = await fetch(healthEndpoint!, {
        method,
        headers: this.buildHeaders(),
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          status: 'healthy',
          latencyMs,
          message: 'Custom API is accessible',
          checkedAt: new Date(),
        };
      }

      return {
        healthy: false,
        status: response.status >= 500 ? 'down' : 'degraded',
        latencyMs,
        message: `API returned ${response.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        latencyMs: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Health check failed',
        checkedAt: new Date(),
      };
    }
  }

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.ensureInitialized();

    try {
      const payload = this.buildRequestPayload(request);
      const headers = this.buildHeaders();

      let body: string | FormData;
      if (this.config.requestBodyFormat === 'form') {
        body = this.buildFormData(payload);
        // Remove Content-Type header for FormData (browser sets it automatically with boundary)
        delete headers['Content-Type'];
      } else {
        body = JSON.stringify(payload);
      }

      const response = await fetch(this.credentials!.apiEndpoint!, {
        method: 'POST',
        headers,
        body,
      });

      const responseText = await response.text();
      let responseData: Record<string, unknown> = {};

      try {
        responseData = JSON.parse(responseText);
      } catch {
        // Response is not JSON
      }

      const successCodes = this.config.successStatusCodes || [200, 201, 202];

      if (successCodes.includes(response.status)) {
        const messageId = this.extractMessageId(responseData);

        return {
          success: true,
          messageId,
          providerMessageId: messageId,
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: responseData.error as string || responseData.message as string || responseText,
        errorCode: `HTTP_${response.status}`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.log('error', 'Failed to send email via custom API', { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        errorCode: 'CUSTOM_API_ERROR',
        timestamp: new Date(),
      };
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.customHeaders,
    };

    // Add authentication header
    switch (this.config.authType) {
      case 'api_key':
        headers[this.config.authHeaderName] = this.credentials!.apiKey!;
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${this.credentials!.apiKey}`;
        break;
      case 'basic':
        const auth = Buffer.from(
          `${this.credentials!.apiKey}:${this.credentials!.apiSecret || ''}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
        break;
    }

    return headers;
  }

  private buildRequestPayload(request: SendEmailRequest): Record<string, unknown> {
    const mappings = {
      ...DEFAULT_FIELD_MAPPINGS,
      ...this.config.fieldMappings,
    };

    const payload: Record<string, unknown> = {};

    // Map fields using configured mappings
    if (request.from) {
      payload[mappings.from] = request.from;
    }

    payload[mappings.to] = Array.isArray(request.to) ? request.to : [request.to];

    if (request.cc && request.cc.length > 0) {
      payload[mappings.cc] = request.cc;
    }

    if (request.bcc && request.bcc.length > 0) {
      payload[mappings.bcc] = request.bcc;
    }

    payload[mappings.subject] = request.subject;

    if (request.bodyText) {
      payload[mappings.bodyText] = request.bodyText;
    }

    if (request.bodyHtml) {
      payload[mappings.bodyHtml] = request.bodyHtml;
    }

    if (request.replyTo) {
      payload[mappings.replyTo] = request.replyTo;
    }

    if (request.attachments && request.attachments.length > 0) {
      payload[mappings.attachments] = request.attachments.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string'
          ? att.content
          : Buffer.from(att.content).toString('base64'),
        content_type: att.contentType,
      }));
    }

    // Add any metadata
    if (request.metadata) {
      payload['metadata'] = request.metadata;
    }

    return payload;
  }

  private buildFormData(payload: Record<string, unknown>): FormData {
    const formData = new FormData();

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object') {
            formData.append(key, JSON.stringify(item));
          } else {
            formData.append(key, String(item));
          }
        }
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }

    return formData;
  }

  private extractMessageId(response: Record<string, unknown>): string | undefined {
    if (!this.config.responseMessageIdPath) {
      // Try common paths
      const commonPaths = ['id', 'message_id', 'messageId', 'data.id', 'result.id'];

      for (const path of commonPaths) {
        const value = this.getNestedValue(response, path);
        if (value) return String(value);
      }

      return undefined;
    }

    const value = this.getNestedValue(response, this.config.responseMessageIdPath);
    return value ? String(value) : undefined;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Static method to create a custom adapter configuration
   * This can be used by the UI to help users configure custom providers
   */
  static createConfigTemplate(
    apiEndpoint: string,
    authType: 'api_key' | 'bearer' | 'basic',
    options?: Partial<CustomConfig>
  ): CustomConfig {
    return {
      authType,
      authHeaderName: authType === 'api_key' ? 'X-API-Key' : 'Authorization',
      requestBodyFormat: 'json',
      successStatusCodes: [200, 201, 202],
      ...options,
    };
  }
}

/**
 * Factory function to create a pre-configured custom adapter
 * for common third-party email services not yet officially supported
 */
export function createCustomAdapter(
  serviceName: string,
  config: {
    apiEndpoint: string;
    apiKey: string;
    apiSecret?: string;
    authType?: 'api_key' | 'bearer' | 'basic';
    authHeaderName?: string;
    fieldMappings?: CustomConfig['fieldMappings'];
    customHeaders?: Record<string, string>;
  }
): CustomAPIAdapter {
  const adapter = new CustomAPIAdapter();

  adapter.initialize({
    id: `custom_${serviceName}_${Date.now()}`,
    providerName: 'custom_api',
    providerType: 'transactional',
    displayName: serviceName,
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    apiEndpoint: config.apiEndpoint,
    isActive: true,
    isPrimary: false,
    isVerified: false,
    healthStatus: 'unknown',
    priority: 100,
    customConfig: {
      authType: config.authType || 'api_key',
      authHeaderName: config.authHeaderName || 'X-API-Key',
      requestBodyFormat: 'json',
      fieldMappings: config.fieldMappings,
      customHeaders: config.customHeaders,
    } as CustomConfig,
  });

  return adapter;
}
