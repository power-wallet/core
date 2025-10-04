#!/bin/bash

# Check if network argument is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <network>"
    echo "Available networks: sepolia, base-sepolia, base"
    exit 1
fi

NETWORK=$1

# Validate network
case $NETWORK in
    "sepolia"|"base-sepolia"|"base")
        echo "Upgrading on $NETWORK..."
        ;;
    *)
        echo "Invalid network. Available networks: sepolia, base-sepolia, base"
        exit 1
        ;;
esac

# Run upgrade script
npx hardhat run scripts/upgrade/upgrade_indicators.ts --network $NETWORK
