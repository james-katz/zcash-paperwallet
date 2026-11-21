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

/// Most blocks the chain is allowed to gain in one day when a checkpoint is
/// checked: twice the 25 second spacing above (86 400 / 12.5). A checkpoint
/// further ahead than this is a typo or a wrong source, and a birthday above
/// the real tip hides funds. `scripts/update-checkpoint.mjs` reads this value.
///
/// It is a sanity bound, not a proof that a height is at or below the tip:
/// at twice the real rate plus a day of slack it lets through a height some
/// way above it. The two sources that must agree and `BIRTHDAY_MARGIN` are
/// what keep the birthday under the tip.
pub const MAX_BLOCKS_PER_DAY: u32 = 6_912;

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

        // And a day that exists: not month 13, not the 31st of November.
        let numbers: Vec<i64> = parts.iter().map(|p| p.parse().unwrap()).collect();
        let (year, month, day) = (numbers[0], numbers[1], numbers[2]);
        assert!((1..=12).contains(&month), "no month {month}");
        let days_in_month = match month {
            4 | 6 | 9 | 11 => 30,
            2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
            2 => 28,
            _ => 31,
        };
        assert!((1..=days_in_month).contains(&day), "no day {day} in month {month} of {year}");
    }

    // The ceiling below grows with the checkpoint date, so a date ahead of
    // today would make room for any height. This is the only place the clock
    // is read, and only by the tests: wallets never depend on it.
    #[test]
    fn checkpoint_date_is_not_in_the_future() {
        let seconds = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("the clock of this machine is before 1970")
            .as_secs();
        let today = i64::try_from(seconds / 86_400).unwrap();
        assert!(
            days_since_epoch(CHECKPOINT_DATE) <= today,
            "checkpoint date {CHECKPOINT_DATE} is after today (UTC)"
        );
    }

    // Every ceiling is counted in this constant, here and in the update
    // script, so a larger value would loosen all of them without a sound.
    #[test]
    fn daily_ceiling_is_twice_the_measured_block_rate() {
        let measured_spacing_seconds = 25;
        assert_eq!(MAX_BLOCKS_PER_DAY, 2 * 86_400 / measured_spacing_seconds);
    }

    /// The first checkpoint, read on two explorers that agreed. Later ones
    /// are checked against it. Do not move it when the checkpoint moves.
    const ANCHOR_HEIGHT: u32 = 3_580_609;
    const ANCHOR_DATE: &str = "2026-11-16";

    /// Days since 1970-01-01 for an ISO day (proleptic Gregorian calendar).
    fn days_since_epoch(iso_day: &str) -> i64 {
        let parts: Vec<i64> = iso_day.split('-').map(|p| p.parse().unwrap()).collect();
        let (year, month, day) = (parts[0], parts[1], parts[2]);
        let year = if month <= 2 { year - 1 } else { year };
        let era = year.div_euclid(400);
        let year_of_era = year.rem_euclid(400);
        let day_of_year = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
        let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
        era * 146_097 + day_of_era - 719_468
    }

    #[test]
    fn days_are_counted_from_the_unix_epoch() {
        assert_eq!(days_since_epoch("1970-01-01"), 0);
        assert_eq!(days_since_epoch("2000-03-01"), 11_017);
        assert_eq!(days_since_epoch(ANCHOR_DATE), 20_773);
    }

    // Catches a checkpoint edited by hand into something the chain cannot
    // have reached, an extra digit for example. The bound gets looser as the
    // anchor ages; the update script checks each step against the last one.
    #[test]
    fn mainnet_checkpoint_is_a_height_the_chain_can_have_reached() {
        let days = days_since_epoch(CHECKPOINT_DATE) - days_since_epoch(ANCHOR_DATE);
        assert!(days >= 0, "checkpoint date is before the anchor");
        // The height wallets are really built from, not the constant itself.
        let height = u32::from(checkpoint_height(&Network::MainNetwork));
        assert!(height >= ANCHOR_HEIGHT, "checkpoint is below the anchor");

        let ceiling = i64::from(ANCHOR_HEIGHT) + (days + 1) * i64::from(MAX_BLOCKS_PER_DAY);
        assert!(
            i64::from(height) <= ceiling,
            "checkpoint {height} is above {ceiling}, the most the chain can have reached by {CHECKPOINT_DATE}"
        );
    }
}
