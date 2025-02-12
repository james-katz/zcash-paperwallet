import React, { useEffect, useState } from "react";
import WalletCard from "../components/WalletCard";
import WalletCardImg from "../components/WalletCardImg";
import EntropyCollector from "../components/EntropyCollector";
import "./styles.css";

function Home({ wasm }) {
  const [wallets, setWallets] = useState([]);
  const [userEntropy, setUserEntropy] = useState([]);
  const [textOnly, setTextOnly] = useState(false);

  // useEffect(() => {

  // }, [textOnly]);

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

  const handleCheckBox = (e) => {
    if(e.target && e.target.checked) setTextOnly(e.target.checked);
    else setTextOnly(!textOnly);
  };

  return (
    <div className="home">
      {wallets.length === 0 && <EntropyCollector onEntropyCollected={handleEntropyCollected} />}      
      {wallets.length > 0 && (
      <>
        <div className="buttons">
          <button onClick={addNewWallet}>Add New Wallet</button>
          <button onClick={printWallets}>Print</button>
          <input type="checkbox" onChange={handleCheckBox} id="textOnly"></input><label for="textOnly">Text only</label>
         </div>
        <div className="print-area">
          {wallets.map((wallet, index) => (
            <>
              {textOnly ? (
                <>
                  <WalletCard key={index} wallet={wallet} />
                  <div class="pagebreak"></div>
                </>
              ) : (
                <>
                  <WalletCardImg key={index} wallet={wallet} />
                  <div class="pagebreak-avoid"></div>
                </>
              )}
            </>
          ))}
        </div>
      </>
      )}
    </div>
  );
}

export default Home;
