import { createPublicClient, http, Address } from 'viem';
import type { AbiEvent } from 'viem';
import { baseSepolia, base } from 'viem/chains';
 

// Prefer chain default RPC to avoid invalid/expired keys; allow override via env
const RPC_OVERRIDE = process.env.BASE_SEPOLIA_RPC_URL;

// Chainlink Automation Registry (Base Sepolia)
export const BASE_SEPOLIA_REGISTRY_ADDRESS = (process.env.CHAINLINK_BASE_SEPOLIA_REGISTRY || '0x91D4a4C3D448c7f3CB477332B1c7D420a5810aC3') as Address;

// Minimal ABI for the Registry methods we need
const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getUpkeepCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getActiveUpkeepIDs',
    stateMutability: 'view',
    inputs: [
      { name: 'startIndex', type: 'uint256' },
      { name: 'maxCount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    // UpkeepInfo struct – we only rely on the first field (target)
    type: 'function',
    name: 'getUpkeep',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        name: 'upkeep',
        type: 'tuple',
        components: [
          { name: 'target', type: 'address' },
          { name: 'executeGas', type: 'uint32' },
          { name: 'checkData', type: 'bytes' },
          { name: 'balance', type: 'uint96' },
          { name: 'admin', type: 'address' },
          { name: 'maxValidBlocknumber', type: 'uint64' },
          { name: 'amountSpent', type: 'uint96' },
          { name: 'paused', type: 'bool' },
        ],
      },
    ],
  },
] as const;

// event UpkeepRegistered(uint256 indexed id, address indexed target, uint32 executeGas, address admin)
const UPKEEP_REGISTERED_EVENT = {
  type: 'event',
  name: 'UpkeepRegistered',
  inputs: [
    { name: 'id', type: 'uint256', indexed: true },
    { name: 'target', type: 'address', indexed: true },
    { name: 'executeGas', type: 'uint32', indexed: false },
    { name: 'admin', type: 'address', indexed: false },
  ],
} as const satisfies AbiEvent;

export async function findUpkeepIdForTarget(
  target: Address,
  opts?: {
    chainId?: number; // 84532 Base Sepolia, 8453 Base
    registry?: Address;
    pageSize?: number; // default 1000
    rpcUrls?: string[]; // optional RPC fallbacks
    errorLimit?: number; // max network errors before aborting (default 10)
    lastBlocks?: number; // only scan last N blocks for logs (default 1,000,000)
    maxActiveScan?: number; // only scan first N active ids (default 1000)
  }
): Promise<bigint | null> {
  const chain = opts?.chainId === 8453 ? base : baseSepolia;
  const registry = (opts?.registry || BASE_SEPOLIA_REGISTRY_ADDRESS) as Address;
  const rpcCandidates = [
    ...(opts?.rpcUrls || []),
    ...(RPC_OVERRIDE ? [RPC_OVERRIDE] : []),
    ...chain.rpcUrls.default.http,
  ].filter(Boolean);

  // Try endpoints in order until one responds
  let client = createPublicClient({ chain, transport: http(rpcCandidates[0]!) });
  let errorCount = 0;
  const maxErrors = Math.max(1, opts?.errorLimit ?? 10);
  const onError = () => { errorCount++; if (errorCount >= maxErrors) throw new Error('network-limit'); };
  try {
    await client.getBlockNumber();
  } catch {
    for (let i = 1; i < rpcCandidates.length; i++) {
      try {
        const c = createPublicClient({ chain, transport: http(rpcCandidates[i]!) });
        await c.getBlockNumber();
        client = c;
        break;
      } catch { onError(); }
    }
  }

  // Attempt a single-page active IDs scan (bounded)
  try {
    const maxIds = BigInt(Math.max(1, opts?.maxActiveScan ?? Math.min(1000, Number(opts?.pageSize ?? 1000))));
    const ids = (await client.readContract({
      address: registry,
      abi: REGISTRY_ABI as any,
      functionName: 'getActiveUpkeepIDs',
      args: [BigInt(0), maxIds],
    })) as bigint[];
    for (const id of ids) {
      try {
        const info = (await client.readContract({
          address: registry,
          abi: REGISTRY_ABI as any,
          functionName: 'getUpkeep',
          args: [id],
        })) as { target: Address } | any;
        const upkeepTarget: Address = (info?.target || (info?.[0] as Address)) as Address;
        if (upkeepTarget && upkeepTarget.toLowerCase() === target.toLowerCase()) {
          return id;
        }
      } catch { onError(); }
    }
  } catch { onError(); }

  // Fallback: scan UpkeepRegistered logs (target indexed)
  try {
    // Chunked scan to reduce node pressure
    const latest = await client.getBlockNumber().catch((e) => { onError(); throw e; });
    const span = BigInt(Math.max(1, opts?.lastBlocks ?? 1_000_000));
    const fromStart = latest > span ? latest - span : BigInt(0);
    let found: bigint | null = null;
    try {
      const logs = await client.getLogs({
        address: registry,
        event: UPKEEP_REGISTERED_EVENT,
        args: { target },
        fromBlock: fromStart,
        toBlock: latest,
        strict: true,
      });
      if (logs.length > 0) found = logs[logs.length - 1].args.id as bigint;
    } catch (_) { onError(); }
    if (found) return found;
  } catch (err) {
    // ignore and fall through
  }
  return null;
}

export async function hasUpkeepForTarget(
  target: Address,
  opts?: { chainId?: number; registry?: Address; pageSize?: number }
): Promise<boolean> {
  const id = await findUpkeepIdForTarget(target, opts);
  return id !== null;
}


