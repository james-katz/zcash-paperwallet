# Zcash Paper Wallet Generator

A simple Rust-based application to generate Zcash paper wallets, supporting Unified Addresses (UA) with options to exclude specific receivers.

## Usage

## Arguments
All arguments are optional.
- --network: Choose the network (main or test). Defaults to main.
- --exclude: Comma-separated list of receivers to exclude. Options are transparent, sapling, orchard. Defaults to none (i.e. encode all receivers).
- --num_wallets: Number of wallets to generate. Defaults to 1.
- --birthday: Include a rough estimation of wallet birthday, disabled by default.
- --filename <FILENAME>: Export wallet to <FILENAME>. File format will be guessed by file extension. By default, the cli doesn't export and print to stdout. Supported file formats:
  - .pdf: export to a formatted PDF file.
  - .json: export to a json formatted file.

### Examples
```bash
# Generate a wallet for the main network with only a Orchard receiver:
./target/release/zcash-paper-wallet --exclude transparent,sapling

# Generate a wallet for the test network with all receivers but transparent:
./target/release/zcash-paper-wallet --network test --exclude transparent

# Generate 3 wallets for the main network:
./target/release/zcash-paper-wallet --num_wallets 3

# Generate a wallet for the main network, with all receivers and birthday estimation
./target/release/zcash-paper-wallet --birthday

# Generate a wallet for the main network, with all receivers and birthday estimation, export to a pdf file.
./target/release/zcash-paper-wallet --birthday --filename my_wallet.pdf
```

## Building from source

To build and run the project, you'll need to have Rust installed.

### **Install Rust**

Visit [Rust's official website](https://www.rust-lang.org/tools/install) and follow the installation instructions:

```bash
# On Linux or macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### **Build the CLI**

```bash
# Clone the repository
git clone https://github.com/james-katz/zcash-paperwallet.git

cd zcash-paper-wallet

# Build the project
cargo build --release

# Run the CLI
./target/release/zcash-paper-wallet
```

## Disclaimer
This software is open-source and provided "as is" without any warranty. Use it at your own risk. The developers are not responsible for any loss, damage, or liability arising from the use of this software. Always verify the security of your environment and handle private keys and sensitive data with caution.