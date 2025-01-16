import React, { useState } from "react";
import WalletCard from "../components/WalletCard";
import EntropyCollector from "../components/EntropyCollector";
import "./styles.css";

function Home({ wasm }) {
  const [wallets, setWallets] = useState([]);

  const handleEntropyCollected = (entropy) => {
    const wallet = wasm.generate_wallet_from_entropy(entropy);
    setWallets([wallet]);
  };

  const addNewWallet = () => {
    const entropy = new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
    const wallet = wasm.generate_wallet_from_entropy(entropy);
    setWallets((prev) => [...prev, wallet]);
  };

  const printWallets = () => {
    window.print();
  };

  return (
    <div className="home">
      {wallets.length === 0 && <EntropyCollector onEntropyCollected={handleEntropyCollected} />}
      {wallets.map((wallet, index) => (
        <WalletCard key={index} wallet={wallet} />
      ))}
      {wallets.length > 0 && (
        <div className="buttons">
          <button onClick={addNewWallet}>Add New Wallet</button>
          <button onClick={printWallets}>Print</button>
        </div>
      )}
    </div>
  );
}

export default Home;
