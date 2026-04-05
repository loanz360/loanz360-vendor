/**
 * Email Address Generator
 * Auto-generates company email addresses in firstname.lastname format
 */

/**
 * Email format types
 */
export type EmailFormat =
  | 'firstname.lastname'    // john.doe@domain.com
  | 'firstnamelastname'     // johndoe@domain.com
  | 'firstname_lastname'    // john_doe@domain.com
  | 'f.lastname'            // j.doe@domain.com
  | 'firstname.l'           // john.d@domain.com
  | 'flastname'             // jdoe@domain.com
  | 'lastnamef'             // doej@domain.com
  | 'lastname.firstname'    // doe.john@domain.com
  | 'employee_id';          // EMP001@domain.com

/**
 * Name parsing result
 */
interface ParsedName {
  firstName: string;
  lastName: string;
  middleName?: string;
}

/**
 * Email generation result
 */
export interface GeneratedEmail {
  email: string;
  localPart: string;
  domain: string;
  displayName: string;
}

/**
 * Clean and normalize a name part
 */
function cleanNamePart(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove diacritics/accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special characters except letters
    .replace(/[^a-z]/g, '')
    // Limit length
    .substring(0, 50);
}

/**
 * Parse full name into parts
 */
export function parseName(fullName: string): ParsedName {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: 'user', lastName: 'employee' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'employee' };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }

  // Three or more parts - first is first name, last is last name, middle is optional
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Generate email local part based on format
 */
export function generateLocalPart(
  firstName: string,
  lastName: string,
  format: EmailFormat = 'firstname.lastname',
  employeeId?: string
): string {
  const first = cleanNamePart(firstName);
  const last = cleanNamePart(lastName);

  // Fallbacks for empty names
  const f = first || 'user';
  const l = last || 'employee';

  switch (format) {
    case 'firstname.lastname':
      return `${f}.${l}`;

    case 'firstnamelastname':
      return `${f}${l}`;

    case 'firstname_lastname':
      return `${f}_${l}`;

    case 'f.lastname':
      return `${f.charAt(0)}.${l}`;

    case 'firstname.l':
      return `${f}.${l.charAt(0)}`;

    case 'flastname':
      return `${f.charAt(0)}${l}`;

    case 'lastnamef':
      return `${l}${f.charAt(0)}`;

    case 'lastname.firstname':
      return `${l}.${f}`;

    case 'employee_id':
      return employeeId?.toLowerCase().replace(/[^a-z0-9]/g, '') || `emp${Date.now()}`;

    default:
      return `${f}.${l}`;
  }
}

/**
 * Check if email exists (to be implemented with database)
 */
export type EmailExistsChecker = (email: string) => Promise<boolean>;

/**
 * Generate unique email address
 */
export async function generateUniqueEmail(
  firstName: string,
  lastName: string,
  domain: string,
  format: EmailFormat = 'firstname.lastname',
  checkExists?: EmailExistsChecker,
  employeeId?: string
): Promise<GeneratedEmail> {
  const baseLocalPart = generateLocalPart(firstName, lastName, format, employeeId);
  let localPart = baseLocalPart;
  let counter = 0;
  let email = `${localPart}@${domain}`;

  // If checker provided, find unique email
  if (checkExists) {
    while (await checkExists(email)) {
      counter++;
      localPart = `${baseLocalPart}${counter}`;
      email = `${localPart}@${domain}`;

      // Safety limit
      if (counter > 100) {
        // Use timestamp as fallback
        localPart = `${baseLocalPart}${Date.now().toString(36)}`;
        email = `${localPart}@${domain}`;
        break;
      }
    }
  }

  // Generate display name
  const parsedFirst = firstName.trim() || 'User';
  const parsedLast = lastName.trim() || '';
  const displayName = [parsedFirst, parsedLast].filter(Boolean).join(' ');

  return {
    email,
    localPart,
    domain,
    displayName: displayName || localPart,
  };
}

/**
 * Generate email from full name
 */
export async function generateEmailFromFullName(
  fullName: string,
  domain: string,
  format: EmailFormat = 'firstname.lastname',
  checkExists?: EmailExistsChecker,
  employeeId?: string
): Promise<GeneratedEmail> {
  const { firstName, lastName } = parseName(fullName);
  return generateUniqueEmail(firstName, lastName, domain, format, checkExists, employeeId);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validate email domain
 */
export function isCompanyEmail(email: string, companyDomain: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === companyDomain.toLowerCase();
}

/**
 * Extract name from email
 */
export function extractNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0];

  // Try different separators
  let parts: string[] = [];
  if (localPart.includes('.')) {
    parts = localPart.split('.');
  } else if (localPart.includes('_')) {
    parts = localPart.split('_');
  } else {
    // Try to split camelCase or by numbers
    parts = localPart.split(/(?=[A-Z])|[0-9]+/).filter(Boolean);
  }

  if (parts.length >= 2) {
    return {
      firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
      lastName: parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1),
    };
  }

  return {
    firstName: localPart.charAt(0).toUpperCase() + localPart.slice(1),
    lastName: '',
  };
}

/**
 * Generate multiple email suggestions
 */
export function generateEmailSuggestions(
  firstName: string,
  lastName: string,
  domain: string
): string[] {
  const formats: EmailFormat[] = [
    'firstname.lastname',
    'firstnamelastname',
    'f.lastname',
    'firstname.l',
    'flastname',
  ];

  const suggestions = new Set<string>();

  for (const format of formats) {
    const localPart = generateLocalPart(firstName, lastName, format);
    suggestions.add(`${localPart}@${domain}`);
  }

  return Array.from(suggestions);
}

/**
 * Batch generate emails for multiple users
 */
export async function batchGenerateEmails(
  users: Array<{ firstName: string; lastName: string; employeeId?: string }>,
  domain: string,
  format: EmailFormat = 'firstname.lastname',
  checkExists?: EmailExistsChecker
): Promise<Map<string, GeneratedEmail>> {
  const results = new Map<string, GeneratedEmail>();
  const usedEmails = new Set<string>();

  // Create a checker that also considers already generated emails
  const combinedChecker: EmailExistsChecker = async (email: string) => {
    if (usedEmails.has(email.toLowerCase())) return true;
    if (checkExists) return await checkExists(email);
    return false;
  };

  for (const user of users) {
    const key = `${user.firstName}_${user.lastName}_${user.employeeId || ''}`;
    const result = await generateUniqueEmail(
      user.firstName,
      user.lastName,
      domain,
      format,
      combinedChecker,
      user.employeeId
    );

    usedEmails.add(result.email.toLowerCase());
    results.set(key, result);
  }

  return results;
}

export default {
  parseName,
  generateLocalPart,
  generateUniqueEmail,
  generateEmailFromFullName,
  isValidEmail,
  isCompanyEmail,
  extractNameFromEmail,
  generateEmailSuggestions,
  batchGenerateEmails,
};
