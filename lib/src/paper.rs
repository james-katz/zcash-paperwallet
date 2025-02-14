use bip0039::{Mnemonic, Count, English};
use secp256k1::Secp256k1;
use zcash_client_backend::keys::{UnifiedSpendingKey, UnifiedFullViewingKey, UnifiedAddressRequest};
use zcash_primitives::consensus::{Network, BlockHeight, NetworkUpgrade, Parameters};
use zcash_primitives::zip32::AccountId;
use zcash_primitives::legacy::keys::{IncomingViewingKey, TransparentKeyScope, NonHardenedChildIndex, AccountPrivKey};
use zcash_client_backend::encoding::{encode_payment_address, encode_transparent_address};
use zcash_primitives::constants::mainnet::{HRP_SAPLING_PAYMENT_ADDRESS, B58_PUBKEY_ADDRESS_PREFIX, B58_SCRIPT_ADDRESS_PREFIX};
use zcash_primitives::constants::testnet::{HRP_SAPLING_PAYMENT_ADDRESS as HRP_SAPLING_PAYMENT_ADDRESS_TESTNET, B58_PUBKEY_ADDRESS_PREFIX as B58_PUBKEY_ADDRESS_PREFIX_TESTNET, B58_SCRIPT_ADDRESS_PREFIX as B58_SCRIPT_ADDRESS_PREFIX_TESTNET};
use zcash_client_backend::address::UnifiedAddress;
use zcash_primitives::legacy::TransparentAddress;
use sapling::PaymentAddress;

// use crate::pdf::generate_and_save_pdf;

use chrono::{Utc, TimeZone};

use std::error::Error;

const BLOCK_INTERVAL_SECONDS: i64 = 75; // Zcash target block interval

pub struct PaperWallet {
    network: Network,
    seed: Vec<u8>,
    seed_phrase: String,
    ufvk: UnifiedFullViewingKey,
    sapling_address: PaymentAddress,
    transparent_address: TransparentAddress,
    orchard: UnifiedAddress,
    birthday: BlockHeight
}

impl PaperWallet {
    /// Creates a new paper wallet for the specified network, initializing keys and addresses.
    pub fn new(net: &str, phrase: Option<&str>, root_seed: Option<Vec<u8>>) -> Result<PaperWallet, Box<dyn Error>> {
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

        let mut seed_phrase = mnemonic.phrase().to_string();  
        let seed = if let Some(root_seed) = root_seed {
            seed_phrase = "Wallet initialized from seed does't contain a mnemonic phrase.".to_string();
            root_seed
        } else {
            mnemonic.to_seed("").to_vec()
        };
    
        // Derive the Zcash unified spending key and unified full viewing key
        let usk = UnifiedSpendingKey::from_seed(&network, &seed, AccountId::default())
            .map_err(|_| "Failed to derive Unified Spending Key")?;

        let ufvk = usk.to_unified_full_viewing_key();
        
        // Derive sapling address
        let (_, sapling_address) = ufvk
            .sapling()
            .ok_or("Failed to derived sapling address")?
            .default_address();
        
        // Get transparent pubkey
        let pubkey = ufvk
            .transparent()
            .ok_or("Failed to derive transparent AccountPubKey")?
            .to_owned();

        // Derive transparent address
        let (t_address, _) = pubkey
            .derive_external_ivk()
            .map_err(|_| "Failed to derive transparent ExternalIvk")?
            .default_address();
             
        let (oa, _) = ufvk
            .default_address(UnifiedAddressRequest::new(true, false, false).expect("Invalid UnifiedAddressRequest"))
            .map_err(|_| "Failed to derive orchard UnifiedAddress")?;           

        // Estimate a birthday based on current date
        let birthday = PaperWallet::estimate_brithday(&network);

        Ok(Self {
            network, 
            seed,
            seed_phrase,
            ufvk,
            sapling_address,
            transparent_address: t_address,
            orchard: oa,
            birthday
        })
    }

    pub fn from_entropy(net: &str, bytes: Vec<u8>) -> Result<PaperWallet, Box<dyn Error>> {
        let seed = <Mnemonic<English>>::from_entropy(bytes).expect("Invalid entropy bytes");
        let seed_phrase = seed.to_string();
        PaperWallet::new(&net, Some(&seed_phrase), None)
    }

    pub fn from_seed(net: &str, bytes: Vec<u8>) -> Result<PaperWallet, Box<dyn Error>> {
        PaperWallet::new(&net, None, Some(bytes))
    }

    fn estimate_brithday(network: &Network) -> BlockHeight {                
        let nu6_height = network.activation_height(NetworkUpgrade::Nu6).unwrap();
        let nu6_date = match network {
            Network::MainNetwork => Utc.with_ymd_and_hms(2024, 11, 23, 0, 0, 0),
            _ => Utc.with_ymd_and_hms(2024, 8, 28, 0, 0, 0)
        };
        let current_date = Utc::now();

        let duration = current_date.signed_duration_since(nu6_date.unwrap());
        let elapsed_seconds = duration.num_seconds();
       
        let additional_blocks = (elapsed_seconds / BLOCK_INTERVAL_SECONDS) as u32;
        
        (nu6_height + additional_blocks) - 1000
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

    pub fn get_transparent_pubkey(&self) -> String {
        let secp = Secp256k1::new();
        let priv_key = AccountPrivKey::from_seed(&self.network, &self.seed, AccountId::default()).expect("Invalid seed");
        let sk = priv_key.derive_secret_key(TransparentKeyScope::EXTERNAL, NonHardenedChildIndex::ZERO).expect("Invalid SecretKey");
        let pub_key = sk.public_key(&secp);
        hex::encode(pub_key.serialize())
    }

    // pub fn get_tex_address(&self) -> String {
    //     let t_address = self.get_transparent_address();            
    // }

    pub fn get_sapling_address(&self) -> String {
        match self.network {
            Network::MainNetwork => encode_payment_address(HRP_SAPLING_PAYMENT_ADDRESS, &self.sapling_address),
            _ => encode_payment_address(HRP_SAPLING_PAYMENT_ADDRESS_TESTNET, &self.sapling_address)
        }        
    }

    pub fn get_orchard_address(&self) -> String {
        let orchard_address = &self.orchard;
        orchard_address.encode(&self.network)
    }

    pub fn get_unified_address(&self, exclude: Vec<String>) -> String {        
        let has_sapling = !exclude.contains(&"sapling".to_string());
        let has_transparent = !exclude.contains(&"transparent".to_string());
        let has_orchard = !exclude.contains(&"orchard".to_string());

        let (ua, _) = &self.ufvk
            .default_address(UnifiedAddressRequest::new(has_orchard, has_sapling, has_transparent).expect("Invalid UnifiedAddressRequest"))
            .expect("Failed to derive orchard UnifiedAddress");          
        ua.encode(&self.network)
    }

    pub fn get_estimated_birthday(&self) -> u32 {
        self.birthday.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;    
    use crate::test_vectors::ua::get_ua_test_vectors;

    #[test]
    fn test_generate_wallet() {        
        let wallet = PaperWallet::new("main", None, None);
        assert!(wallet.is_ok(), "PaperWallet creation failed.");       
        assert!(!wallet.unwrap().seed_phrase.is_empty(), "PaperWallet creation failed: No mnemonic phrase.");       
    }

    #[test]
    fn test_generate_wallet_from_entropy() {
        let seed_entropy = vec![
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f
        ];
        
        let wallet = PaperWallet::from_entropy("main", seed_entropy.clone()).unwrap();

        // Test entropy to mnemonic phrase
        assert_eq!(wallet.get_seed_phrase(), "abandon amount liar amount expire adjust cage candy arch gather drum bullet absurd math era live bid rhythm alien crouch range attend journey unaware".to_string());

        // Test Unified Full Viewing Key
        assert_eq!(wallet.get_ufvk(), "uview156rlgltvjyhrr0qz9muwgng6l6v3swlly0yv0tvv4juwmt22fhl2nj20e67harvdnlzhtkmsukrqeccx82h202ey895f5uzlyzcjfyclu378lyuuf2h3yjuv5rnuqeg759yfj2th30ftp54jhjdz5y7n3ce7c0v084cv5jnpwue3cpzdpx85e4dce45w39clx5qvy3fs430qlcw077u730a8wsekmnc9g0qjc3mguts26m7cyurumcn9es345dl7k209fur20mn9evgp24qyt4nyjtz8kfmpvuk72ec3e2wvc27gttkverw4xyatuqz2j2jqeja65lhae7v6hj9gxvvqf8yy5umh98q20g684zckqfchhne7pmuj6msc0ufux5zugu4zw9a2yvdl5z80r52dw94p4m344rrps8q39s50lvl3zqssgpf7lf9k5nxej0cqpldnznrxvf0y7g2kca7kn9meza9kryvsmy0r7uqpk0qxk5h4989f");

        // Test transparent address
        assert_eq!(wallet.get_transparent_address(), "t1NKJsy1iFE51T68DSq5NYZNnSH9EB4m2MS".to_string());

        // Test sapling address
        assert_eq!(wallet.get_sapling_address(), "zs1xl6emyha8nn92pl0mwjxtyvqmld2wf0racwv3xctxvk9pjtgavhyv0z5gyg7mya72p2lxtpv2em".to_string());

        // Test unified address (orchard)
        assert_eq!(wallet.get_unified_address(vec!["transparent".to_string(), "sapling".to_string()]), "u14yht53hcrwp5rxut348ll74n0j7uznf9cwgw9wml58nkwvaxseyh5sydk37s3p4kh52jcgduy2dfaqejxuazrvnekt7qp0j48c4ds5yr");

        // Test unified address (sapling + orchard)
        assert_eq!(wallet.get_unified_address(vec!["transparent".to_string()]), "u1996cta53mcpx59r5g05yzdl3h74cynx4fjykufa7wwu60tvmrvt3ex742f8tlay6733lygfsfnuyaz6m2gsqm6fxgj0datfg5qr7vtw4sjcenqf4sxvy9nzsl27x7jqw8q72c39jfa32ux62yv00d3n4h7guzjnmcdk550etucauwmqk");

        // Test unified address (transparent + sapling)
        assert_eq!(wallet.get_unified_address(vec!["orchard".to_string()]), "u1arzqkajrqutz2l7grxyfm8ex0cyy9suevzje8xj45ve0keea4wduw4z0s6yq7c4ujhzd2f5uh2sp709ypn4nekj84f5xuzrc85agt8un6tnlncqst6g7mczpdjwukjf9w6a5j92tp2y");

        // Test unified address (transparent + orchard)
        assert_eq!(wallet.get_unified_address(vec!["sapling".to_string()]), "u1shx22q5jfndr5cqsx0r97fg7efylzpyc63msjplez8esmxdnddzel8a6k77zk9nn9cgcq49mf9mgm3d968anmqzt33mzthv47t76ne0ycljh8xc48yl58ark37q5tunjc4rs60tjgz2");

        // Test unified address (transparent + sapling + orchard)
        assert_eq!(wallet.get_unified_address(vec![]), "u1c4hdrd30vk58pxhjjycnexps7jnqk4h0hk6r3kxvrpz8gllsdnlvm63vpaeuvek5ygnjxnq54df7xuxzce4jeq2kx0vx32g8a2f9mu6twkcf4nzey2ps93z75th2z6jm2etd2ynaky2kjmj60hstk094ufptx6efgpqfy4y9n0e2c5kfgezxh6akn5cd558800xy080u0jy6vvvw9yp");
    }

    #[test]
    fn test_generate_wallet_from_root_seed() {
        let ua_test = get_ua_test_vectors();
        for ua in ua_test {
            let root_seed = ua.root_seed;
            let has_transparent = ua.p2pkh_bytes.is_some();
            let has_sapling = ua.sapling_raw_addr.is_some();
            let has_orchard = ua.orchard_raw_addr.is_some();
            let mut exclude: Vec<String> = vec![];
            if !has_transparent {
                exclude.push("transparent".to_string());
            };
            if !has_sapling {
                exclude.push("sapling".to_string());
            };
            if !has_orchard {
                exclude.push("orchard".to_string());
            };

            let wallet = PaperWallet::from_seed("main", root_seed).unwrap();
            assert_eq!(wallet.get_unified_address(exclude), ua.unified_addr);
        }
    }
}