import { createPublicClient, http, Address } from 'viem';
import type { AbiEvent } from 'viem';
import { baseSepolia, base } from 'viem/chains';
 

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia.g.alchemy.com/v2/E-6fpPcY27-RuNE3AWIthyE-sXKSqeRl"

// Chainlink Automation Registry (Base Sepolia)
export const BASE_SEPOLIA_REGISTRY_ADDRESS = '0x91D4a4C3D448c7f3CB477332B1c7D420a5810aC3' as Address;

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

// event UpkeepRegistered(uint256 id, address indexed target, uint32 executeGas, address admin)
const UPKEEP_REGISTERED_EVENT = {
  type: 'event',
  name: 'UpkeepRegistered',
  inputs: [
    { name: 'id', type: 'uint256', indexed: false },
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
  }
): Promise<bigint | null> {
  const chain = opts?.chainId === 8453 ? base : baseSepolia;
  const registry = (opts?.registry || BASE_SEPOLIA_REGISTRY_ADDRESS) as Address;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const total = (await client.readContract({
    address: registry,
    abi: REGISTRY_ABI as any,
    functionName: 'getUpkeepCount',
    args: [],
  })) as bigint;

  const pageSize = BigInt(opts?.pageSize ?? 1000);
  let start = BigInt(0);
  while (start < total) {
    const remaining = total - start;
    const count = remaining > pageSize ? pageSize : remaining;
    const ids = (await client.readContract({
      address: registry,
      abi: REGISTRY_ABI as any,
      functionName: 'getActiveUpkeepIDs',
      args: [start, count],
    })) as bigint[];

    for (const id of ids) {
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
    }

    start += count;
  }

  // Fallback: scan UpkeepRegistered logs (target indexed)
  try {
    const logs = await client.getLogs({
      address: registry,
      event: UPKEEP_REGISTERED_EVENT,
      args: { target },
      fromBlock: BigInt(0),
      toBlock: 'latest',
      strict: true,
    });
    if (logs.length > 0) return logs[logs.length - 1].args.id as bigint;
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


