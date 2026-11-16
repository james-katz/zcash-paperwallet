//! Wallet birthday, taken from a chain checkpoint.
//!
//! The birthday is the block height a wallet starts scanning from when the
//! paper wallet is restored. A birthday above the real chain tip hides funds
//! received before it; a birthday below the tip only costs sync time. So the
//! birthday is never estimated from the clock of the machine that generates
//! the wallet: it is a height that was observed on chain, minus a margin.
//!
//! `scripts/update-checkpoint.mjs` refreshes the mainnet constants.

use zcash_primitives::consensus::{BlockHeight, Network, NetworkUpgrade, Parameters};

/// Mainnet chain tip on `CHECKPOINT_DATE`.
/// Sources, which agreed: api.blockchair.com/zcash/stats and
/// mainnet.zcashexplorer.app/api/v1/blockchain-info.
pub const CHECKPOINT_HEIGHT_MAIN: u32 = 3_580_609;

/// Day (UTC) the mainnet checkpoint was read.
pub const CHECKPOINT_DATE: &str = "2026-11-16";

/// Blocks subtracted from the checkpoint. About two days at the 25 second
/// block spacing measured on mainnet in November 2026.
pub const BIRTHDAY_MARGIN: u32 = 7_000;

/// The height the birthday is counted back from.
///
/// Testnet has no tip source wired in, so it uses the NU6 activation height
/// that ships with the consensus parameters. Testnet coins have no value and
/// an old birthday only makes the first sync longer.
pub fn checkpoint_height(network: &Network) -> BlockHeight {
    match network {
        Network::MainNetwork => BlockHeight::from_u32(CHECKPOINT_HEIGHT_MAIN),
        Network::TestNetwork => network
            .activation_height(NetworkUpgrade::Nu6)
            .expect("NU6 has an activation height on testnet"),
    }
}

/// Birthday for a wallet generated now: the checkpoint minus the margin.
pub fn birthday(network: &Network) -> BlockHeight {
    checkpoint_height(network) - BIRTHDAY_MARGIN
}

#[cfg(test)]
mod tests {
    use super::*;

    const NETWORKS: [Network; 2] = [Network::MainNetwork, Network::TestNetwork];

    #[test]
    fn mainnet_birthday_is_the_checkpoint_minus_the_margin() {
        assert_eq!(u32::from(birthday(&Network::MainNetwork)), CHECKPOINT_HEIGHT_MAIN - BIRTHDAY_MARGIN);
    }

    #[test]
    fn birthday_is_never_above_the_checkpoint() {
        for network in NETWORKS {
            assert!(birthday(&network) < checkpoint_height(&network));
        }
    }

    #[test]
    fn margin_is_respected_on_both_networks() {
        for network in NETWORKS {
            let gap = u32::from(checkpoint_height(&network)) - u32::from(birthday(&network));
            assert_eq!(gap, BIRTHDAY_MARGIN);
        }
    }

    #[test]
    fn mainnet_checkpoint_is_after_nu6() {
        let nu6 = Network::MainNetwork.activation_height(NetworkUpgrade::Nu6).unwrap();
        assert!(checkpoint_height(&Network::MainNetwork) > nu6);
    }

    #[test]
    fn checkpoint_date_is_an_iso_day() {
        let parts: Vec<&str> = CHECKPOINT_DATE.split('-').collect();
        assert_eq!(parts.len(), 3);
        assert!(parts.iter().all(|p| p.chars().all(|c| c.is_ascii_digit())));
        assert_eq!((parts[0].len(), parts[1].len(), parts[2].len()), (4, 2, 2));
    }
}
