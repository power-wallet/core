export function formatUsd0(n?: number) {
  if (n === undefined) return '-';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function formatUsd6Bigint(v?: bigint) {
  if (!v) return '$0.00';
  const num = Number(v) / 1_000_000;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatTokenAmountBigint(amount?: bigint, decimals?: number) {
  if (amount === undefined || decimals === undefined) return '0';
  if (amount === BigInt(0)) return '0';
  const s = amount.toString();
  if (decimals === 0) return s;
  if (s.length > decimals) {
    const whole = s.slice(0, s.length - decimals);
    const frac = s.slice(s.length - decimals).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole;
  } else {
    const zeros = '0'.repeat(decimals - s.length);
    const frac = `${zeros}${s}`.replace(/0+$/, '');
    return frac ? `0.${frac}` : '0';
  }
}

export function formatAllowance(amount?: bigint) {
  if (amount === undefined) return '0';
  if (amount === BigInt(0)) return '0';
  return formatTokenAmountBigint(amount, 6);
}

export function formatDate(ts?: bigint | number) {
  if (ts === undefined) return '';
  const n = typeof ts === 'number' ? ts : Number(ts);
  return new Date(n * 1000).toLocaleString();
}

export function formatDateOnly(ts?: bigint | number) {
  if (ts === undefined) return '';
  const n = typeof ts === 'number' ? ts : Number(ts);
  return new Date(n * 1000).toLocaleDateString();
}

export function formatDateTime(ts?: bigint | number) {
  if (ts === undefined) return '';
  const n = typeof ts === 'number' ? ts : Number(ts);
  return new Date(n * 1000).toLocaleString();
}


