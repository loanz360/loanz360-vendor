/**
 * Base Email Provider Adapter
 * Abstract base class for all email provider implementations
 */

import {
  IEmailProviderAdapter,
  EmailProviderType,
  ProviderCategory,
  ProviderCapabilities,
  ProviderCredentials,
  SendEmailRequest,
  SendEmailResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  SuspendAccountRequest,
  DeleteAccountRequest,
  AccountQuotaInfo,
  HealthCheckResult,
  OAuthTokens,
  WebhookEvent,
} from './types';

/**
 * Abstract base class for email provider adapters
 * Provides common functionality and enforces consistent interface
 */
export abstract class BaseEmailProviderAdapter implements IEmailProviderAdapter {
  abstract readonly providerName: EmailProviderType;
  abstract readonly providerType: ProviderCategory;
  abstract readonly capabilities: ProviderCapabilities;

  protected credentials: ProviderCredentials | null = null;
  protected initialized: boolean = false;

  /**
   * Initialize the adapter with credentials
   */
  async initialize(credentials: ProviderCredentials): Promise<void> {
    this.credentials = credentials;
    await this.onInitialize();
    this.initialized = true;
  }

  /**
   * Hook for subclasses to perform additional initialization
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Ensure adapter is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this.initialized || !this.credentials) {
      throw new Error(`${this.providerName} adapter not initialized. Call initialize() first.`);
    }
  }

  /**
   * Validate that required credentials are present
   */
  async validateCredentials(): Promise<boolean> {
    this.ensureInitialized();
    return this.performCredentialValidation();
  }

  /**
   * Override in subclass to implement credential validation
   */
  protected abstract performCredentialValidation(): Promise<boolean>;

  /**
   * Perform health check on the provider
   */
  abstract healthCheck(): Promise<HealthCheckResult>;

  /**
   * Send a single email
   */
  abstract sendEmail(request: SendEmailRequest): Promise<SendEmailResponse>;

  /**
   * Send multiple emails in bulk (default implementation)
   */
  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // Default: send sequentially
    const results: SendEmailResponse[] = [];
    for (const request of requests) {
      const result = await this.sendEmail(request);
      results.push(result);
    }
    return results;
  }

  /**
   * Create a new email account (optional - for full email services)
   */
  async createAccount(request: CreateAccountRequest): Promise<CreateAccountResponse> {
    if (!this.capabilities.canManageAccounts) {
      return {
        success: false,
        error: `${this.providerName} does not support account management`,
      };
    }
    return this.performCreateAccount(request);
  }

  protected async performCreateAccount(request: CreateAccountRequest): Promise<CreateAccountResponse> {
    return {
      success: false,
      error: 'Account creation not implemented for this provider',
    };
  }

  /**
   * Suspend an email account
   */
  async suspendAccount(request: SuspendAccountRequest): Promise<boolean> {
    if (!this.capabilities.canManageAccounts) {
      throw new Error(`${this.providerName} does not support account management`);
    }
    return this.performSuspendAccount(request);
  }

  protected async performSuspendAccount(request: SuspendAccountRequest): Promise<boolean> {
    throw new Error('Account suspension not implemented for this provider');
  }

  /**
   * Activate a suspended account
   */
  async activateAccount(accountId: string): Promise<boolean> {
    if (!this.capabilities.canManageAccounts) {
      throw new Error(`${this.providerName} does not support account management`);
    }
    return this.performActivateAccount(accountId);
  }

  protected async performActivateAccount(accountId: string): Promise<boolean> {
    throw new Error('Account activation not implemented for this provider');
  }

  /**
   * Delete an email account
   */
  async deleteAccount(request: DeleteAccountRequest): Promise<boolean> {
    if (!this.capabilities.canManageAccounts) {
      throw new Error(`${this.providerName} does not support account management`);
    }
    return this.performDeleteAccount(request);
  }

  protected async performDeleteAccount(request: DeleteAccountRequest): Promise<boolean> {
    throw new Error('Account deletion not implemented for this provider');
  }

  /**
   * Get account quota information
   */
  async getAccountQuota(accountId: string): Promise<AccountQuotaInfo> {
    if (!this.capabilities.canManageAccounts) {
      throw new Error(`${this.providerName} does not support account management`);
    }
    return this.performGetAccountQuota(accountId);
  }

  protected async performGetAccountQuota(accountId: string): Promise<AccountQuotaInfo> {
    throw new Error('Account quota retrieval not implemented for this provider');
  }

  /**
   * Sync account quota from provider
   */
  async syncAccountQuota(accountId: string): Promise<AccountQuotaInfo> {
    return this.getAccountQuota(accountId);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state?: string): string {
    if (!this.capabilities.supportsOAuth) {
      throw new Error(`${this.providerName} does not support OAuth`);
    }
    return this.buildAuthorizationUrl(redirectUri, state);
  }

  protected buildAuthorizationUrl(redirectUri: string, state?: string): string {
    throw new Error('OAuth not implemented for this provider');
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.capabilities.supportsOAuth) {
      throw new Error(`${this.providerName} does not support OAuth`);
    }
    return this.performTokenExchange(code, redirectUri);
  }

  protected async performTokenExchange(code: string, redirectUri: string): Promise<OAuthTokens> {
    throw new Error('OAuth token exchange not implemented for this provider');
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(): Promise<OAuthTokens> {
    if (!this.capabilities.supportsOAuth) {
      throw new Error(`${this.providerName} does not support OAuth`);
    }
    return this.performTokenRefresh();
  }

  protected async performTokenRefresh(): Promise<OAuthTokens> {
    throw new Error('OAuth token refresh not implemented for this provider');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.capabilities.supportsWebhooks) {
      throw new Error(`${this.providerName} does not support webhooks`);
    }
    return this.performWebhookVerification(payload, signature);
  }

  protected performWebhookVerification(payload: string, signature: string): boolean {
    throw new Error('Webhook verification not implemented for this provider');
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): WebhookEvent {
    if (!this.capabilities.supportsWebhooks) {
      throw new Error(`${this.providerName} does not support webhooks`);
    }
    return this.performWebhookParsing(payload);
  }

  protected performWebhookParsing(payload: unknown): WebhookEvent {
    throw new Error('Webhook parsing not implemented for this provider');
  }

  /**
   * Helper to make HTTP requests with retry logic
   */
  protected async makeRequest<T>(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors
        if (error instanceof Error && error.message.includes('401')) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Helper for delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log provider operation
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    const prefix = `[${this.providerName.toUpperCase()}]`;
    const logData = { provider: this.providerName, ...data };

    switch (level) {
      case 'info':
        console.info(prefix, message, logData);
        break;
      case 'warn':
        console.warn(prefix, message, logData);
        break;
      case 'error':
        console.error(prefix, message, logData);
        break;
    }
  }
}
