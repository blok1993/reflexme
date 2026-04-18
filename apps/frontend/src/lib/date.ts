/**
 * Returns today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * Using toISOString() gives UTC which is wrong for users in timezones
 * that differ from UTC (e.g. UTC+3 user at 01:00 would see "yesterday").
 */
export function getTodayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDateRu(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00');
  return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDateShortRu(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00');
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatDateWithWeekdayRu(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00');
  const weekday = date.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  // Capitalise weekday
  return weekday.charAt(0).toUpperCase() + weekday.slice(1) + ', ' + dayMonth;
}

export function getWeekRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
}

export function isEvening(): boolean {
  return new Date().getHours() >= 17;
}

export function getGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const greeting =
    hour >= 0 && hour < 6  ? 'Доброй ночи' :
    hour < 12              ? 'Доброе утро' :
    hour < 17              ? 'Добрый день' :
    hour < 23              ? 'Добрый вечер' :
                             'Доброй ночи';
  return name ? `${greeting}, ${name}` : greeting;
}

/** Hours and minutes until 17:00 (start of evening review window). */
export function timeUntilEvening(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour >= 17) return '';
  const totalMinutes = (17 - hour) * 60 - minute;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `через ${m} мин`;
  if (m === 0) {
    return `через ${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'}`;
  }
  return `через ${h} ч ${m} мин`;
}
