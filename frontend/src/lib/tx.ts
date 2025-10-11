'use client';

import { parseUnits } from 'viem';

type AnyAbi = readonly any[];

type WriteWithFeesParams = {
  write: (args: any) => Promise<`0x${string}`>;
  client?: { estimateFeesPerGas: () => Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> } | null;
  address: `0x${string}`;
  abi: AnyAbi;
  functionName: string;
  args: any[];
  overrides?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint };
};

export async function writeWithFees({ write, client, address, abi, functionName, args, overrides }: WriteWithFeesParams): Promise<`0x${string}`> {
  let maxFeePerGas: bigint | undefined = overrides?.maxFeePerGas;
  let maxPriorityFeePerGas: bigint | undefined = overrides?.maxPriorityFeePerGas;
  if ((!maxFeePerGas || !maxPriorityFeePerGas) && client) {
    try {
      const fees = await client.estimateFeesPerGas();
      maxFeePerGas = maxFeePerGas ?? fees.maxFeePerGas;
      maxPriorityFeePerGas = maxPriorityFeePerGas ?? (fees.maxPriorityFeePerGas ?? parseUnits('1', 9));
    } catch {}
  }
  const hash = await write({ address, abi, functionName, args, ...(maxFeePerGas ? { maxFeePerGas } : {}), ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}) });
  return hash as `0x${string}`;
}


