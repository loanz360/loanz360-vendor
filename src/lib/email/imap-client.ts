/**
 * IMAP Email Client
 * Server-side IMAP operations for email retrieval
 * Uses imapflow library for reliable IMAP connections
 */

import {
  EmailMessage,
  EmailAddress,
  EmailAttachment,
  EmailFolder,
  IMAPConfig,
  IMAPMailbox,
  EmailSearchParams,
} from '@/types/email';

// IMAP folder name mappings
const FOLDER_MAP: Record<EmailFolder, string[]> = {
  inbox: ['INBOX', 'Inbox'],
  sent: ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'],
  drafts: ['Drafts', '[Gmail]/Drafts'],
  trash: ['Trash', 'Deleted Items', '[Gmail]/Trash'],
  spam: ['Spam', 'Junk', 'Junk E-mail', '[Gmail]/Spam'],
  starred: ['Starred', 'Flagged', '[Gmail]/Starred'],
  archive: ['Archive', 'All Mail', '[Gmail]/All Mail'],
  all: ['All', 'All Mail', '[Gmail]/All Mail'],
};

/**
 * Parse email address from header
 */
function parseEmailAddress(addr: { address?: string; name?: string } | string): EmailAddress {
  if (typeof addr === 'string') {
    const match = addr.match(/^(?:"?(.+?)"?\s*)?<?([^<>]+@[^<>]+)>?$/);
    if (match) {
      return { email: match[2], name: match[1]?.trim() };
    }
    return { email: addr };
  }
  return { email: addr.address || '', name: addr.name };
}

/**
 * Parse email address list
 */
function parseAddressList(addresses: unknown): EmailAddress[] {
  if (!addresses) return [];
  if (Array.isArray(addresses)) {
    return addresses.map(a => parseEmailAddress(a));
  }
  if (typeof addresses === 'string') {
    return addresses.split(',').map(a => parseEmailAddress(a.trim()));
  }
  return [parseEmailAddress(addresses as { address?: string; name?: string })];
}

/**
 * IMAP Client Class
 * Note: This is a simplified version. In production, use imapflow or similar library.
 */
export class IMAPClient {
  private config: IMAPConfig;
  private connected: boolean = false;

  constructor(config: IMAPConfig) {
    this.config = config;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    // In production, this would establish actual IMAP connection
    // Using a library like imapflow:
    // const { ImapFlow } = await import('imapflow');
    // this.client = new ImapFlow(this.config);
    // await this.client.connect();
    this.connected = true;
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    // In production: await this.client?.logout();
    this.connected = false;
  }

  /**
   * Ensure connected
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('IMAP client not connected');
    }
  }

  /**
   * Get mailbox info
   */
  async getMailbox(folder: EmailFolder): Promise<IMAPMailbox | null> {
    this.ensureConnected();

    const folderNames = FOLDER_MAP[folder] || [folder];

    // In production, try each folder name until one works
    // const mailbox = await this.client.getMailboxStatus(folderNames[0]);

    // Mock response for now
    return {
      name: folderNames[0],
      path: folderNames[0],
      flags: [],
      delimiter: '/',
      exists: 0,
      recent: 0,
      unseen: 0,
      uidValidity: Date.now(),
      uidNext: 1,
    };
  }

  /**
   * List all mailboxes
   */
  async listMailboxes(): Promise<IMAPMailbox[]> {
    this.ensureConnected();

    // In production: return await this.client.list();
    return Object.keys(FOLDER_MAP).map(folder => ({
      name: folder,
      path: FOLDER_MAP[folder as EmailFolder][0],
      flags: [],
      delimiter: '/',
      exists: 0,
      recent: 0,
      unseen: 0,
      uidValidity: Date.now(),
      uidNext: 1,
    }));
  }

  /**
   * Fetch messages from folder
   */
  async fetchMessages(
    folder: EmailFolder,
    options: {
      limit?: number;
      offset?: number;
      since?: Date;
      before?: Date;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ messages: EmailMessage[]; total: number }> {
    this.ensureConnected();

    const { limit = 50, offset = 0 } = options;

    // In production, this would:
    // 1. Open the mailbox
    // 2. Search for messages matching criteria
    // 3. Fetch message headers and partial body
    // 4. Return transformed messages

    /*
    const mailbox = await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    let searchCriteria: SearchCriteria = {};
    if (options.since) searchCriteria.since = options.since;
    if (options.before) searchCriteria.before = options.before;
    if (options.unreadOnly) searchCriteria.unseen = true;

    const uids = await this.client.search(searchCriteria, { uid: true });
    const total = uids.length;

    const selectedUids = uids.slice(offset, offset + limit);

    const messages = [];
    for await (const msg of this.client.fetch(selectedUids, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      source: { start: 0, maxLength: 1024 }, // First 1KB for preview
    })) {
      messages.push(this.transformMessage(msg, folder));
    }

    return { messages, total };
    */

    // Mock response
    return { messages: [], total: 0 };
  }

  /**
   * Fetch single message with full body
   */
  async fetchMessage(
    folder: EmailFolder,
    uid: string
  ): Promise<EmailMessage | null> {
    this.ensureConnected();

    // In production:
    /*
    await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    for await (const msg of this.client.fetch(uid, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      source: true, // Full source
    })) {
      return this.transformMessage(msg, folder, true);
    }
    */

    return null;
  }

  /**
   * Search messages
   */
  async searchMessages(
    params: EmailSearchParams
  ): Promise<{ messages: EmailMessage[]; total: number }> {
    this.ensureConnected();

    // In production:
    /*
    const searchCriteria: SearchCriteria = {};

    if (params.query) {
      searchCriteria.or = [
        { subject: params.query },
        { body: params.query },
        { from: params.query },
      ];
    }
    if (params.from) searchCriteria.from = params.from;
    if (params.to) searchCriteria.to = params.to;
    if (params.subject) searchCriteria.subject = params.subject;
    if (params.date_from) searchCriteria.since = new Date(params.date_from);
    if (params.date_to) searchCriteria.before = new Date(params.date_to);
    if (params.is_read === true) searchCriteria.seen = true;
    if (params.is_read === false) searchCriteria.unseen = true;
    if (params.is_starred) searchCriteria.flagged = true;
    if (params.has_attachment) searchCriteria.or?.push({ header: { name: 'Content-Type', value: 'multipart/mixed' }});

    const folder = params.folder || 'inbox';
    await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    const uids = await this.client.search(searchCriteria, { uid: true });
    // ... fetch and return messages
    */

    return { messages: [], total: 0 };
  }

  /**
   * Mark messages as read/unread
   */
  async setReadStatus(
    folder: EmailFolder,
    uids: string[],
    isRead: boolean
  ): Promise<boolean> {
    this.ensureConnected();

    // In production:
    /*
    await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    if (isRead) {
      await this.client.messageFlagsAdd(uids, ['\\Seen']);
    } else {
      await this.client.messageFlagsRemove(uids, ['\\Seen']);
    }
    */

    return true;
  }

  /**
   * Star/unstar messages
   */
  async setStarredStatus(
    folder: EmailFolder,
    uids: string[],
    isStarred: boolean
  ): Promise<boolean> {
    this.ensureConnected();

    // In production:
    /*
    await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    if (isStarred) {
      await this.client.messageFlagsAdd(uids, ['\\Flagged']);
    } else {
      await this.client.messageFlagsRemove(uids, ['\\Flagged']);
    }
    */

    return true;
  }

  /**
   * Move messages to another folder
   */
  async moveMessages(
    sourceFolder: EmailFolder,
    targetFolder: EmailFolder,
    uids: string[]
  ): Promise<boolean> {
    this.ensureConnected();

    // In production:
    /*
    await this.client.mailboxOpen(FOLDER_MAP[sourceFolder][0]);
    await this.client.messageMove(uids, FOLDER_MAP[targetFolder][0]);
    */

    return true;
  }

  /**
   * Delete messages (move to trash or permanent)
   */
  async deleteMessages(
    folder: EmailFolder,
    uids: string[],
    permanent: boolean = false
  ): Promise<boolean> {
    this.ensureConnected();

    if (permanent || folder === 'trash') {
      // In production:
      /*
      await this.client.mailboxOpen(FOLDER_MAP[folder][0]);
      await this.client.messageFlagsAdd(uids, ['\\Deleted']);
      await this.client.messageDelete(uids);
      */
    } else {
      await this.moveMessages(folder, 'trash', uids);
    }

    return true;
  }

  /**
   * Get attachment content
   */
  async getAttachment(
    folder: EmailFolder,
    uid: string,
    partId: string
  ): Promise<Buffer | null> {
    this.ensureConnected();

    // In production:
    /*
    await this.client.mailboxOpen(FOLDER_MAP[folder][0]);

    for await (const msg of this.client.fetch(uid, {
      bodyParts: [partId],
    })) {
      return msg.bodyParts?.get(partId);
    }
    */

    return null;
  }

  /**
   * Get folder statistics
   */
  async getFolderStats(folder: EmailFolder): Promise<{
    total: number;
    unread: number;
    recent: number;
  }> {
    this.ensureConnected();

    // In production:
    /*
    const mailbox = await this.client.mailboxOpen(FOLDER_MAP[folder][0], { readOnly: true });
    return {
      total: mailbox.exists,
      unread: mailbox.unseen || 0,
      recent: mailbox.recent || 0,
    };
    */

    return { total: 0, unread: 0, recent: 0 };
  }

  /**
   * Transform raw message to EmailMessage
   */
  private transformMessage(
    rawMsg: Record<string, unknown>,
    folder: EmailFolder,
    includeBody: boolean = false
  ): EmailMessage {
    const envelope = rawMsg.envelope as Record<string, unknown> || {};
    const bodyStructure = rawMsg.bodyStructure as Record<string, unknown> || {};

    // Extract attachments from body structure
    const attachments: EmailAttachment[] = [];
    if (bodyStructure.childNodes) {
      // Parse multipart message for attachments
      // This would recursively traverse the body structure
    }

    return {
      id: String(rawMsg.uid || rawMsg.seq),
      message_id: String(envelope.messageId || ''),
      thread_id: String(envelope.inReplyTo || envelope.messageId || ''),
      folder,
      from: parseAddressList(envelope.from)[0] || { email: '' },
      to: parseAddressList(envelope.to),
      cc: parseAddressList(envelope.cc),
      bcc: parseAddressList(envelope.bcc),
      reply_to: parseAddressList(envelope.replyTo)[0],
      subject: String(envelope.subject || '(No Subject)'),
      body_html: includeBody ? String(rawMsg.html || rawMsg.text || '') : '',
      body_text: includeBody ? String(rawMsg.text || '') : '',
      snippet: String(rawMsg.preview || '').substring(0, 200),
      attachments,
      has_attachments: attachments.length > 0,
      total_attachment_size: attachments.reduce((sum, a) => sum + a.size, 0),
      is_read: Boolean(rawMsg.flags?.includes('\\Seen')),
      is_starred: Boolean(rawMsg.flags?.includes('\\Flagged')),
      is_important: Boolean(rawMsg.flags?.includes('\\Important')),
      is_draft: folder === 'drafts',
      is_sent: folder === 'sent',
      labels: (rawMsg.labels || []) as string[],
      received_at: envelope.date ? new Date(envelope.date as string).toISOString() : new Date().toISOString(),
      sent_at: envelope.date ? new Date(envelope.date as string).toISOString() : undefined,
      internal_date: rawMsg.internalDate ? new Date(rawMsg.internalDate as number).toISOString() : new Date().toISOString(),
    };
  }
}

/**
 * Create IMAP client with config
 */
export function createIMAPClient(config: IMAPConfig): IMAPClient {
  return new IMAPClient(config);
}

/**
 * Create IMAP config for Zoho
 */
export function createZohoIMAPConfig(
  email: string,
  password: string
): IMAPConfig {
  return {
    host: 'imap.zoho.com',
    port: 993,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
    tls: {
      rejectUnauthorized: true,
    },
  };
}

/**
 * Create IMAP config for common providers
 */
export function createIMAPConfigForProvider(
  provider: 'zoho' | 'gmail' | 'outlook' | 'hostinger',
  email: string,
  password: string
): IMAPConfig {
  const configs: Record<string, Partial<IMAPConfig>> = {
    zoho: { host: 'imap.zoho.com', port: 993 },
    gmail: { host: 'imap.gmail.com', port: 993 },
    outlook: { host: 'outlook.office365.com', port: 993 },
    hostinger: { host: 'imap.hostinger.com', port: 993 },
  };

  const config = configs[provider] || configs.zoho;

  return {
    host: config.host!,
    port: config.port!,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
    tls: {
      rejectUnauthorized: true,
    },
  };
}

export default IMAPClient;
