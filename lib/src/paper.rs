use bip0039::{Mnemonic, Count, English};
use zcash_client_backend::keys::{UnifiedSpendingKey, UnifiedFullViewingKey};
use zcash_primitives::{consensus::Network, legacy::TransparentAddress};
use zcash_primitives::sapling::PaymentAddress;
use zcash_primitives::zip32::AccountId;
use zcash_primitives::legacy::keys::IncomingViewingKey;
use zcash_client_backend::encoding::{encode_payment_address, encode_transparent_address};
use zcash_primitives::constants::mainnet::{HRP_SAPLING_PAYMENT_ADDRESS, B58_PUBKEY_ADDRESS_PREFIX, B58_SCRIPT_ADDRESS_PREFIX};
use zcash_primitives::constants::testnet::{HRP_SAPLING_PAYMENT_ADDRESS as HRP_SAPLING_PAYMENT_ADDRESS_TESTNET, B58_PUBKEY_ADDRESS_PREFIX as B58_PUBKEY_ADDRESS_PREFIX_TESTNET, B58_SCRIPT_ADDRESS_PREFIX as B58_SCRIPT_ADDRESS_PREFIX_TESTNET};
use zcash_client_backend::address::UnifiedAddress;
use orchard::keys::Scope;
use orchard::Address;

use std::error::Error;

pub struct PaperWallet {
    network: Network,
    seed_phrase: String,
    ufvk: UnifiedFullViewingKey,
    sapling_address: PaymentAddress,
    transparent_address: TransparentAddress,
    orchard: Address
}

impl PaperWallet {
    /// Creates a new paper wallet for the specified network, initializing keys and addresses.
    pub fn new(net: &str, phrase: Option<&str>) -> Result<PaperWallet, Box<dyn Error>> {
        let network = match net {
            "main" => Network::MainNetwork,
            _ => Network::TestNetwork
        };

        // Generate mnemonic and seed from bip0039
        let mnemonic = if let Some(phrase) = phrase {
            Mnemonic::from_phrase(phrase)
                .map_err(|_| "Failed to parse mnemonic phrase")?
        } else {
            <Mnemonic<English>>::generate(Count::Words24)
        };     

        let seed_phrase = mnemonic.phrase().to_string();  
        let seed = mnemonic.to_seed("");
    
        // Derive the Zcash unified spending key and unified full viewing key
        let usk = UnifiedSpendingKey::from_seed(&network, &seed, AccountId::default())
            .map_err(|_| "Failed to derive Unified Spending Key")?;

        let ufvk = usk.to_unified_full_viewing_key();
        
        // Derive sapling address
        let (_, sapling_address) = ufvk
            .sapling()
            .ok_or("Failed to derived sapling address")?
            .default_address();
        
        // Derive transparent address
        let (t_address, _) = ufvk
            .transparent()
            .ok_or("Failed to derive transparent AccountPuBey")?
            .derive_external_ivk()
            .map_err(|_| "Failed to derive transparent ExternalIvk")?
            .default_address();

        // Derive Orchard "address"
        let oa = ufvk.orchard()
            .ok_or("Failed to derive Orchard viewing key")?
            .address_at(0u32, Scope::External);

        Ok(Self {
            network, 
            seed_phrase,
            ufvk,
            sapling_address,
            transparent_address: t_address,
            orchard: oa
        })
    }

    pub fn get_seed_phrase(&self) -> &str {
        &self.seed_phrase
    }

    pub fn get_ufvk(&self) -> String {
        self.ufvk.encode(&self.network)
    }

    pub fn get_transparent_address(&self) -> String {
        match self.network {
            Network::MainNetwork => encode_transparent_address(&B58_PUBKEY_ADDRESS_PREFIX, &B58_SCRIPT_ADDRESS_PREFIX, &self.transparent_address),
            _ => encode_transparent_address(&B58_PUBKEY_ADDRESS_PREFIX_TESTNET, &B58_SCRIPT_ADDRESS_PREFIX_TESTNET, &self.transparent_address)
        }        
    }

    // pub fn get_tex_address(&self) -> String {
    //     let address = self.get_transparent_address();    
    // }

    pub fn get_sapling_address(&self) -> String {
        match self.network {
            Network::MainNetwork => encode_payment_address(HRP_SAPLING_PAYMENT_ADDRESS, &self.sapling_address),
            _ => encode_payment_address(HRP_SAPLING_PAYMENT_ADDRESS_TESTNET, &self.sapling_address)
        }        
    }

    pub fn get_orchard_address(&self) -> String {
        let a = self.orchard;
        let orchard_address = UnifiedAddress::from_receivers(Some(a), None, None).unwrap();
        orchard_address.encode(&self.network)
    }

    pub fn get_unified_address(&self, exclude: Vec<String>) -> String {
        let sapling_address = if exclude.contains(&"sapling".to_string()) {
            None
        } else {
            Some(self.sapling_address)
        };
    
        let t_address = if exclude.contains(&"transparent".to_string()) {
            None
        } else {
            Some(self.transparent_address)
        };
    
        let orchard = if exclude.contains(&"orchard".to_string()) {
            None
        } else {
            Some(self.orchard)
        };

        let ua = UnifiedAddress::from_receivers(orchard, sapling_address, t_address).expect("Failed to create Unified Address");
        ua.encode(&self.network)
    }
}