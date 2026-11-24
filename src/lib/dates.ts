// Date helpers. Dates are plain local "YYYY-MM-DD" strings to avoid time-zone surprises.

export const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayKey = () => toKey(new Date())

export function addDays(k: string, n: number): string {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export function addYears(k: string, n: number): string {
  const [y, m, d] = k.split('-').map(Number)
  const ty = y + n
  // 2/29 in a non-leap target year falls back to 2/28
  const day = m === 2 && d === 29 && !isLeap(ty) ? 28 : d
  return `${ty}-${pad(m)}-${pad(day)}`
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
export const yearOf = (k: string) => Number(k.slice(0, 4))
export const monthDay = (k: string) => k.slice(5)

/** Which month-day values count as "the same day" as k, for the across-the-years view. */
export function sameDayKeys(k: string): string[] {
  const md = monthDay(k)
  // 2/28 also shows 2/29 entries (leap days would otherwise only surface every 4 years), and vice versa
  if (md === '02-28') return ['02-28', '02-29']
  if (md === '02-29') return ['02-29', '02-28']
  return [md]
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export const weekday = (k: string) => WEEK[fromKey(k).getDay()]

export function formatLong(k: string): string {
  const [y, m, d] = k.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${weekday(k)})`
}

export function formatShort(k: string): string {
  const [, m, d] = k.split('-').map(Number)
  return `${m}월 ${d}일`
}

let lunarFmt: Intl.DateTimeFormat | null | undefined
/** Lunar (음력) month/day via the browser's Chinese calendar; empty string if unsupported. */
export function lunar(k: string): string {
  if (lunarFmt === undefined) {
    try {
      lunarFmt = new Intl.DateTimeFormat('ko-KR-u-ca-chinese', { month: 'numeric', day: 'numeric' })
    } catch {
      lunarFmt = null
    }
  }
  if (!lunarFmt) return ''
  const parts = lunarFmt.formatToParts(fromKey(k))
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  if (!m || !d) return ''
  const leap = /윤|bis/i.test(m)
  return `음 ${leap ? '윤' : ''}${m.replace(/\D/g, '')}.${d.replace(/\D/g, '')}`
}

export function yearsAgoLabel(viewYear: number, entryYear: number): string {
  const diff = viewYear - entryYear
  if (diff === 0) return '올해'
  if (diff > 0) return `${diff}년 전`
  return `${-diff}년 후`
}
