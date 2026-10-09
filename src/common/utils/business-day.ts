// DICA business days use Vietnam time (UTC+07), independent of the server TZ.
export function endOfBusinessDay(date: Date): Date {
  const offset = 7 * 60 * 60 * 1000;
  const local = new Date(date.getTime() + offset);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + 1,
    ) - offset,
  );
}
