export const walletFactoryAbi = [
  { type: 'function', name: 'getUserWallets', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'createWallet', stateMutability: 'nonpayable', inputs: [
    { name: 'strategyId', type: 'bytes32' },
    { name: 'strategyInitData', type: 'bytes' },
    { name: 'stableAsset', type: 'address' },
    { name: 'riskAssets', type: 'address[]' },
    { name: 'priceFeeds', type: 'address[]' },
    { name: 'poolFees', type: 'uint24[]' },
  ], outputs: [{ name: 'walletAddr', type: 'address' }] },
] as const;

export const walletViewAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [ { name: 'stableBal', type: 'uint256' }, { name: 'riskBals', type: 'uint256[]' } ] },
  { type: 'function', name: 'getRiskAssets', stateMutability: 'view', inputs: [], outputs: [ { name: 'assets', type: 'address[]' } ] },
] as const;

export const FEED_ABI = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'latestRoundData', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' },
  ] },
] as const;

export const SMART_DCA_READ_ABI = [
  { type: 'function', name: 'lowerBandBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'upperBandBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'getModelAndBands', stateMutability: 'view', inputs: [], outputs: [ { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' } ] },
] as const;

export const powerWalletAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [
    { name: 'stableBal', type: 'uint256' },
    { name: 'riskBals', type: 'uint256[]' },
  ] },
  { type: 'function', name: 'getRiskAssets', stateMutability: 'view', inputs: [], outputs: [ { name: 'assets', type: 'address[]' } ] },
  { type: 'function', name: 'getPortfolioValueUSD', stateMutability: 'view', inputs: [], outputs: [ { name: 'usd6', type: 'uint256' } ] },
  { type: 'function', name: 'strategy', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'isClosed', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'bool' } ] },
  { type: 'function', name: 'automationPaused', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'bool' } ] },
  { type: 'function', name: 'pauseAutomation', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpauseAutomation', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'slippageBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'setSlippageBps', stateMutability: 'nonpayable', inputs: [ { name: 'newSlippageBps', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'closeWallet', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'withdrawAsset', stateMutability: 'nonpayable', inputs: [ { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'getDeposits', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'balanceAfter', type: 'uint256' } ] } ] },
  { type: 'function', name: 'getWithdrawals', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'balanceAfter', type: 'uint256' } ] } ] },
  { type: 'function', name: 'getSwaps', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOut', type: 'uint256' }, { name: 'balanceInAfter', type: 'uint256' }, { name: 'balanceOutAfter', type: 'uint256' } ] } ] },
] as const;

export const simpleDcaAbi = [
  { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'dcaAmountStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
] as const;
export const FAUCET_ABI = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'totalClaimed', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'totalClaimedBy', stateMutability: 'view', inputs: [ { name: '', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'usdc', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'maxClaim', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'claimCooldown', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'lastClaimAt', stateMutability: 'view', inputs: [ { name: '', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
] as const;

export const ERC20_READ_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [ { name: 'account', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint8' } ] },
] as const;


