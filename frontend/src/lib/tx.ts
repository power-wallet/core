'use client';

import { parseUnits } from 'viem';

type AnyAbi = readonly any[];

function gweiStringFromWei(v?: bigint): string | undefined {
  if (v === undefined) return undefined;
  const gwei = 1_000_000_000n;
  const whole = v / gwei;
  const frac = v % gwei;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

type WriteWithFeesParams = {
  write: (args: any) => Promise<`0x${string}`>;
  client?: {
    estimateFeesPerGas?: () => Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }>;
    estimateContractGas?: (args: any) => Promise<bigint>;
  } | null;
  address: `0x${string}`;
  abi: AnyAbi;
  functionName: string;
  args: any[];
  account?: `0x${string}`;
  overrides?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gas?: bigint };
};

export async function writeWithFees({ write, client, address, abi, functionName, args, account, overrides }: WriteWithFeesParams): Promise<`0x${string}`> {
  // Gas: try to estimate and add a buffer. This avoids wallets sometimes choosing absurd gas limits.
  let gas: bigint | undefined = overrides?.gas;
  if (!gas && client?.estimateContractGas && account) {
    try {
      const est = await client.estimateContractGas({ address, abi, functionName, args, account } as any);
      // 25% buffer, with a sane cap (prevents impossible block gas limits).
      const buffered = (est * 125n) / 100n;
      gas = buffered > 10_000_000n ? 10_000_000n : buffered;
    } catch {}
  }

  let maxFeePerGas: bigint | undefined = overrides?.maxFeePerGas;
  let maxPriorityFeePerGas: bigint | undefined = overrides?.maxPriorityFeePerGas;

  // Fees: only set EIP-1559 fees when we have sane estimates; otherwise let the wallet estimate.
  if ((!maxFeePerGas || !maxPriorityFeePerGas) && client?.estimateFeesPerGas) {
    try {
      const fees = await client.estimateFeesPerGas();
      const floor = parseUnits('0.001', 9); // requested absolute minimum

      const estMax = fees?.maxFeePerGas;
      const estPrio = fees?.maxPriorityFeePerGas;

      // If RPC gives nonsense (e.g. 0/1 wei), do not override wallet fee logic.
      const estLooksSane = Boolean(estMax && estMax > 0n);
      if (estLooksSane) {
        const boostedMax = (estMax! * 120n) / 100n;
        const boostedPrio = estPrio ? (estPrio * 120n) / 100n : parseUnits('0.05', 9);
        maxFeePerGas = maxFeePerGas ?? boostedMax;
        maxPriorityFeePerGas = maxPriorityFeePerGas ?? boostedPrio;
        // apply requested floors
        if (maxFeePerGas < floor) maxFeePerGas = floor;
        if (maxPriorityFeePerGas < floor) maxPriorityFeePerGas = floor;
        if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas;
      }
    } catch {}
  }

  // Enforce requested absolute floors even if estimates are missing/bad.
  const floor = parseUnits('0.001', 9); // 0.001 gwei
  if (!maxPriorityFeePerGas || maxPriorityFeePerGas < floor) maxPriorityFeePerGas = floor;
  if (!maxFeePerGas || maxFeePerGas < floor) maxFeePerGas = floor;
  if (maxFeePerGas < maxPriorityFeePerGas) maxFeePerGas = maxPriorityFeePerGas;

  // Debug logs to verify fee values being sent (requested)
  try {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[tx] writeWithFees', {
        functionName,
        to: address,
        gas: gas?.toString(),
        maxFeePerGasWei: maxFeePerGas?.toString(),
        maxFeePerGasGwei: gweiStringFromWei(maxFeePerGas),
        maxPriorityFeePerGasWei: maxPriorityFeePerGas?.toString(),
        maxPriorityFeePerGasGwei: gweiStringFromWei(maxPriorityFeePerGas),
      });
    }
  } catch {}

  const hash = await write({
    address,
    abi,
    functionName,
    args,
    ...(gas ? { gas } : {}),
    ...(maxFeePerGas ? { maxFeePerGas } : {}),
    ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
  });
  return hash as `0x${string}`;
}


