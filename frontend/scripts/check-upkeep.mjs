import { createPublicClient, http, keccak256, toBytes } from 'viem';
import { baseSepolia } from 'viem/chains';

const rpcUrl = "https://base-sepolia.g.alchemy.com/v2/E-6fpPcY27-RuNE3AWIthyE-sXKSqeRl"

const REGISTRY = '0x91D4a4C3D448c7f3CB477332B1c7D420a5810aC3'; // Base Sepolia

const REGISTRY_ABI = [
  { type: 'function', name: 'getUpkeepCount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'getActiveUpkeepIDs', stateMutability: 'view', inputs: [ { name: 'startIndex', type: 'uint256' }, { name: 'maxCount', type: 'uint256' } ], outputs: [{ name: '', type: 'uint256[]' }] },
  { type: 'function', name: 'getUpkeep', stateMutability: 'view', inputs: [ { name: 'id', type: 'uint256' } ], outputs: [ { name: 'upkeep', type: 'tuple', components: [
      { name: 'target', type: 'address' },
      { name: 'executeGas', type: 'uint32' },
      { name: 'checkData', type: 'bytes' },
      { name: 'balance', type: 'uint96' },
      { name: 'admin', type: 'address' },
      { name: 'maxValidBlocknumber', type: 'uint64' },
      { name: 'amountSpent', type: 'uint96' },
      { name: 'paused', type: 'bool' },
    ] } ] },
] ;

async function findUpkeepId(target, { pageSize = 1000n } = {}) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  let total = null;
  try {
    total = await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getUpkeepCount', args: [] });
    console.log('Total upkeeps:', total.toString());
  } catch (e) {
    console.warn('getUpkeepCount reverted; falling back to log scan only');
  }

  if (total !== null) {
    let start = 0n;
    while (start < total) {
      const remaining = total - start;
      const count = remaining > pageSize ? pageSize : remaining;
      console.log(`Scanning IDs from ${start.toString()} count ${count.toString()}`);
      const ids = await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getActiveUpkeepIDs', args: [start, count] });
      for (const id of ids) {
        const info = await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getUpkeep', args: [id] });
        const upkeepTarget = info?.target || info?.[0];
        if (upkeepTarget && String(upkeepTarget).toLowerCase() === target.toLowerCase()) {
          return id;
        }
      }
      start += count;
    }
  }

  // Fallback: logs scan
  const sig = 'UpkeepRegistered(uint256,address,uint32,address)';
  const topic0 = keccak256(toBytes(sig));
  const targetTopic = ('0x' + '0'.repeat(24) + target.toLowerCase().slice(2));
  console.log('Scanning logs with topic0', topic0, 'target', targetTopic);
  const latest = await client.getBlockNumber();
  const windowSize = 10n; // free tier limit
  let foundId = null;
  for (let from = 0n; from <= latest; from += windowSize) {
    const to = from + windowSize - 1n > latest ? latest : from + windowSize - 1n;
    try {
      const logs = await client.getLogs({ address: REGISTRY, fromBlock: from, toBlock: to, topics: [topic0, targetTopic] });
      if (logs.length) {
        console.log(`Matched logs in range [${from.toString()}, ${to.toString()}]:`, logs.length);
        const last = logs[logs.length - 1];
        const data = last.data;
        if (data && data.length >= 66) {
          const idHex = '0x' + data.slice(2, 66);
          const id = BigInt(idHex);
          const info = await client.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: 'getUpkeep', args: [id] });
          const upkeepTarget = info?.target || info?.[0];
          if (upkeepTarget && String(upkeepTarget).toLowerCase() === target.toLowerCase()) {
            foundId = id;
            break;
          }
        }
      }
    } catch (e) {
      // keep scanning; provider may occasionally throttle
    }
  }
  if (foundId) return foundId;
  return null;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node scripts/check-upkeep.mjs <walletAddress>');
    process.exit(1);
  }
  const id = await findUpkeepId(target);
  if (id) {
    console.log('Found Upkeep ID:', id.toString());
    console.log(`Upkeep page: https://automation.chain.link/base-sepolia/upkeeps/${id.toString()}`);
  } else {
    console.log('No upkeep found for target');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


