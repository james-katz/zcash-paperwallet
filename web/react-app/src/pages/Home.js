import React, { useState } from "react";
import WalletCard from "../components/WalletCard";
import WalletCardImg from "../components/WalletCardImg";
import EntropyCollector from "../components/EntropyCollector";
import "./styles.css";

function Home({ wasm }) {
  const [wallets, setWallets] = useState([]);
  const [userEntropy, setUserEntropy] = useState([]);
  const [textOnly, setTextOnly] = useState(false);

const handleEntropyCollected = (entropy) => {    
    setUserEntropy(entropy);
    // Use the argument: the state set above only updates on the next render,
    // so reading userEntropy here would still give the empty initial value.
    const wallet = wasm.generate_wallet_with_salt(entropy);
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
          <input type="checkbox" onChange={handleCheckBox} id="textOnly"></input><label htmlFor="textOnly">Text only</label>
         </div>
        <div className="print-area">
          {wallets.map((wallet, index) => (
            <React.Fragment key={index}>
              {textOnly ? (
                <>
                  <WalletCard wallet={wallet} />
                  <div className="pagebreak"></div>
                </>
              ) : (
                <WalletCardImg wallet={wallet} />
              )}
            </React.Fragment>
          ))}
        </div>
      </>
      )}
    </div>
  );
}

export default Home;
