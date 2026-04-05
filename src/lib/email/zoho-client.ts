/**
 * Zoho Mail API Client
 * Enterprise-grade integration with Zoho Mail
 */

import {
  ZohoAuthTokens,
  ZohoMailAccount,
  ZohoEmailMessage,
  ZohoEmailAddress,
  ZohoFolder,
  EmailMessage,
  EmailAddress,
  EmailAttachment,
  EmailFolder,
  ComposeEmailRequest,
  SendEmailResponse,
} from '@/types/email';

// Zoho API Base URLs
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_MAIL_API_URL = 'https://mail.zoho.com/api';

// API Endpoints
const ZOHO_ENDPOINTS = {
  // Auth
  TOKEN: `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
  REVOKE: `${ZOHO_ACCOUNTS_URL}/oauth/v2/token/revoke`,

  // Mail API
  ACCOUNTS: `${ZOHO_MAIL_API_URL}/accounts`,
  FOLDERS: (accountId: string) => `${ZOHO_MAIL_API_URL}/accounts/${accountId}/folders`,
  MESSAGES: (accountId: string, folderId: string) =>
    `${ZOHO_MAIL_API_URL}/accounts/${accountId}/folders/${folderId}/messages`,
  MESSAGE: (accountId: string, messageId: string) =>
    `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/${messageId}`,
  SEND: (accountId: string) => `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages`,
  ATTACHMENT: (accountId: string, messageId: string, attachmentId: string) =>
    `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/${messageId}/attachments/${attachmentId}`,
  UPLOAD_ATTACHMENT: (accountId: string) =>
    `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/attachments`,
  SEARCH: (accountId: string) => `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/search`,
  MOVE: (accountId: string) => `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/move`,
  UPDATE: (accountId: string) => `${ZOHO_MAIL_API_URL}/accounts/${accountId}/messages/update`,
};

// Folder name mappings
const ZOHO_FOLDER_MAP: Record<string, EmailFolder> = {
  'Inbox': 'inbox',
  'Sent': 'sent',
  'Drafts': 'drafts',
  'Trash': 'trash',
  'Spam': 'spam',
  'Starred': 'starred',
  'Archive': 'archive',
};

const EMAIL_FOLDER_TO_ZOHO: Record<EmailFolder, string> = {
  'inbox': 'Inbox',
  'sent': 'Sent',
  'drafts': 'Drafts',
  'trash': 'Trash',
  'spam': 'Spam',
  'starred': 'Starred',
  'archive': 'Archive',
  'all': 'All',
};

export class ZohoMailClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private accountId: string | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    accountId?: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = config.accessToken || null;
    this.refreshToken = config.refreshToken || null;
    this.accountId = config.accountId || null;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, scopes: string[] = ['ZohoMail.messages.ALL', 'ZohoMail.folders.ALL']): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<ZohoAuthTokens> {
    const response = await fetch(ZOHO_ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const tokens: ZohoAuthTokens = await response.json();
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    return tokens;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<ZohoAuthTokens> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(ZOHO_ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const tokens: ZohoAuthTokens = await response.json();
    this.accessToken = tokens.access_token;
    this.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    return tokens;
  }

  /**
   * Ensure valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || (this.tokenExpiresAt && this.tokenExpiresAt <= new Date())) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureValidToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zoho API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Get all mail accounts
   */
  async getAccounts(): Promise<ZohoMailAccount[]> {
    const data = await this.apiRequest<{ data: ZohoMailAccount[] }>(
      ZOHO_ENDPOINTS.ACCOUNTS
    );
    return data.data;
  }

  /**
   * Get primary account or first account
   */
  async getPrimaryAccount(): Promise<ZohoMailAccount> {
    const accounts = await this.getAccounts();
    const primary = accounts.find(a => a.isPrimary) || accounts[0];
    if (!primary) {
      throw new Error('No mail accounts found');
    }
    this.accountId = primary.accountId;
    return primary;
  }

  /**
   * Set account ID to use
   */
  setAccountId(accountId: string): void {
    this.accountId = accountId;
  }

  /**
   * Get account ID (ensure it's set)
   */
  private getAccountId(): string {
    if (!this.accountId) {
      throw new Error('Account ID not set. Call getPrimaryAccount() or setAccountId() first.');
    }
    return this.accountId;
  }

  /**
   * Get all folders
   */
  async getFolders(): Promise<ZohoFolder[]> {
    const accountId = this.getAccountId();
    const data = await this.apiRequest<{ data: ZohoFolder[] }>(
      ZOHO_ENDPOINTS.FOLDERS(accountId)
    );
    return data.data;
  }

  /**
   * Get folder by name
   */
  async getFolderByName(folderName: string): Promise<ZohoFolder | undefined> {
    const folders = await this.getFolders();
    return folders.find(f => f.folderName.toLowerCase() === folderName.toLowerCase());
  }

  /**
   * Get messages from a folder
   */
  async getMessages(
    folder: EmailFolder,
    options: {
      limit?: number;
      start?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ messages: EmailMessage[]; total: number }> {
    const accountId = this.getAccountId();
    const zohoFolderName = EMAIL_FOLDER_TO_ZOHO[folder] || 'Inbox';
    const zohoFolder = await this.getFolderByName(zohoFolderName);

    if (!zohoFolder) {
      return { messages: [], total: 0 };
    }

    const params = new URLSearchParams({
      limit: (options.limit || 50).toString(),
      start: (options.start || 0).toString(),
    });

    const data = await this.apiRequest<{ data: ZohoEmailMessage[]; count: number }>(
      `${ZOHO_ENDPOINTS.MESSAGES(accountId, zohoFolder.folderId)}?${params.toString()}`
    );

    const messages = data.data.map(msg => this.transformZohoMessage(msg, folder));
    return { messages, total: data.count || zohoFolder.messageCount };
  }

  /**
   * Get single message
   */
  async getMessage(messageId: string): Promise<EmailMessage> {
    const accountId = this.getAccountId();
    const data = await this.apiRequest<{ data: ZohoEmailMessage }>(
      ZOHO_ENDPOINTS.MESSAGE(accountId, messageId)
    );
    return this.transformZohoMessage(data.data, 'inbox');
  }

  /**
   * Send email
   */
  async sendEmail(email: ComposeEmailRequest): Promise<SendEmailResponse> {
    const accountId = this.getAccountId();

    const payload = {
      fromAddress: '', // Will be set by account
      toAddress: email.to.join(','),
      ccAddress: email.cc?.join(',') || '',
      bccAddress: email.bcc?.join(',') || '',
      subject: email.subject,
      content: email.body_html,
      mailFormat: 'html',
    };

    try {
      const data = await this.apiRequest<{ data: { messageId: string } }>(
        ZOHO_ENDPOINTS.SEND(accountId),
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      return {
        success: true,
        message_id: data.data.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Move messages to folder
   */
  async moveMessages(messageIds: string[], targetFolder: EmailFolder): Promise<boolean> {
    const accountId = this.getAccountId();
    const zohoFolderName = EMAIL_FOLDER_TO_ZOHO[targetFolder];
    const targetFolderData = await this.getFolderByName(zohoFolderName);

    if (!targetFolderData) {
      throw new Error(`Folder ${targetFolder} not found`);
    }

    await this.apiRequest(
      ZOHO_ENDPOINTS.MOVE(accountId),
      {
        method: 'PUT',
        body: JSON.stringify({
          messageId: messageIds,
          destfolderId: targetFolderData.folderId,
        }),
      }
    );

    return true;
  }

  /**
   * Update message flags (read, starred, etc.)
   */
  async updateMessageFlags(
    messageIds: string[],
    updates: {
      isRead?: boolean;
      isStarred?: boolean;
    }
  ): Promise<boolean> {
    const accountId = this.getAccountId();

    const payload: Record<string, unknown> = {
      messageId: messageIds,
    };

    if (updates.isRead !== undefined) {
      payload.mode = updates.isRead ? 'markAsRead' : 'markAsUnread';
    }

    if (updates.isStarred !== undefined) {
      payload.flagValue = updates.isStarred ? 'flagged' : 'unflagged';
    }

    await this.apiRequest(
      ZOHO_ENDPOINTS.UPDATE(accountId),
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );

    return true;
  }

  /**
   * Delete messages (move to trash or permanent delete)
   */
  async deleteMessages(messageIds: string[], permanent: boolean = false): Promise<boolean> {
    if (permanent) {
      const accountId = this.getAccountId();
      await this.apiRequest(
        `${ZOHO_ENDPOINTS.MESSAGE(accountId, messageIds[0])}`,
        { method: 'DELETE' }
      );
    } else {
      await this.moveMessages(messageIds, 'trash');
    }
    return true;
  }

  /**
   * Search messages
   */
  async searchMessages(
    query: string,
    options: {
      folder?: EmailFolder;
      limit?: number;
      start?: number;
    } = {}
  ): Promise<{ messages: EmailMessage[]; total: number }> {
    const accountId = this.getAccountId();

    const params = new URLSearchParams({
      searchKey: query,
      limit: (options.limit || 50).toString(),
      start: (options.start || 0).toString(),
    });

    const data = await this.apiRequest<{ data: ZohoEmailMessage[]; count: number }>(
      `${ZOHO_ENDPOINTS.SEARCH(accountId)}?${params.toString()}`
    );

    const messages = data.data.map(msg =>
      this.transformZohoMessage(msg, options.folder || 'inbox')
    );
    return { messages, total: data.count };
  }

  /**
   * Download attachment
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Blob> {
    const accountId = this.getAccountId();
    await this.ensureValidToken();

    const response = await fetch(
      ZOHO_ENDPOINTS.ATTACHMENT(accountId, messageId, attachmentId),
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download attachment');
    }

    return response.blob();
  }

  /**
   * Upload attachment for composing
   */
  async uploadAttachment(file: File): Promise<{ attachmentId: string; name: string; size: number }> {
    const accountId = this.getAccountId();
    await this.ensureValidToken();

    const formData = new FormData();
    formData.append('attach', file);

    const response = await fetch(
      ZOHO_ENDPOINTS.UPLOAD_ATTACHMENT(accountId),
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload attachment');
    }

    const data = await response.json();
    return {
      attachmentId: data.data.attachmentId,
      name: file.name,
      size: file.size,
    };
  }

  /**
   * Transform Zoho message to our format
   */
  private transformZohoMessage(zohoMsg: ZohoEmailMessage, folder: EmailFolder): EmailMessage {
    return {
      id: zohoMsg.messageId,
      message_id: zohoMsg.messageId,
      thread_id: zohoMsg.messageId, // Zoho doesn't have threads in the same way
      folder,
      from: this.transformZohoAddress(zohoMsg.from),
      to: (zohoMsg.to || []).map(a => this.transformZohoAddress(a)),
      cc: (zohoMsg.cc || []).map(a => this.transformZohoAddress(a)),
      bcc: (zohoMsg.bcc || []).map(a => this.transformZohoAddress(a)),
      subject: zohoMsg.subject || '(No Subject)',
      body_html: zohoMsg.htmlContent || zohoMsg.content || '',
      body_text: zohoMsg.content || '',
      snippet: zohoMsg.summary || '',
      attachments: [], // Would need separate call to get attachments
      has_attachments: zohoMsg.hasAttachment,
      total_attachment_size: 0,
      is_read: zohoMsg.isRead,
      is_starred: zohoMsg.isFlagged,
      is_important: false,
      is_draft: folder === 'drafts',
      is_sent: folder === 'sent',
      labels: [],
      received_at: new Date(zohoMsg.receivedTime).toISOString(),
      sent_at: zohoMsg.sentTime ? new Date(zohoMsg.sentTime).toISOString() : undefined,
      internal_date: new Date(zohoMsg.receivedTime).toISOString(),
    };
  }

  /**
   * Transform Zoho address to our format
   */
  private transformZohoAddress(addr: ZohoEmailAddress): EmailAddress {
    return {
      email: addr.address,
      name: addr.name,
    };
  }

  /**
   * Get access token for external use
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get refresh token for external use
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Set tokens from external source
   */
  setTokens(accessToken: string, refreshToken: string, expiresAt?: Date): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiresAt || null;
  }
}

/**
 * Create a Zoho client from config
 */
export function createZohoClient(config: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
}): ZohoMailClient {
  return new ZohoMailClient(config);
}

/**
 * Default export
 */
export default ZohoMailClient;
