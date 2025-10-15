# Testing (Hardhat)

This package uses Hardhat + TypeScript + TypeChain for compiling and testing the Solidity contracts.

## Prerequisites

- Node.js 18+
- npm 9+

## Install dependencies

```bash
cd contracts
npm install
```

## Compile contracts (and generate TypeChain types)

```bash
npx hardhat compile
```

If you need a clean rebuild:

```bash
npx hardhat clean && npx hardhat compile
```

## Run all tests

```bash
npx hardhat test
```

## Run a single suite or test by name

Use `--grep` with part of the test description.

```bash
# Only the PowerBtcDcaV2 strategy tests
npx --yes hardhat test --grep PowerBtcDcaV2

# Run one specific case (example)
npx --yes hardhat test --grep "buys small amount"
```

## Gas report (optional)

Enable the gas reporter by setting the env var before running tests:

```bash
REPORT_GAS=true npx hardhat test
```

## Notes

- Tests run on the in-memory Hardhat network; no `.env` RPC keys required
- `typechain-types/` is generated from your current Solidity ABIs on each compile
