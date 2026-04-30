/**
 * Email Provider Service
 * Centralized service for managing email providers and sending emails
 * Supports multiple providers, failover, and rate limiting
 */

import { createSupabaseAdmin } from '@/lib/supabase/server';
import { getKMS } from '@/lib/security/key-management';
import { ProviderRegistry, PROVIDER_DEFINITIONS } from './provider-registry';
import {
  EmailProviderType,
  ProviderCredentials,
  SendEmailRequest,
  SendEmailResponse,
  HealthCheckResult,
  IEmailProviderAdapter,
  ProviderDefinition,
} from './types';

// Import adapters
import { SMTPAdapter } from './adapters/smtp-adapter';
import { ResendAdapter } from './adapters/resend-adapter';
import { SendGridAdapter } from './adapters/sendgrid-adapter';
import { CustomAPIAdapter } from './adapters/custom-api-adapter';
import { ZohoAdapter } from './adapters/zoho-adapter';

// Register adapters
ProviderRegistry.registerAdapter('custom_smtp', SMTPAdapter);
ProviderRegistry.registerAdapter('resend', ResendAdapter);
ProviderRegistry.registerAdapter('sendgrid', SendGridAdapter);
ProviderRegistry.registerAdapter('custom_api', CustomAPIAdapter);
ProviderRegistry.registerAdapter('zoho', ZohoAdapter);

// ============================================================================
// PROVIDER SERVICE
// ============================================================================

export class EmailProviderService {
  private supabase = createSupabaseAdmin();
  private kms = getKMS();
  private adapters: Map<string, IEmailProviderAdapter> = new Map();

  // ============================================================================
  // PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * Get all configured providers
   */
  async getProviders(activeOnly: boolean = true): Promise<ProviderCredentials[]> {
    let query = this.supabase
      .from('email_provider_credentials')
      .select('*')
      .order('priority', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ProviderService] Error fetching providers:', error);
      return [];
    }

    return (data || []).map(this.mapDbToCredentials);
  }

  /**
   * Get primary provider
   */
  async getPrimaryProvider(): Promise<ProviderCredentials | null> {
    const { data, error } = await this.supabase
      .from('email_provider_credentials')
      .select('*')
      .eq('is_active', true)
      .eq('is_primary', true)
      .maybeSingle();

    if (error || !data) {
      // Fallback to highest priority provider
      const { data: fallback } = await this.supabase
        .from('email_provider_credentials')
        .select('*')
        .eq('is_active', true)
        .eq('is_verified', true)
        .order('priority', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!fallback) return null;
      return this.mapDbToCredentials(fallback);
    }

    return this.mapDbToCredentials(data);
  }

  /**
   * Get provider by ID
   */
  async getProviderById(id: string): Promise<ProviderCredentials | null> {
    const { data, error } = await this.supabase
      .from('email_provider_credentials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapDbToCredentials(data);
  }

  /**
   * Create a new provider
   */
  async createProvider(
    input: Partial<ProviderCredentials>,
    userId?: string
  ): Promise<{ success: boolean; provider?: ProviderCredentials; error?: string }> {
    try {
      // Validate provider type
      const definition = ProviderRegistry.getProviderDefinition(input.providerName!);
      if (!definition) {
        return { success: false, error: `Unknown provider type: ${input.providerName}` };
      }

      // Validate required fields
      const validation = ProviderRegistry.validateCredentials(
        input.providerName as EmailProviderType,
        input
      );
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      // Encrypt sensitive fields
      const encryptedData = this.encryptCredentials(input);

      // Insert into database
      const { data, error } = await this.supabase
        .from('email_provider_credentials')
        .insert({
          provider_name: input.providerName,
          provider_type: input.providerType || definition.category,
          display_name: input.displayName || definition.displayName,
          description: input.description,

          // API credentials
          api_key_encrypted: encryptedData.apiKey,
          api_secret_encrypted: encryptedData.apiSecret,
          api_endpoint: input.apiEndpoint,

          // OAuth credentials
          oauth_client_id: input.oauthClientId,
          oauth_client_secret_encrypted: encryptedData.oauthClientSecret,
          oauth_redirect_uri: input.oauthRedirectUri,
          oauth_scopes: input.oauthScopes,

          // SMTP configuration
          smtp_host: input.smtpHost,
          smtp_port: input.smtpPort,
          smtp_username: input.smtpUsername,
          smtp_password_encrypted: encryptedData.smtpPassword,
          smtp_use_tls: input.smtpUseTls,
          smtp_use_ssl: input.smtpUseSsl,

          // IMAP configuration
          imap_host: input.imapHost,
          imap_port: input.imapPort,
          imap_username: input.imapUsername,
          imap_password_encrypted: encryptedData.imapPassword,
          imap_use_ssl: input.imapUseSsl,

          // Webhook configuration
          webhook_url: input.webhookUrl,
          webhook_secret_encrypted: encryptedData.webhookSecret,
          webhook_events: input.webhookEvents,

          // Custom configuration
          custom_config: input.customConfig,

          // Rate limits
          rate_limit_per_second: input.rateLimitPerSecond,
          rate_limit_per_minute: input.rateLimitPerMinute,
          rate_limit_per_hour: input.rateLimitPerHour,
          rate_limit_per_day: input.rateLimitPerDay,
          monthly_quota: input.monthlyQuota,

          // Status
          is_active: input.isActive ?? true,
          is_primary: input.isPrimary ?? false,
          priority: input.priority ?? 100,

          created_by: userId,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('[ProviderService] Error creating provider:', error);
        return { success: false, error: 'Failed to create provider' };
      }

      return { success: true, provider: this.mapDbToCredentials(data) };
    } catch (error) {
      console.error('[ProviderService] Error creating provider:', error);
      return { success: false, error: 'Failed to create provider' };
    }
  }

  /**
   * Update provider
   */
  async updateProvider(
    id: string,
    input: Partial<ProviderCredentials>,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Encrypt sensitive fields if provided
      const encryptedData = this.encryptCredentials(input);

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };

      // Map fields that are provided
      if (input.displayName !== undefined) updateData.display_name = input.displayName;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.apiEndpoint !== undefined) updateData.api_endpoint = input.apiEndpoint;
      if (input.smtpHost !== undefined) updateData.smtp_host = input.smtpHost;
      if (input.smtpPort !== undefined) updateData.smtp_port = input.smtpPort;
      if (input.smtpUsername !== undefined) updateData.smtp_username = input.smtpUsername;
      if (input.smtpUseTls !== undefined) updateData.smtp_use_tls = input.smtpUseTls;
      if (input.smtpUseSsl !== undefined) updateData.smtp_use_ssl = input.smtpUseSsl;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.isPrimary !== undefined) updateData.is_primary = input.isPrimary;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.customConfig !== undefined) updateData.custom_config = input.customConfig;

      // Encrypted fields
      if (encryptedData.apiKey) updateData.api_key_encrypted = encryptedData.apiKey;
      if (encryptedData.apiSecret) updateData.api_secret_encrypted = encryptedData.apiSecret;
      if (encryptedData.smtpPassword) updateData.smtp_password_encrypted = encryptedData.smtpPassword;
      if (encryptedData.oauthClientSecret) updateData.oauth_client_secret_encrypted = encryptedData.oauthClientSecret;

      const { error } = await this.supabase
        .from('email_provider_credentials')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('[ProviderService] Error updating provider:', error);
        return { success: false, error: 'Failed to update provider' };
      }

      // Clear cached adapter
      this.adapters.delete(id);

      return { success: true };
    } catch (error) {
      console.error('[ProviderService] Error updating provider:', error);
      return { success: false, error: 'Failed to update provider' };
    }
  }

  /**
   * Delete provider
   */
  async deleteProvider(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('email_provider_credentials')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: 'Failed to delete provider' };
      }

      this.adapters.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to delete provider' };
    }
  }

  /**
   * Set primary provider
   */
  async setPrimaryProvider(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Unset current primary
      await this.supabase
        .from('email_provider_credentials')
        .update({ is_primary: false })
        .eq('is_primary', true);

      // Set new primary
      const { error } = await this.supabase
        .from('email_provider_credentials')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) {
        return { success: false, error: 'Failed to set primary provider' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to set primary provider' };
    }
  }

  // ============================================================================
  // EMAIL SENDING
  // ============================================================================

  /**
   * Send email using primary provider with failover support
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    const providers = await this.getProviders(true);

    if (providers.length === 0) {
      return {
        success: false,
        error: 'No active email providers configured',
        timestamp: new Date(),
      };
    }

    // Try providers in priority order
    for (const provider of providers) {
      try {
        // Check rate limits
        const canSend = await this.checkRateLimits(provider.id);
        if (!canSend) {
          console.warn(`[ProviderService] Rate limited for provider: ${provider.displayName}`);
          continue;
        }

        const adapter = await this.getAdapter(provider);
        if (!adapter) continue;

        const startTime = Date.now();
        const result = await adapter.sendEmail(request);
        const responseTime = Date.now() - startTime;

        // Log usage
        await this.logUsage(provider.id, 'send', result.success, responseTime, result.error);

        if (result.success) {
          return result;
        }

        // If failed, try next provider
        console.warn(
          `[ProviderService] Failed to send via ${provider.displayName}: ${result.error}`
        );
      } catch (error) {
        console.error(`[ProviderService] Error with provider ${provider.displayName}:`, error);
        await this.logUsage(
          provider.id,
          'send',
          false,
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    return {
      success: false,
      error: 'All email providers failed',
      timestamp: new Date(),
    };
  }

  /**
   * Send email using specific provider
   */
  async sendEmailViaProvider(
    providerId: string,
    request: SendEmailRequest
  ): Promise<SendEmailResponse> {
    const provider = await this.getProviderById(providerId);

    if (!provider) {
      return {
        success: false,
        error: 'Provider not found',
        timestamp: new Date(),
      };
    }

    const adapter = await this.getAdapter(provider);
    if (!adapter) {
      return {
        success: false,
        error: 'Failed to initialize provider adapter',
        timestamp: new Date(),
      };
    }

    const startTime = Date.now();
    const result = await adapter.sendEmail(request);
    const responseTime = Date.now() - startTime;

    await this.logUsage(providerId, 'send', result.success, responseTime, result.error);

    return result;
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmail(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    const provider = await this.getPrimaryProvider();

    if (!provider) {
      return requests.map(() => ({
        success: false,
        error: 'No primary provider configured',
        timestamp: new Date(),
      }));
    }

    const adapter = await this.getAdapter(provider);
    if (!adapter || !adapter.sendBulkEmail) {
      // Fallback to sequential sending
      return Promise.all(requests.map(req => this.sendEmail(req)));
    }

    return adapter.sendBulkEmail(requests);
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Check health of all providers
   */
  async checkAllProvidersHealth(): Promise<Map<string, HealthCheckResult>> {
    const providers = await this.getProviders(false);
    const results = new Map<string, HealthCheckResult>();

    await Promise.all(
      providers.map(async (provider) => {
        const result = await this.checkProviderHealth(provider.id);
        results.set(provider.id, result);
      })
    );

    return results;
  }

  /**
   * Check health of specific provider
   */
  async checkProviderHealth(providerId: string): Promise<HealthCheckResult> {
    const provider = await this.getProviderById(providerId);

    if (!provider) {
      return {
        healthy: false,
        status: 'down',
        message: 'Provider not found',
        checkedAt: new Date(),
      };
    }

    try {
      const adapter = await this.getAdapter(provider);
      if (!adapter) {
        return {
          healthy: false,
          status: 'down',
          message: 'Failed to initialize adapter',
          checkedAt: new Date(),
        };
      }

      const result = await adapter.healthCheck();

      // Update health status in database
      await this.supabase
        .from('email_provider_credentials')
        .update({
          health_status: result.status,
          last_health_check: new Date().toISOString(),
        })
        .eq('id', providerId);

      // Log health check
      await this.supabase.from('email_provider_health').insert({
        provider_id: providerId,
        check_type: 'api_health',
        status: result.status,
        latency_ms: result.latencyMs,
        error_message: result.message,
      });

      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        healthy: false,
        status: 'down',
        message: error instanceof Error ? error.message : 'Health check failed',
        checkedAt: new Date(),
      };

      await this.supabase
        .from('email_provider_credentials')
        .update({
          health_status: 'down',
          last_health_check: new Date().toISOString(),
        })
        .eq('id', providerId);

      return result;
    }
  }

  /**
   * Verify provider credentials
   */
  async verifyProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
    const provider = await this.getProviderById(providerId);

    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    try {
      const adapter = await this.getAdapter(provider);
      if (!adapter) {
        return { success: false, error: 'Failed to initialize adapter' };
      }

      const isValid = await adapter.validateCredentials();

      await this.supabase
        .from('email_provider_credentials')
        .update({
          is_verified: isValid,
          verification_status: isValid ? 'verified' : 'failed',
          last_verified_at: new Date().toISOString(),
        })
        .eq('id', providerId);

      return { success: isValid, error: isValid ? undefined : 'Credential validation failed' };
    } catch (error) {
      await this.supabase
        .from('email_provider_credentials')
        .update({
          verification_status: 'failed',
        })
        .eq('id', providerId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // ============================================================================
  // PROVIDER DEFINITIONS
  // ============================================================================

  /**
   * Get available provider definitions
   */
  getAvailableProviders(): ProviderDefinition[] {
    return ProviderRegistry.getAllProviderDefinitions();
  }

  /**
   * Get provider definition by name
   */
  getProviderDefinition(providerName: EmailProviderType): ProviderDefinition | undefined {
    return ProviderRegistry.getProviderDefinition(providerName);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async getAdapter(credentials: ProviderCredentials): Promise<IEmailProviderAdapter | null> {
    // Check cache
    if (this.adapters.has(credentials.id)) {
      return this.adapters.get(credentials.id)!;
    }

    try {
      // Decrypt credentials
      const decryptedCredentials = this.decryptCredentials(credentials);

      // Create adapter
      const adapter = await ProviderRegistry.createAdapter(
        credentials.providerName as EmailProviderType,
        decryptedCredentials
      );

      // Cache it
      this.adapters.set(credentials.id, adapter);

      return adapter;
    } catch (error) {
      console.error(`[ProviderService] Failed to create adapter for ${credentials.providerName}:`, error);
      return null;
    }
  }

  private encryptCredentials(input: Partial<ProviderCredentials>): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    if (input.apiKey) {
      const encrypted = this.kms.encrypt(input.apiKey);
      result.apiKey = `${encrypted.encrypted}|${encrypted.iv}|${encrypted.tag}|${encrypted.keyVersion}`;
    }

    if (input.apiSecret) {
      const encrypted = this.kms.encrypt(input.apiSecret);
      result.apiSecret = `${encrypted.encrypted}|${encrypted.iv}|${encrypted.tag}|${encrypted.keyVersion}`;
    }

    if (input.smtpPassword) {
      const encrypted = this.kms.encrypt(input.smtpPassword);
      result.smtpPassword = `${encrypted.encrypted}|${encrypted.iv}|${encrypted.tag}|${encrypted.keyVersion}`;
    }

    if (input.oauthClientSecret) {
      const encrypted = this.kms.encrypt(input.oauthClientSecret);
      result.oauthClientSecret = `${encrypted.encrypted}|${encrypted.iv}|${encrypted.tag}|${encrypted.keyVersion}`;
    }

    if (input.webhookSecret) {
      const encrypted = this.kms.encrypt(input.webhookSecret);
      result.webhookSecret = `${encrypted.encrypted}|${encrypted.iv}|${encrypted.tag}|${encrypted.keyVersion}`;
    }

    return result;
  }

  private decryptCredentials(credentials: ProviderCredentials): ProviderCredentials {
    const result = { ...credentials };

    const decryptField = (encrypted: string | undefined): string | undefined => {
      if (!encrypted) return undefined;

      try {
        const parts = encrypted.split('|');
        if (parts.length !== 4) return encrypted; // Not encrypted with our format

        const [ciphertext, iv, tag, keyVersion] = parts;
        return this.kms.decrypt(ciphertext, iv, tag, parseInt(keyVersion)).toString('utf8');
      } catch {
        return encrypted; // Return as-is if decryption fails
      }
    };

    result.apiKey = decryptField(credentials.apiKey);
    result.apiSecret = decryptField(credentials.apiSecret);
    result.smtpPassword = decryptField(credentials.smtpPassword);
    result.oauthClientSecret = decryptField(credentials.oauthClientSecret);
    result.webhookSecret = decryptField(credentials.webhookSecret);

    return result;
  }

  private mapDbToCredentials(data: Record<string, unknown>): ProviderCredentials {
    return {
      id: data.id as string,
      providerName: data.provider_name as EmailProviderType,
      providerType: data.provider_type as unknown,
      displayName: data.display_name as string,
      description: data.description as string | undefined,

      apiKey: data.api_key_encrypted as string | undefined,
      apiSecret: data.api_secret_encrypted as string | undefined,
      apiEndpoint: data.api_endpoint as string | undefined,

      oauthClientId: data.oauth_client_id as string | undefined,
      oauthClientSecret: data.oauth_client_secret_encrypted as string | undefined,
      oauthRedirectUri: data.oauth_redirect_uri as string | undefined,
      oauthScopes: data.oauth_scopes as string[] | undefined,
      oauthAccessToken: data.oauth_access_token_encrypted as string | undefined,
      oauthRefreshToken: data.oauth_refresh_token_encrypted as string | undefined,
      oauthTokenExpiresAt: data.oauth_token_expires_at
        ? new Date(data.oauth_token_expires_at as string)
        : undefined,

      smtpHost: data.smtp_host as string | undefined,
      smtpPort: data.smtp_port as number | undefined,
      smtpUsername: data.smtp_username as string | undefined,
      smtpPassword: data.smtp_password_encrypted as string | undefined,
      smtpUseTls: data.smtp_use_tls as boolean | undefined,
      smtpUseSsl: data.smtp_use_ssl as boolean | undefined,

      imapHost: data.imap_host as string | undefined,
      imapPort: data.imap_port as number | undefined,
      imapUsername: data.imap_username as string | undefined,
      imapPassword: data.imap_password_encrypted as string | undefined,
      imapUseSsl: data.imap_use_ssl as boolean | undefined,

      webhookUrl: data.webhook_url as string | undefined,
      webhookSecret: data.webhook_secret_encrypted as string | undefined,
      webhookEvents: data.webhook_events as string[] | undefined,

      customConfig: data.custom_config as Record<string, unknown> | undefined,

      rateLimitPerSecond: data.rate_limit_per_second as number | undefined,
      rateLimitPerMinute: data.rate_limit_per_minute as number | undefined,
      rateLimitPerHour: data.rate_limit_per_hour as number | undefined,
      rateLimitPerDay: data.rate_limit_per_day as number | undefined,
      monthlyQuota: data.monthly_quota as number | undefined,

      isActive: data.is_active as boolean,
      isPrimary: data.is_primary as boolean,
      isVerified: data.is_verified as boolean,
      healthStatus: data.health_status as unknown,
      priority: data.priority as number,
    };
  }

  private async checkRateLimits(providerId: string): Promise<boolean> {
    const { data } = await this.supabase.rpc('check_provider_rate_limit', {
      p_provider_id: providerId,
    });

    return data?.can_send ?? true;
  }

  private async logUsage(
    providerId: string,
    requestType: string,
    isSuccess: boolean,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    await this.supabase.rpc('log_provider_usage', {
      p_provider_id: providerId,
      p_request_type: requestType,
      p_is_success: isSuccess,
      p_response_time_ms: responseTimeMs,
      p_error_message: errorMessage,
    });
  }
}

// Singleton instance
let providerServiceInstance: EmailProviderService | null = null;

export function getEmailProviderService(): EmailProviderService {
  if (!providerServiceInstance) {
    providerServiceInstance = new EmailProviderService();
  }
  return providerServiceInstance;
}

export default EmailProviderService;
