/**
 * Email Utility Functions
 * Common utilities for email operations
 */

import type { EmailMessage, EmailAddress, EmailFolder, EmailFolderStats } from '@/types/email';

/**
 * Format email address for display
 */
export function formatEmailAddress(address: EmailAddress): string {
  if (address.name) {
    return `${address.name} <${address.email}>`;
  }
  return address.email;
}

/**
 * Format email addresses list for display
 */
export function formatEmailAddresses(addresses: EmailAddress[]): string {
  return addresses.map(formatEmailAddress).join(', ');
}

/**
 * Parse email address string
 */
export function parseEmailAddress(input: string): EmailAddress {
  const match = input.match(/^(?:"?(.+?)"?\s*)?<?([^<>]+@[^<>]+)>?$/);
  if (match) {
    return {
      email: match[2].trim(),
      name: match[1]?.trim(),
    };
  }
  return { email: input.trim() };
}

/**
 * Parse multiple email addresses
 */
export function parseEmailAddresses(input: string): EmailAddress[] {
  if (!input) return [];

  // Split by comma, but handle quoted names with commas
  const addresses: EmailAddress[] = [];
  let current = '';
  let inQuotes = false;
  let inAngleBrackets = false;

  for (const char of input) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === '<') {
      inAngleBrackets = true;
    } else if (char === '>') {
      inAngleBrackets = false;
    } else if (char === ',' && !inQuotes && !inAngleBrackets) {
      if (current.trim()) {
        addresses.push(parseEmailAddress(current));
      }
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    addresses.push(parseEmailAddress(current));
  }

  return addresses;
}

/**
 * Validate email address format
 */
export function isValidEmailAddress(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Get initials from name or email
 */
export function getEmailInitials(address: EmailAddress): string {
  if (address.name) {
    const parts = address.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return address.name.substring(0, 2).toUpperCase();
  }
  return address.email.substring(0, 2).toUpperCase();
}

/**
 * Get display name from email address
 */
export function getDisplayName(address: EmailAddress): string {
  return address.name || address.email.split('@')[0];
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format email date for display
 */
export function formatEmailDate(dateString: string, full: boolean = false): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const emailDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Full format
  if (full) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Today - show time
  if (emailDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Yesterday
  if (emailDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // This year - show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  // Other years - show full date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatEmailDate(dateString);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate message preview/snippet
 */
export function generateSnippet(html: string, maxLength: number = 100): string {
  // Remove HTML tags
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return truncateText(text, maxLength);
}

/**
 * Get folder icon
 */
export function getFolderIcon(folder: EmailFolder): string {
  const icons: Record<EmailFolder, string> = {
    inbox: '📥',
    sent: '📤',
    drafts: '📝',
    trash: '🗑️',
    spam: '⚠️',
    starred: '⭐',
    archive: '📁',
    all: '📬',
  };
  return icons[folder] || '📁';
}

/**
 * Get folder display name
 */
export function getFolderDisplayName(folder: EmailFolder): string {
  const names: Record<EmailFolder, string> = {
    inbox: 'Inbox',
    sent: 'Sent',
    drafts: 'Drafts',
    trash: 'Trash',
    spam: 'Spam',
    starred: 'Starred',
    archive: 'Archive',
    all: 'All Mail',
  };
  return names[folder] || folder;
}

/**
 * Get default folder stats
 */
export function getDefaultFolderStats(): EmailFolderStats[] {
  const folders: EmailFolder[] = ['inbox', 'sent', 'drafts', 'starred', 'spam', 'trash', 'archive'];
  return folders.map(folder => ({
    folder,
    name: getFolderDisplayName(folder),
    icon: getFolderIcon(folder),
    color: getFolderColor(folder),
    total: 0,
    unread: 0,
    is_system: true,
  }));
}

/**
 * Get folder color
 */
export function getFolderColor(folder: EmailFolder): string {
  const colors: Record<EmailFolder, string> = {
    inbox: '#3B82F6',
    sent: '#10B981',
    drafts: '#F59E0B',
    starred: '#EAB308',
    spam: '#EF4444',
    trash: '#6B7280',
    archive: '#8B5CF6',
    all: '#6366F1',
  };
  return colors[folder] || '#6B7280';
}

/**
 * Sort emails by date
 */
export function sortEmailsByDate(
  emails: EmailMessage[],
  order: 'asc' | 'desc' = 'desc'
): EmailMessage[] {
  return [...emails].sort((a, b) => {
    const dateA = new Date(a.received_at).getTime();
    const dateB = new Date(b.received_at).getTime();
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Group emails by date
 */
export function groupEmailsByDate(emails: EmailMessage[]): Map<string, EmailMessage[]> {
  const groups = new Map<string, EmailMessage[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

  for (const email of emails) {
    const emailDate = new Date(email.received_at);
    emailDate.setHours(0, 0, 0, 0);

    let groupKey: string;

    if (emailDate.getTime() === today.getTime()) {
      groupKey = 'Today';
    } else if (emailDate.getTime() === yesterday.getTime()) {
      groupKey = 'Yesterday';
    } else if (emailDate >= thisWeekStart) {
      groupKey = 'This Week';
    } else if (emailDate.getMonth() === today.getMonth() && emailDate.getFullYear() === today.getFullYear()) {
      groupKey = 'This Month';
    } else {
      groupKey = emailDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(email);
  }

  return groups;
}

/**
 * Filter emails
 */
export function filterEmails(
  emails: EmailMessage[],
  filters: {
    search?: string;
    isRead?: boolean;
    isStarred?: boolean;
    hasAttachments?: boolean;
    from?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }
): EmailMessage[] {
  return emails.filter(email => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        email.subject.toLowerCase().includes(searchLower) ||
        email.from.email.toLowerCase().includes(searchLower) ||
        email.from.name?.toLowerCase().includes(searchLower) ||
        email.snippet.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Read filter
    if (filters.isRead !== undefined && email.is_read !== filters.isRead) {
      return false;
    }

    // Starred filter
    if (filters.isStarred !== undefined && email.is_starred !== filters.isStarred) {
      return false;
    }

    // Attachments filter
    if (filters.hasAttachments && !email.has_attachments) {
      return false;
    }

    // From filter
    if (filters.from) {
      const fromLower = filters.from.toLowerCase();
      if (!email.from.email.toLowerCase().includes(fromLower) &&
          !email.from.name?.toLowerCase().includes(fromLower)) {
        return false;
      }
    }

    // Date filters
    const emailDate = new Date(email.received_at);
    if (filters.dateFrom && emailDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && emailDate > filters.dateTo) {
      return false;
    }

    return true;
  });
}

/**
 * Extract all email addresses from message
 */
export function extractAllRecipients(message: EmailMessage): EmailAddress[] {
  const all = new Map<string, EmailAddress>();

  const addAddress = (addr: EmailAddress) => {
    if (addr.email) {
      all.set(addr.email.toLowerCase(), addr);
    }
  };

  message.to.forEach(addAddress);
  message.cc.forEach(addAddress);
  message.bcc.forEach(addAddress);

  return Array.from(all.values());
}

/**
 * Check if email is from internal domain
 */
export function isInternalEmail(email: string, companyDomain: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === companyDomain.toLowerCase();
}

/**
 * Get file type icon
 */
export function getAttachmentIcon(mimeType: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // By extension
  const extIcons: Record<string, string> = {
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📗',
    xlsx: '📗',
    ppt: '📙',
    pptx: '📙',
    zip: '🗜️',
    rar: '🗜️',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    mp4: '🎬',
    mp3: '🎵',
    txt: '📄',
  };

  if (extIcons[ext]) return extIcons[ext];

  // By mime type
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word')) return '📘';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📙';

  return '📎';
}

/**
 * Sanitize HTML for display using DOMPurify
 */
export function sanitizeEmailHtml(html: string): string {
  // Server-side: use regex fallback since DOMPurify needs DOM
  if (typeof window === 'undefined') {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
      .replace(/src\s*=\s*["']data:(?!image)[^"']*["']/gi, 'src=""')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
      .replace(/<input[^>]*>/gi, '')
      .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  }

  // Client-side: use DOMPurify for proper sanitization
  const DOMPurify = require('dompurify');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'img', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'pre', 'code', 'hr', 'sup', 'sub', 'small'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'width', 'height', 'align', 'valign', 'bgcolor', 'color', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan'],
  });
}

/**
 * Convert plain URLs in text to links
 */
export function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Quote email for reply
 */
export function quoteEmailForReply(message: EmailMessage): string {
  const date = formatEmailDate(message.received_at, true);
  const from = formatEmailAddress(message.from);

  const quotedContent = message.body_html || message.body_text;

  return `
<br/><br/>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px; color: #666;">
  <p>On ${date}, ${from} wrote:</p>
  ${quotedContent}
</div>
`;
}

/**
 * Generate forward header
 */
export function generateForwardHeader(message: EmailMessage): string {
  const date = formatEmailDate(message.received_at, true);
  const from = formatEmailAddress(message.from);
  const to = formatEmailAddresses(message.to);
  const cc = message.cc.length > 0 ? formatEmailAddresses(message.cc) : null;

  return `
<br/><br/>
<div style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px;">
  <p>---------- Forwarded message ---------</p>
  <p><strong>From:</strong> ${from}</p>
  <p><strong>Date:</strong> ${date}</p>
  <p><strong>Subject:</strong> ${message.subject}</p>
  <p><strong>To:</strong> ${to}</p>
  ${cc ? `<p><strong>Cc:</strong> ${cc}</p>` : ''}
</div>
<br/>
${message.body_html || message.body_text}
`;
}

export default {
  formatEmailAddress,
  formatEmailAddresses,
  parseEmailAddress,
  parseEmailAddresses,
  isValidEmailAddress,
  getEmailInitials,
  getDisplayName,
  formatFileSize,
  formatEmailDate,
  formatRelativeTime,
  truncateText,
  generateSnippet,
  getFolderIcon,
  getFolderDisplayName,
  getFolderColor,
  getDefaultFolderStats,
  sortEmailsByDate,
  groupEmailsByDate,
  filterEmails,
  extractAllRecipients,
  isInternalEmail,
  getAttachmentIcon,
  sanitizeEmailHtml,
  linkifyText,
  quoteEmailForReply,
  generateForwardHeader,
};
