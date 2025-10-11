export function formatUsd0(n?: number) {
  if (n === undefined) return '-';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}


