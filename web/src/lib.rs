use paperwallet_lib::paper::PaperWallet;
use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};

// Paper wallet strruct to export to the web interface
#[derive(Debug, Serialize, Deserialize)]
pub struct WebPaperWallet {
    seed: String,
    address: String,
    ufvk: String,
    birthday: u32
}

// A function to generate a Zcash paper wallet
#[wasm_bindgen]
pub fn generate_wallet_from_entropy(entropy: &[u8]) -> JsValue {
    let wallet = PaperWallet::from_entropy("main", entropy.to_vec());
    let (seed_phrase, ua, ufvk, birthday) = match wallet {
        Ok(w) => {
            let seed = w.get_seed_phrase().to_string();
            let ua = w.get_unified_address(vec![]);
            let ufvk = w.get_ufvk();
            let birth = w.get_estimated_birthday();
            (seed, ua, ufvk, birth)
        }
        Err(_) => (
            "Error: Could not retrieve seed".to_string(),
            "Error: No unified address".to_string(),
            "Error: No UFVK".to_string(),
            0,
        ),
    };

    let web_wallet = WebPaperWallet {
        seed: seed_phrase,
        address: ua,
        ufvk,
        birthday
    };

    println!("{:#?}", web_wallet);

    serde_wasm_bindgen::to_value(&web_wallet).unwrap()
}
    
#[wasm_bindgen]
pub fn generate_wallet_with_salt(user_entropy: &[u8]) -> JsValue {
    let mut salt = [0u8; 32];
    getrandom::getrandom(&mut salt).expect("Unable to gather system entropy");

    let mut combined_entropy = Vec::new();
    combined_entropy.extend_from_slice(&salt);
    combined_entropy.extend_from_slice(user_entropy);

    let mut hasher = Sha256::new();
    hasher.update(&combined_entropy);
    let hashed_entropy = hasher.finalize();

    generate_wallet_from_entropy(&hashed_entropy)
}

#[cfg(test)]
mod tests {
    use super::*; // Import your `generate_wallet_from_entropy` function
    use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

    // Enable wasm_bindgen_test for WASM-based tests
    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn test_generate_wallet_from_entropy() {
        // Define a 32-byte entropy array filled with 0u8
        let seed_entropy = vec![
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f
        ];

        // Call the function
        let wallet = generate_wallet_from_entropy(&seed_entropy);

        // Assertions to validate the wallet structure
        let rust_wallet = serde_wasm_bindgen::from_value::<WebPaperWallet>(wallet.clone()).unwrap();
        assert_eq!(rust_wallet.seed, "abandon amount liar amount expire adjust cage candy arch gather drum bullet absurd math era live bid rhythm alien crouch range attend journey unaware".to_string());

        println!("Generated Wallet: {:?}", serde_wasm_bindgen::from_value::<WebPaperWallet>(wallet)); // Debug output
    }
}