use std::error::Error;
use serde::{Serialize, Deserialize};
use std::fs;
use std::io::Write;

use crate::paper::PaperWallet;

#[derive(Serialize, Deserialize)]
struct JsonPaperWallet {
    mnemonic: String,
    ufvk: String,
    ua: String,
    sapling: String,
    transparent: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pubkey: Option<String>,
    birthday: u32
}

pub fn generate_and_save_json(wallets: &Vec<PaperWallet>, exclude: Option<Vec<String>>, pubkey: bool, filename: &str) -> Result<String, Box<dyn Error>> {
    let json_wallets: Vec<JsonPaperWallet> = wallets.iter().map(|wallet| {
        JsonPaperWallet {
            mnemonic: wallet.get_seed_phrase().to_string(),
            ufvk: wallet.get_ufvk(), 
            ua: wallet.get_unified_address(exclude.clone().unwrap_or_default()),
            sapling: wallet.get_sapling_address(),
            transparent: wallet.get_transparent_address(),
            pubkey: if pubkey {
                Some(wallet.get_transparent_pubkey())
            } else {
                None
            },
            birthday: wallet.get_estimated_birthday()
        }
    }).collect();
        
    let json_string = serde_json::to_string_pretty(&json_wallets).expect("Failed to serialize wallets");
    let mut file = fs::File::create(filename)?;
    file.write_all(json_string.as_bytes())?;

    Ok(filename.to_string())
} 