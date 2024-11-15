# Zcash Paper Wallet Generator

A simple Rust-based application to generate Zcash paper wallets, supporting Unified Addresses (UA) with options to exclude specific receivers.

## Installation

To build and run the project, you'll need to have Rust installed.

### **Install Rust**

Visit [Rust's official website](https://www.rust-lang.org/tools/install) and follow the installation instructions:

```bash
# On Linux or macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Usage
To build and run the CLI:

```bash
# Clone the repository
git clone https://github.com/james-katz/zcash-paperwallet.git

cd zcash-paper-wallet

# Build the project
cargo build --release

# Run the CLI
./target/release/zcash-paper-wallet
```

## Arguments
All arguments are optional.
- --network: Choose the network (main or test). Defaults to main.
- --exclude: Comma-separated list of receivers to exclude. Options are transparent, sapling, orchard. Defaults to none (i.e. encode all receivers).
- --num_wallets: Number of wallets to generate. Defaults to 1.

### Examples
```bash
# Generate a wallet for the main network with only a Orchard receiver:
./target/release/zcash-paper-wallet --network main --exclude transparent,sapling

# Generate a wallet for the test network with all receivers but transparent:
./target/release/zcash-paper-wallet --network test --exclude transparent

# Generate 3 wallets for the main network:
./target/release/zcash-paper-wallet --network main --num_wallets 3
```

## Disclaimer
This software is open-source and provided "as is" without any warranty. Use it at your own risk. The developers are not responsible for any loss, damage, or liability arising from the use of this software. Always verify the security of your environment and handle private keys and sensitive data with caution.