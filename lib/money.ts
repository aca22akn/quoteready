// Money is integer pence everywhere; this is the only formatter.
export function formatPence(pence: number): string {
  const pounds = Math.floor(pence / 100);
  const rest = String(pence % 100).padStart(2, "0");
  return `£${pounds}.${rest}`;
}
