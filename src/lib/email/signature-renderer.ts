/**
 * Email Signature Renderer
 * Renders signature templates with user data
 */

import { EmailSignature, SignatureVariables, EmailSocialLinks } from '@/types/email';

/**
 * Default company information
 */
const DEFAULT_COMPANY = {
  name: 'LOANZ360',
  website: 'https://loanz360.com',
  logo: '/images/logo.png',
  tagline: 'Your Trusted Financial Partner',
  address: 'India',
};

/**
 * Variable pattern for template replacement
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Replace template variables with values
 */
export function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(VARIABLE_PATTERN, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Build variables object from user data
 */
export function buildSignatureVariables(userData: {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  designation?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  employee_id?: string;
  address?: string;
  company?: string;
}): SignatureVariables {
  return {
    full_name: userData.full_name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Employee',
    first_name: userData.first_name || userData.full_name?.split(' ')[0] || '',
    last_name: userData.last_name || userData.full_name?.split(' ').slice(1).join(' ') || '',
    designation: userData.designation || '',
    department: userData.department || '',
    phone: userData.phone || '',
    mobile: userData.mobile || userData.phone || '',
    email: userData.email || '',
    company: userData.company || DEFAULT_COMPANY.name,
    employee_id: userData.employee_id || '',
    address: userData.address || DEFAULT_COMPANY.address,
  };
}

/**
 * Render signature HTML with variables
 */
export function renderSignatureHtml(
  signature: EmailSignature,
  variables: SignatureVariables
): string {
  let html = replaceVariables(signature.signature_html, variables as unknown as Record<string, string>);

  // Add logo if enabled
  if (signature.include_logo && signature.logo_url) {
    const logoHtml = `
      <img
        src="${signature.logo_url}"
        alt="${variables.company}"
        width="${signature.logo_width || 150}"
        style="max-width: 100%; height: auto; display: block; margin-bottom: 10px;"
      />
    `;
    html = logoHtml + html;
  }

  // Add social links if present
  if (signature.social_links && Object.keys(signature.social_links).length > 0) {
    const socialHtml = renderSocialLinks(signature.social_links, signature.primary_color);
    html = html + socialHtml;
  }

  return html;
}

/**
 * Render signature plain text with variables
 */
export function renderSignatureText(
  signature: EmailSignature,
  variables: SignatureVariables
): string {
  let text = replaceVariables(signature.signature_text, variables as unknown as Record<string, string>);

  // Add social links as URLs
  if (signature.social_links && Object.keys(signature.social_links).length > 0) {
    const links: string[] = [];
    if (signature.social_links.website) links.push(`Website: ${signature.social_links.website}`);
    if (signature.social_links.linkedin) links.push(`LinkedIn: ${signature.social_links.linkedin}`);
    if (signature.social_links.twitter) links.push(`Twitter: ${signature.social_links.twitter}`);

    if (links.length > 0) {
      text += '\n\n' + links.join('\n');
    }
  }

  return text;
}

/**
 * Render social media links
 */
function renderSocialLinks(links: EmailSocialLinks, primaryColor: string = '#FF6700'): string {
  const socialIcons: Record<string, { icon: string; name: string }> = {
    linkedin: { icon: 'https://cdn-icons-png.flaticon.com/24/174/174857.png', name: 'LinkedIn' },
    twitter: { icon: 'https://cdn-icons-png.flaticon.com/24/733/733579.png', name: 'Twitter' },
    facebook: { icon: 'https://cdn-icons-png.flaticon.com/24/733/733547.png', name: 'Facebook' },
    instagram: { icon: 'https://cdn-icons-png.flaticon.com/24/174/174855.png', name: 'Instagram' },
    website: { icon: 'https://cdn-icons-png.flaticon.com/24/1006/1006771.png', name: 'Website' },
  };

  const activeLinks = Object.entries(links)
    .filter(([, url]) => url && url.trim())
    .map(([platform, url]) => {
      const info = socialIcons[platform];
      if (!info) return '';
      return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; margin-right: 8px;">
          <img src="${info.icon}" alt="${info.name}" width="20" height="20" style="vertical-align: middle;" />
        </a>
      `;
    })
    .filter(Boolean);

  if (activeLinks.length === 0) return '';

  return `
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
      ${activeLinks.join('')}
    </div>
  `;
}

/**
 * Generate default signature HTML template
 */
export function generateDefaultSignatureHtml(): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
  <tr>
    <td style="padding-bottom: 8px;">
      <strong style="font-size: 16px; color: #FF6700;">{{full_name}}</strong>
    </td>
  </tr>
  <tr>
    <td style="padding-bottom: 4px; color: #666666;">
      {{designation}}
    </td>
  </tr>
  <tr>
    <td style="padding-bottom: 4px; color: #666666;">
      {{department}}
    </td>
  </tr>
  <tr>
    <td style="padding-top: 8px; padding-bottom: 4px; border-top: 2px solid #FF6700;">
      <span style="color: #FF6700; font-weight: bold;">{{company}}</span>
    </td>
  </tr>
  <tr>
    <td style="color: #666666;">
      <img src="https://cdn-icons-png.flaticon.com/16/455/455705.png" alt="Email" width="14" style="vertical-align: middle; margin-right: 4px;" />
      <a href="mailto:{{email}}" style="color: #0066cc; text-decoration: none;">{{email}}</a>
    </td>
  </tr>
  <tr>
    <td style="color: #666666; padding-top: 4px;">
      <img src="https://cdn-icons-png.flaticon.com/16/724/724664.png" alt="Phone" width="14" style="vertical-align: middle; margin-right: 4px;" />
      {{phone}}
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Generate default signature plain text template
 */
export function generateDefaultSignatureText(): string {
  return `
--
{{full_name}}
{{designation}}
{{department}}

{{company}}
Email: {{email}}
Phone: {{phone}}
`.trim();
}

/**
 * Generate professional signature HTML template
 */
export function generateProfessionalSignatureHtml(): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.5;">
  <tr>
    <td style="padding-right: 15px; border-right: 3px solid #FF6700; vertical-align: top;">
      <!-- Logo placeholder -->
    </td>
    <td style="padding-left: 15px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <strong style="font-size: 16px; color: #1a1a1a;">{{full_name}}</strong>
          </td>
        </tr>
        <tr>
          <td style="color: #FF6700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 2px;">
            {{designation}}
          </td>
        </tr>
        <tr>
          <td style="color: #666666; padding-top: 2px;">
            {{department}} | {{company}}
          </td>
        </tr>
        <tr>
          <td style="padding-top: 10px;">
            <table cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #666666;">
              <tr>
                <td style="padding-right: 15px;">
                  📧 <a href="mailto:{{email}}" style="color: #0066cc; text-decoration: none;">{{email}}</a>
                </td>
                <td>
                  📱 {{phone}}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Generate minimal signature HTML template
 */
export function generateMinimalSignatureHtml(): string {
  return `
<div style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
  <strong style="color: #333333;">{{full_name}}</strong> | {{designation}}<br/>
  <span style="color: #FF6700;">{{company}}</span> | {{email}} | {{phone}}
</div>
`.trim();
}

/**
 * Create signature with wrapper
 */
export function wrapSignatureHtml(
  signatureHtml: string,
  position: 'top' | 'bottom' = 'bottom',
  separator: string = '--'
): string {
  const separatorHtml = separator
    ? `<div style="color: #999999; margin: 16px 0 8px 0;">${separator}</div>`
    : '';

  return `
<div class="email-signature" style="margin-top: 20px;">
  ${separatorHtml}
  ${signatureHtml}
</div>
`.trim();
}

/**
 * Insert signature into email body
 */
export function insertSignature(
  emailBody: string,
  signatureHtml: string,
  position: 'top' | 'bottom' = 'bottom',
  separator: string = '--'
): string {
  const wrappedSignature = wrapSignatureHtml(signatureHtml, position, separator);

  if (position === 'top') {
    return wrappedSignature + '\n\n' + emailBody;
  }

  return emailBody + '\n\n' + wrappedSignature;
}

/**
 * Remove existing signature from email body
 */
export function removeSignature(emailBody: string): string {
  // Try to find common signature markers
  const markers = ['--', '---', '____', 'Best regards', 'Kind regards', 'Regards,'];

  for (const marker of markers) {
    const index = emailBody.lastIndexOf(marker);
    if (index !== -1 && index > emailBody.length * 0.5) {
      // Only if marker is in the second half of the email
      return emailBody.substring(0, index).trim();
    }
  }

  // Try to find signature div
  const signatureDiv = emailBody.lastIndexOf('<div class="email-signature"');
  if (signatureDiv !== -1) {
    return emailBody.substring(0, signatureDiv).trim();
  }

  return emailBody;
}

/**
 * Preview signature with sample data
 */
export function previewSignature(signature: EmailSignature): {
  html: string;
  text: string;
} {
  const sampleVariables: SignatureVariables = {
    full_name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    designation: 'Senior Manager',
    department: 'Business Development',
    phone: '+91 98765 43210',
    mobile: '+91 98765 43210',
    email: 'john.doe@loanz360.com',
    company: 'LOANZ360',
    employee_id: 'EMP001',
    address: 'Mumbai, India',
  };

  return {
    html: renderSignatureHtml(signature, sampleVariables),
    text: renderSignatureText(signature, sampleVariables),
  };
}

/**
 * Extract variables used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.matchAll(VARIABLE_PATTERN);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validate signature template
 */
export function validateSignatureTemplate(html: string, text: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract variables from both templates
  const htmlVars = extractTemplateVariables(html);
  const textVars = extractTemplateVariables(text);
  const allVars = Array.from(new Set([...htmlVars, ...textVars]));

  // Check for required variables
  const required = ['full_name', 'email'];
  for (const req of required) {
    if (!allVars.includes(req)) {
      warnings.push(`Recommended variable {{${req}}} is missing`);
    }
  }

  // Check for mismatched variables
  const htmlOnly = htmlVars.filter(v => !textVars.includes(v));
  const textOnly = textVars.filter(v => !htmlVars.includes(v));

  if (htmlOnly.length > 0) {
    warnings.push(`Variables only in HTML: {{${htmlOnly.join('}}, {{')}}}}`);
  }
  if (textOnly.length > 0) {
    warnings.push(`Variables only in text: {{${textOnly.join('}}, {{')}}}}`);
  }

  // Validate HTML structure
  if (!html.includes('</') && html.includes('<')) {
    errors.push('HTML appears to have unclosed tags');
  }

  // Check for unsafe content
  if (html.includes('<script') || html.includes('javascript:')) {
    errors.push('HTML contains potentially unsafe script content');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variables: allVars,
  };
}

export default {
  replaceVariables,
  buildSignatureVariables,
  renderSignatureHtml,
  renderSignatureText,
  generateDefaultSignatureHtml,
  generateDefaultSignatureText,
  generateProfessionalSignatureHtml,
  generateMinimalSignatureHtml,
  wrapSignatureHtml,
  insertSignature,
  removeSignature,
  previewSignature,
  extractTemplateVariables,
  validateSignatureTemplate,
};
