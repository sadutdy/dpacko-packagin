export function now(): Date {
  return new Date();
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addSeconds(date, minutes * 60);
}

export function addDays(date: Date, days: number): Date {
  return addSeconds(date, days * 24 * 60 * 60);
}

export function isExpired(date: Date, reference: Date = now()): boolean {
  return date.getTime() <= reference.getTime();
}
