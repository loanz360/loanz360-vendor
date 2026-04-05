/**
 * Zoho Mail Provider Adapter
 * Full email service adapter with account management capabilities
 *
 * Zoho Mail API Documentation:
 * - https://www.zoho.com/mail/help/api/
 * - https://www.zoho.com/mail/help/adminconsole/organization-api.html
 */

import { BaseEmailProviderAdapter } from '../base-adapter';
import {
  EmailProviderType,
  ProviderCategory,
  ProviderCapabilities,
  SendEmailRequest,
  SendEmailResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  SuspendAccountRequest,
  DeleteAccountRequest,
  AccountQuotaInfo,
  HealthCheckResult,
  OAuthTokens,
} from '../types';

// ============================================================================
// ZOHO API TYPES
// ============================================================================

interface ZohoApiResponse<T> {
  status: {
    code: number;
    description: string;
  };
  data?: T;
}

interface ZohoAccountResponse {
  accountId: string;
  emailId: string;
  primaryEmailAddress: string;
  displayName: string;
  status: 'active' | 'suspended' | 'deleted';
  quotaLimit: number;
  quotaUsed: number;
}

interface ZohoUserCreatePayload {
  primaryEmailAddress: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: string;
  quotaLimit?: number;
  [key: string]: unknown;
}

interface ZohoSendMailPayload {
  fromAddress: string;
  toAddress: string;
  ccAddress?: string;
  bccAddress?: string;
  subject: string;
  content?: string;
  mailFormat?: 'html' | 'plaintext';
  askReceipt?: 'yes' | 'no';
  [key: string]: unknown;
}

// ============================================================================
// ZOHO ADAPTER
// ============================================================================

export class ZohoAdapter extends BaseEmailProviderAdapter {
  readonly providerName: EmailProviderType = 'zoho';
  readonly providerType: ProviderCategory = 'email_service';
  readonly capabilities: ProviderCapabilities = {
    canSendEmail: true,
    canReceiveEmail: true,
    canManageAccounts: true,
    canManageFolders: true,
    canSearchEmails: true,
    supportsOAuth: true,
    supportsWebhooks: false, // Zoho uses polling
    supportsTracking: true,
    supportsTemplates: true,
    supportsAttachments: true,
    supportsBulkSend: true,
    supportsScheduledSend: true,
    maxAttachmentSize: 25 * 1024 * 1024, // 25MB
    maxRecipientsPerEmail: 100,
    maxEmailsPerBatch: 50,
    defaultRateLimitPerSecond: 1,
    defaultRateLimitPerMinute: 30,
    defaultRateLimitPerHour: 1000,
    defaultRateLimitPerDay: 5000,
  };

  private baseUrl: string = 'https://mail.zoho.com/api';
  private adminApiUrl: string = 'https://mail.zoho.com/api/organization';
  private accessToken: string | null = null;
  private organizationId: string | null = null;

  /**
   * Initialize Zoho adapter
   */
  protected async onInitialize(): Promise<void> {
    if (!this.credentials) return;

    // Set access token if available
    this.accessToken = this.credentials.oauthAccessToken || this.credentials.apiKey || null;

    // Get organization ID from config
    this.organizationId = (this.credentials.customConfig?.organizationId as string) || null;

    // Update base URL for different Zoho regions
    const region = (this.credentials.customConfig?.region as string) || 'com';
    if (region !== 'com') {
      this.baseUrl = `https://mail.zoho.${region}/api`;
      this.adminApiUrl = `https://mail.zoho.${region}/api/organization`;
    }
  }

  /**
   * Validate Zoho credentials
   */
  protected async performCredentialValidation(): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      // Try to get current account info
      const response = await this.makeZohoRequest<{ accountId: string }>('/accounts', 'GET');
      return !!response?.accountId;
    } catch {
      return false;
    }
  }

  /**
   * Health check for Zoho Mail
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      this.ensureInitialized();

      // Ping the API
      await this.makeZohoRequest<{ accountId: string }>('/accounts', 'GET');

      return {
        healthy: true,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        message: 'Zoho Mail API is responsive',
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

  /**
   * Send email via Zoho Mail API
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      this.ensureInitialized();

      // Get primary account ID
      const accountInfo = await this.makeZohoRequest<{ accountId: string }>('/accounts', 'GET');

      if (!accountInfo?.accountId) {
        return {
          success: false,
          error: 'Could not get Zoho account ID',
          timestamp: new Date(),
        };
      }

      const payload: ZohoSendMailPayload = {
        fromAddress: request.from || '',
        toAddress: request.to.join(','),
        subject: request.subject,
        content: request.bodyHtml || request.bodyText || '',
        mailFormat: request.bodyHtml ? 'html' : 'plaintext',
      };

      if (request.cc?.length) {
        payload.ccAddress = request.cc.join(',');
      }

      if (request.bcc?.length) {
        payload.bccAddress = request.bcc.join(',');
      }

      const response = await this.makeZohoRequest<{ messageId: string }>(
        `/accounts/${accountInfo.accountId}/messages`,
        'POST',
        payload
      );

      return {
        success: true,
        messageId: response?.messageId,
        providerMessageId: response?.messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // ACCOUNT MANAGEMENT
  // ============================================================================

  /**
   * Create a new user account in Zoho organization
   */
  protected async performCreateAccount(request: CreateAccountRequest): Promise<CreateAccountResponse> {
    try {
      this.ensureInitialized();

      if (!this.organizationId) {
        return {
          success: false,
          error: 'Organization ID not configured for account management',
        };
      }

      const payload: ZohoUserCreatePayload = {
        primaryEmailAddress: request.email,
        password: request.password || this.generateSecurePassword(),
        displayName: request.displayName,
        firstName: request.firstName,
        lastName: request.lastName,
        department: request.department,
        role: 'member',
        quotaLimit: request.storageQuotaMb ? request.storageQuotaMb * 1024 * 1024 : undefined,
      };

      const response = await this.makeZohoAdminRequest<ZohoAccountResponse>(
        `/${this.organizationId}/users`,
        'POST',
        payload
      );

      if (!response?.accountId) {
        return {
          success: false,
          error: 'Failed to create account - no account ID returned',
        };
      }

      return {
        success: true,
        accountId: response.accountId,
        providerAccountId: response.accountId,
        email: response.primaryEmailAddress,
      };
    } catch (error) {
      this.log('error', 'Failed to create Zoho account', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Account creation failed',
      };
    }
  }

  /**
   * Suspend a user account
   */
  protected async performSuspendAccount(request: SuspendAccountRequest): Promise<boolean> {
    try {
      this.ensureInitialized();

      if (!this.organizationId) {
        throw new Error('Organization ID not configured');
      }

      await this.makeZohoAdminRequest<void>(
        `/${this.organizationId}/users/${request.accountId}/suspend`,
        'POST',
        { reason: request.reason }
      );

      this.log('info', 'Account suspended', { accountId: request.accountId });
      return true;
    } catch (error) {
      this.log('error', 'Failed to suspend account', { accountId: request.accountId, error });
      return false;
    }
  }

  /**
   * Activate a suspended account
   */
  protected async performActivateAccount(accountId: string): Promise<boolean> {
    try {
      this.ensureInitialized();

      if (!this.organizationId) {
        throw new Error('Organization ID not configured');
      }

      await this.makeZohoAdminRequest<void>(
        `/${this.organizationId}/users/${accountId}/activate`,
        'POST'
      );

      this.log('info', 'Account activated', { accountId });
      return true;
    } catch (error) {
      this.log('error', 'Failed to activate account', { accountId, error });
      return false;
    }
  }

  /**
   * Delete a user account
   */
  protected async performDeleteAccount(request: DeleteAccountRequest): Promise<boolean> {
    try {
      this.ensureInitialized();

      if (!this.organizationId) {
        throw new Error('Organization ID not configured');
      }

      const endpoint = request.permanent
        ? `/${this.organizationId}/users/${request.accountId}/delete`
        : `/${this.organizationId}/users/${request.accountId}/disable`;

      await this.makeZohoAdminRequest<void>(endpoint, 'DELETE');

      this.log('info', 'Account deleted', { accountId: request.accountId, permanent: request.permanent });
      return true;
    } catch (error) {
      this.log('error', 'Failed to delete account', { accountId: request.accountId, error });
      return false;
    }
  }

  /**
   * Get account quota information
   */
  protected async performGetAccountQuota(accountId: string): Promise<AccountQuotaInfo> {
    try {
      this.ensureInitialized();

      if (!this.organizationId) {
        throw new Error('Organization ID not configured');
      }

      const response = await this.makeZohoAdminRequest<ZohoAccountResponse>(
        `/${this.organizationId}/users/${accountId}`,
        'GET'
      );

      if (!response) {
        throw new Error('Failed to get account quota');
      }

      const storageQuotaMb = Math.round(response.quotaLimit / (1024 * 1024));
      const storageUsedMb = Math.round(response.quotaUsed / (1024 * 1024));

      return {
        storageQuotaMb,
        storageUsedMb,
        storageUsedPercent: storageQuotaMb > 0 ? Math.round((storageUsedMb / storageQuotaMb) * 100) : 0,
        emailsSentToday: 0, // Zoho doesn't provide this directly
        dailySendLimit: 500, // Default Zoho limit
      };
    } catch (error) {
      this.log('error', 'Failed to get account quota', { accountId, error });
      throw error;
    }
  }

  // ============================================================================
  // OAUTH
  // ============================================================================

  /**
   * Build OAuth authorization URL
   */
  protected buildAuthorizationUrl(redirectUri: string, state?: string): string {
    if (!this.credentials?.oauthClientId) {
      throw new Error('OAuth client ID not configured');
    }

    const scopes = this.credentials.oauthScopes?.join(',') || 'ZohoMail.messages.ALL,ZohoMail.accounts.READ';

    const params = new URLSearchParams({
      client_id: this.credentials.oauthClientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      access_type: 'offline',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  protected async performTokenExchange(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.credentials?.oauthClientId || !this.credentials?.oauthClientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.credentials.oauthClientId,
        client_secret: this.credentials.oauthClientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh access token
   */
  protected async performTokenRefresh(): Promise<OAuthTokens> {
    if (!this.credentials?.oauthClientId || !this.credentials?.oauthClientSecret || !this.credentials?.oauthRefreshToken) {
      throw new Error('OAuth credentials or refresh token not available');
    }

    const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.credentials.oauthClientId,
        client_secret: this.credentials.oauthClientSecret,
        refresh_token: this.credentials.oauthRefreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const data = await response.json();

    // Update stored access token
    this.accessToken = data.access_token;

    return {
      accessToken: data.access_token,
      refreshToken: this.credentials.oauthRefreshToken, // Keep existing refresh token
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Make authenticated request to Zoho Mail API
   */
  private async makeZohoRequest<T>(
    endpoint: string,
    method: string,
    body?: Record<string, unknown>
  ): Promise<T | null> {
    if (!this.accessToken) {
      throw new Error('Zoho access token not available');
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);

    if (response.status === 401) {
      // Token expired, try to refresh
      if (this.credentials?.oauthRefreshToken) {
        await this.performTokenRefresh();
        // Retry the request
        options.headers = {
          ...options.headers,
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        };
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, options);
        if (!retryResponse.ok) {
          throw new Error(`Zoho API error: ${retryResponse.status}`);
        }
        const retryData: ZohoApiResponse<T> = await retryResponse.json();
        return retryData.data || null;
      }
      throw new Error('Authentication failed and no refresh token available');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho API error: ${response.status} - ${errorText}`);
    }

    const data: ZohoApiResponse<T> = await response.json();
    return data.data || null;
  }

  /**
   * Make authenticated request to Zoho Admin API
   */
  private async makeZohoAdminRequest<T>(
    endpoint: string,
    method: string,
    body?: Record<string, unknown>
  ): Promise<T | null> {
    if (!this.accessToken) {
      throw new Error('Zoho access token not available');
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.adminApiUrl}${endpoint}`, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zoho Admin API error: ${response.status} - ${errorText}`);
    }

    if (response.status === 204) {
      return null;
    }

    const data: ZohoApiResponse<T> = await response.json();
    return data.data || null;
  }

  /**
   * Generate secure password for new accounts
   */
  private generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = 'Aa1!'; // Ensure requirements

    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

export default ZohoAdapter;
