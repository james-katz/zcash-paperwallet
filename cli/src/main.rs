use std::path::Path;

use paperwallet_lib::paper::PaperWallet;
use paperwallet_lib::pdf::generate_and_save_pdf;
use paperwallet_lib::json::generate_and_save_json;

use clap::Parser;
use rayon::prelude::*;

#[derive(Parser, Debug)]
#[command(author, version, about)]
/// Modern Zcash Paper Wallet generator with Unified Address support
struct Args {   
    #[arg(long)]
    /// Number of wallets to generate
    num_wallets: Option<usize>,
    #[arg(long)]
    /// main for Mainnet or test for Testnet
    network: Option<String>,
    #[arg(short, long, value_delimiter = ',')]
    /// Exclude receivers, comma separated (transparent,sapling,orchard)
    exclude: Option<Vec<String>>,
    #[arg(short, long)]
    /// Display a rough estimation of wallet birthday
    birthday: bool,
    #[arg(short, long)]
    /// Save generated wallets to file. File type will be guesses from extension. Avaialable formats: [pdf | json]
    filename: Option<String>
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

    // Use a parallel iterator to generate the wallets
    let wallets: Vec<PaperWallet> = (0..num_wallets)
        .into_par_iter()
        .map(|_| {
            PaperWallet::new(&network, None, None).unwrap_or_else(|e| {
                println!("Error creating wallet: {:?}", e);
                std::process::exit(1);
            })
        })
        .collect();
    
    if let Some(filename) = &args.filename {
        let path = Path::new(filename);
        match path.extension().and_then(|ext| ext.to_str()) {
            Some("pdf") => {
                match generate_and_save_pdf(&wallets, args.exclude, args.birthday, filename) {
                    Ok(f) => println!("PDF file saved: {}", f),
                    _ => println!("Error saving the PDF file to disk.")
                };
            },
            Some("json") => {
                match generate_and_save_json(&wallets, args.exclude, filename) {
                    Ok(f) => println!("JSON file saved: {}", f),
                    _=> println!("Error saving the JSON file to disk.")
                };
            },
            _ => println!("Output format not supported.")
        }
    }
    else {
        print_wallets_to_stdout(wallets, args)
    }
}

fn print_wallets_to_stdout(wallets: Vec<PaperWallet>, args:Args) {
    let wallets_num = wallets.len();

    for (index, wallet) in wallets.into_iter().enumerate() {
        let count = index + 1;

        if wallets_num > 1 {
            println!("Wallet number {}", count);
            println!("----------------------------------------");
        }
    
        let sf = wallet.get_seed_phrase();
        println!("Recovery phrase: \n{}\n", sf);

        if args.birthday {
            let birthday = wallet.get_estimated_birthday();
            println!("Wallet birthday: \n{}\n", birthday);
        }
    
        let ufvk = wallet.get_ufvk();
        println!("Unified Full Viewing Key: \n{}\n", ufvk);
    
        let ua = wallet.get_unified_address(args.exclude.clone().unwrap_or_default());
        println!("Unified Address:\n{}", ua);

        if wallets_num > 1 && count < wallets_num {
            println!("\n========================================\n");
        }        
    }
}