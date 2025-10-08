import { ethers } from 'hardhat';
import { addresses } from '../../config/addresses';

/**
 * Strategy Registry manager
 *
 * Actions:
 * - register: Register a strategy id to an implementation
 * - remove:   Remove a strategy id
 * - list:     List all strategy ids and verify presence in mapping
 *
 * Usage examples (recommended: env vars to avoid Hardhat arg parsing):
 *   ACTION=list CHAIN=base-sepolia npx hardhat run scripts/manage/strategy-registry.ts --network base-sepolia
 *   ACTION=register CHAIN=base-sepolia ID=btc-dca-power-law-v1 IMPL=0xYourImpl npx hardhat run scripts/manage/strategy-registry.ts --network base-sepolia
 *   ACTION=remove CHAIN=base-sepolia ID=simple-btc-dca-v1 npx hardhat run scripts/manage/strategy-registry.ts --network base-sepolia
 *
 * (Alternative if your Hardhat supports `--` separator):
 *   npx hardhat run scripts/manage/strategy-registry.ts --network base-sepolia -- --action list --chain base-sepolia
 */

type Action = 'register' | 'remove' | 'list';

function getArg(flag: string, def?: string): string | undefined {
  const envVal = process.env[flag.toUpperCase()];
  if (envVal && envVal.length > 0) return envVal;
  const i = process.argv.findIndex((a) => a === `--${flag}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return def;
}

function toIdBytes32(idOrBytes32: string): string {
  if (idOrBytes32.startsWith('0x') && idOrBytes32.length === 66) return idOrBytes32;
  return ethers.id(idOrBytes32);
}

async function main() {
  const action = (getArg('action') as Action) || 'list';
  const chainKey = getArg('chain', 'base-sepolia')!;
  const cfg = (addresses as any)[chainKey];
  if (!cfg) throw new Error(`No addresses config for chain ${chainKey}`);
  const registryAddr = (getArg('registry') || cfg.strategyRegistry) as string;
  if (!registryAddr) throw new Error(`Missing StrategyRegistry address for chain ${chainKey}`);

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Registry: ${registryAddr}`);

  const registry = await ethers.getContractAt('StrategyRegistry', registryAddr, signer);

  if (action === 'list') {
    const ids: string[] = await registry.listStrategies();
    if (!ids.length) {
      console.log('No strategies registered.');
      return;
    }
    console.log(`Found ${ids.length} strategy id(s):`);
    for (const id of ids) {
      const impl: string = await registry.getStrategy(id);
      const active = impl !== ethers.ZeroAddress;
      console.log(`- id: ${id} | implementation: ${impl} | ${active ? 'ACTIVE' : 'REMOVED'}`);
    }
    return;
  }

  if (action === 'register') {
    const idStr = getArg('id');
    const impl = getArg('impl');
    if (!idStr || !impl) throw new Error('--id and --impl are required for register');
    const id = toIdBytes32(idStr);
    const tx = await registry.registerStrategy(id, impl);
    console.log('registerStrategy tx:', tx.hash);
    await tx.wait();
    console.log('Registered:', id, '->', impl);
    return;
  }

  if (action === 'remove') {
    const idStr = getArg('id');
    if (!idStr) throw new Error('--id is required for remove');
    const id = toIdBytes32(idStr);
    const tx = await registry.removeStrategy(id);
    console.log('removeStrategy tx:', tx.hash);
    await tx.wait();
    console.log('Removed:', id);
    return;
  }

  throw new Error(`Unknown action ${action}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


