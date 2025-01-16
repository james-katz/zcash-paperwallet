use paperwallet_lib::paper::PaperWallet;
use wasm_bindgen::prelude::*;

// A function to generate a Zcash paper wallet
#[wasm_bindgen]
pub fn generate_paper_wallet() -> String {
    let wallet = PaperWallet::new("main", None, None);
    let seed_phrase = match wallet {
        Ok(w) => w.get_seed_phrase().to_string(),
        Err(_) => "Something wrong".to_string(),
    };
    
    seed_phrase
}
