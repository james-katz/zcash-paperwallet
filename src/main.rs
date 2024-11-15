use paperwallet_lib::paper::PaperWallet;

use clap::Parser;

#[derive(Parser, Debug)]
#[command(author, version, about)]
/// Modern Zcash Paper Wallet generator with Unified Address support
struct Args {   
    #[arg(short, long)]
    /// Number of wallets to generate
    num_wallets: Option<usize>,
    #[arg(long)]
    /// main for Mainnet or test for Testnet
    network: Option<String>,
    #[arg(short, long, value_delimiter = ',')]
    /// Exclude receivers, comma separated (transparent,sapling,orchard)
    exclude: Option<Vec<String>>
}

fn main() {            
    let args = Args::parse();

    // Get the number of wallets to generate
    let num_wallets = match args.num_wallets {
        None => 1, // Default to 1 if none is provided
        Some(num) => num        
    }; 

    // Retrieve the network argument, defaulting to "main" if not provided
    let network = match args.network.as_deref() {
        None => "main".to_string(), // Default to "main" if no network is provided
        Some("main") => "main".to_string(),
        Some("test") => "test".to_string(),
        Some(invalid) => {
            eprintln!("Error: The --network argument must be either 'main' or 'test'. You provided '{}'", invalid);
            std::process::exit(1);
        }
    };     

    // List of valid exclusion values
    let valid_exclude = vec!["transparent", "sapling", "orchard"];

    // Validate the exclude list
    if let Some(excludes) = &args.exclude {
        let mut excluded_shielded_receiver = 0;
        for exclude in excludes {
            if !valid_exclude.contains(&exclude.as_str()) {
                println!("Error: Invalid exclude value '{}'. Valid values are: {}.", exclude, valid_exclude.join(", "));
                std::process::exit(1);
            }
            if exclude == "sapling" || exclude == "orchard" {
                excluded_shielded_receiver += 1;
            }
        }
        if excluded_shielded_receiver > 1 {
            println!("Error creating wallet: at least 1 shielded receiver must be included (sapling or orchard)");
            std::process::exit(1);
        }        
    }

    let mut count = 1;
    loop {
        if count > num_wallets {
            break;
        }

        if num_wallets > 1 {
            println!("Wallet number {}", count);
            println!("----------------------------------------");
        }

        let pw = PaperWallet::new(&network, None).unwrap_or_else(|e| {
            println!("Error creating wallet: {:?}", e);
            std::process::exit(1);
        });
    
        let sf = pw.get_seed_phrase();
        println!("Recovery phrase: \n{}\n", sf);
    
        let ufvk = pw.get_ufvk();
        println!("Unfied Full Viewing Key: \n{}\n", ufvk);
    
        let oa = pw.get_unified_address(args.exclude.clone().unwrap_or_default());
        println!("Unified Address:\n{}", oa);

        if num_wallets > 1 && count < num_wallets {
            println!("\n========================================\n");
        }

        count += 1;
    }

}

