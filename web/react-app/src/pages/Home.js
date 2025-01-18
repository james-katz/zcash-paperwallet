import React, { useState } from "react";
import WalletCard from "../components/WalletCard";
import EntropyCollector from "../components/EntropyCollector";
import "./styles.css";

function Home({ wasm }) {
  const [wallets, setWallets] = useState([]);
  const [userEntropy, setUserEntropy] = useState([]);

  const handleEntropyCollected = (entropy) => {    
    setUserEntropy(entropy);
    const wallet = wasm.generate_wallet_with_salt(userEntropy);
    console.log(wallet);
    setWallets([wallet]);
  };

  const addNewWallet = () => {
    const wallet = wasm.generate_wallet_with_salt(userEntropy);
    setWallets((prev) => [...prev, wallet]);
  };

  const printWallets = () => {
    window.print();
  };

  return (
    <div className="home">
      {wallets.length === 0 && <EntropyCollector onEntropyCollected={handleEntropyCollected} />}      
      {wallets.length > 0 && (
        <div className="buttons">
          <button onClick={addNewWallet}>Add New Wallet</button>
          <button onClick={printWallets}>Print</button>
          {wallets.map((wallet, index) => (
            <WalletCard key={index} wallet={wallet} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
