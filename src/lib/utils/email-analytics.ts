/**
 * Email Analytics Utilities
 *
 * Functions for calculating email statistics, response times,
 * volume trends, top contacts, and unread summaries.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailMessage {
  id: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  subject: string
  date: string
  is_read: boolean
  folder: string
  labels?: string[]
}

export interface EmailStats {
  totalSent: number
  totalReceived: number
  avgResponseTimeMs: number
  avgResponseTimeHuman: string
  busiestDay: string
  busiestHour: number
}

export interface ResponseTimeMetrics {
  avgMs: number
  avgHuman: string
  fastestMs: number
  fastestHuman: string
  slowestMs: number
  slowestHuman: string
  medianMs: number
  medianHuman: string
  sampleSize: number
}

export interface DayVolume {
  date: string // YYYY-MM-DD
  label: string // "Mon 24"
  sent: number
  received: number
  total: number
}

export interface TopContact {
  email: string
  name: string
  sentCount: number
  receivedCount: number
  totalCount: number
  lastInteraction: string
}

export interface UnreadSummary {
  total: number
  byFolder: Record<string, number>
  byLabel: Record<string, number>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function msToHuman(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr)
}

// ---------------------------------------------------------------------------
// calculateEmailStats
// ---------------------------------------------------------------------------

/**
 * Calculate overall email statistics.
 * "Sent" = emails in the "sent" folder; everything else = "received".
 */
export function calculateEmailStats(emails: EmailMessage[]): EmailStats {
  if (emails.length === 0) {
    return {
      totalSent: 0,
      totalReceived: 0,
      avgResponseTimeMs: 0,
      avgResponseTimeHuman: '0m',
      busiestDay: 'N/A',
      busiestHour: 0,
    }
  }

  let totalSent = 0
  let totalReceived = 0
  const dayCount: Record<number, number> = {}
  const hourCount: Record<number, number> = {}

  for (const email of emails) {
    const isSent = email.folder.toLowerCase() === 'sent'
    if (isSent) totalSent++
    else totalReceived++

    const d = parseDate(email.date)
    if (!isNaN(d.getTime())) {
      const day = d.getDay()
      const hour = d.getHours()
      dayCount[day] = (dayCount[day] || 0) + 1
      hourCount[hour] = (hourCount[hour] || 0) + 1
    }
  }

  // Busiest day
  let busiestDayIdx = 0
  let busiestDayCount = 0
  for (const [day, count] of Object.entries(dayCount)) {
    if (count > busiestDayCount) {
      busiestDayCount = count
      busiestDayIdx = Number(day)
    }
  }

  // Busiest hour
  let busiestHour = 0
  let busiestHourCount = 0
  for (const [hour, count] of Object.entries(hourCount)) {
    if (count > busiestHourCount) {
      busiestHourCount = count
      busiestHour = Number(hour)
    }
  }

  // Avg response time: pair sent emails with the next received email from the
  // same contact (simplified heuristic: match by email thread subject prefix)
  const sentEmails = emails.filter((e) => e.folder.toLowerCase() === 'sent')
  const receivedEmails = emails.filter((e) => e.folder.toLowerCase() !== 'sent')
  const responseMetrics = getResponseTimeMetrics(sentEmails, receivedEmails)

  return {
    totalSent,
    totalReceived,
    avgResponseTimeMs: responseMetrics.avgMs,
    avgResponseTimeHuman: responseMetrics.avgHuman,
    busiestDay: DAY_NAMES[busiestDayIdx],
    busiestHour,
  }
}

// ---------------------------------------------------------------------------
// getResponseTimeMetrics
// ---------------------------------------------------------------------------

/**
 * Calculate response time metrics by pairing sent emails with received replies.
 *
 * Heuristic: For each sent email, find the earliest received email from any of
 * the recipients that arrives after the sent time (within 7 days). Uses subject
 * similarity (Re: prefix stripped) and recipient matching.
 */
export function getResponseTimeMetrics(
  sentEmails: EmailMessage[],
  receivedEmails: EmailMessage[]
): ResponseTimeMetrics {
  const empty: ResponseTimeMetrics = {
    avgMs: 0,
    avgHuman: '0m',
    fastestMs: 0,
    fastestHuman: '0m',
    slowestMs: 0,
    slowestHuman: '0m',
    medianMs: 0,
    medianHuman: '0m',
    sampleSize: 0,
  }

  if (sentEmails.length === 0 || receivedEmails.length === 0) return empty

  const normalizeSubject = (s: string) =>
    s
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .trim()
      .toLowerCase()

  // Sort received by date ascending for efficient scanning
  const sortedReceived = [...receivedEmails].sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
  )

  const responseTimes: number[] = []
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  for (const sent of sentEmails) {
    const sentTime = parseDate(sent.date).getTime()
    if (isNaN(sentTime)) continue

    const sentSubject = normalizeSubject(sent.subject)
    const recipientEmails = new Set(sent.to.map((r) => r.email.toLowerCase()))

    for (const received of sortedReceived) {
      const recvTime = parseDate(received.date).getTime()
      if (isNaN(recvTime) || recvTime <= sentTime) continue
      if (recvTime - sentTime > SEVEN_DAYS_MS) break

      const fromEmail = received.from.email.toLowerCase()
      const recvSubject = normalizeSubject(received.subject)

      if (recipientEmails.has(fromEmail) && recvSubject === sentSubject) {
        responseTimes.push(recvTime - sentTime)
        break
      }
    }
  }

  if (responseTimes.length === 0) return empty

  responseTimes.sort((a, b) => a - b)

  const sum = responseTimes.reduce((acc, t) => acc + t, 0)
  const avg = Math.round(sum / responseTimes.length)
  const fastest = responseTimes[0]
  const slowest = responseTimes[responseTimes.length - 1]
  const medianIdx = Math.floor(responseTimes.length / 2)
  const median =
    responseTimes.length % 2 === 0
      ? Math.round((responseTimes[medianIdx - 1] + responseTimes[medianIdx]) / 2)
      : responseTimes[medianIdx]

  return {
    avgMs: avg,
    avgHuman: msToHuman(avg),
    fastestMs: fastest,
    fastestHuman: msToHuman(fastest),
    slowestMs: slowest,
    slowestHuman: msToHuman(slowest),
    medianMs: median,
    medianHuman: msToHuman(median),
    sampleSize: responseTimes.length,
  }
}

// ---------------------------------------------------------------------------
// getEmailVolumeByDay
// ---------------------------------------------------------------------------

/**
 * Returns chart-ready data: email count per day for the last N days.
 */
export function getEmailVolumeByDay(emails: EmailMessage[], days: number = 30): DayVolume[] {
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  // Build date range
  const result: DayVolume[] = []
  const dateMap = new Map<string, DayVolume>()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const key = toDateKey(d)
    const entry: DayVolume = {
      date: key,
      label: `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`,
      sent: 0,
      received: 0,
      total: 0,
    }
    result.push(entry)
    dateMap.set(key, entry)
  }

  // Tally emails
  for (const email of emails) {
    const d = parseDate(email.date)
    if (isNaN(d.getTime())) continue
    const key = toDateKey(d)
    const entry = dateMap.get(key)
    if (!entry) continue

    const isSent = email.folder.toLowerCase() === 'sent'
    if (isSent) entry.sent++
    else entry.received++
    entry.total++
  }

  return result
}

// ---------------------------------------------------------------------------
// getTopContacts
// ---------------------------------------------------------------------------

/**
 * Returns the most frequently emailed contacts, ranked by total interaction count.
 */
export function getTopContacts(emails: EmailMessage[], limit: number = 10): TopContact[] {
  const contactMap = new Map<
    string,
    { name: string; sentCount: number; receivedCount: number; lastDate: string }
  >()

  const updateContact = (
    email: string,
    name: string,
    type: 'sent' | 'received',
    date: string
  ) => {
    const key = email.toLowerCase()
    const existing = contactMap.get(key)
    if (existing) {
      if (type === 'sent') existing.sentCount++
      else existing.receivedCount++
      // Keep the most descriptive name
      if (name && name.length > existing.name.length) existing.name = name
      // Keep latest date
      if (date > existing.lastDate) existing.lastDate = date
    } else {
      contactMap.set(key, {
        name: name || email,
        sentCount: type === 'sent' ? 1 : 0,
        receivedCount: type === 'received' ? 1 : 0,
        lastDate: date,
      })
    }
  }

  for (const msg of emails) {
    const isSent = msg.folder.toLowerCase() === 'sent'
    if (isSent) {
      // Count each recipient
      for (const recipient of msg.to) {
        updateContact(recipient.email, recipient.name, 'sent', msg.date)
      }
    } else {
      // Count the sender
      updateContact(msg.from.email, msg.from.name, 'received', msg.date)
    }
  }

  const contacts: TopContact[] = []
  for (const [email, data] of contactMap) {
    contacts.push({
      email,
      name: data.name,
      sentCount: data.sentCount,
      receivedCount: data.receivedCount,
      totalCount: data.sentCount + data.receivedCount,
      lastInteraction: data.lastDate,
    })
  }

  contacts.sort((a, b) => b.totalCount - a.totalCount)
  return contacts.slice(0, limit)
}

// ---------------------------------------------------------------------------
// getUnreadSummary
// ---------------------------------------------------------------------------

/**
 * Summarise unread emails by folder and label.
 */
export function getUnreadSummary(emails: EmailMessage[]): UnreadSummary {
  const summary: UnreadSummary = {
    total: 0,
    byFolder: {},
    byLabel: {},
  }

  for (const email of emails) {
    if (email.is_read) continue

    summary.total++

    const folder = email.folder || 'inbox'
    summary.byFolder[folder] = (summary.byFolder[folder] || 0) + 1

    if (email.labels) {
      for (const label of email.labels) {
        summary.byLabel[label] = (summary.byLabel[label] || 0) + 1
      }
    }
  }

  return summary
}
