import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import WalletCard from "../components/WalletCard";
import WalletCardImg from "../components/WalletCardImg";
import EntropyCollector from "../components/EntropyCollector";
import "./styles.css";

function Home({ wasm }) {
  const [wallets, setWallets] = useState([]);
  const [userEntropy, setUserEntropy] = useState([]);
  const [textOnly, setTextOnly] = useState(false);
  // The recovery phrase stays off the screen. It is rendered in two cases
  // only: during a print job, or after the user asks to see it.
  const [seedVisible, setSeedVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  const showSeed = seedVisible || printing;

  useEffect(() => {
    // The browser takes the print snapshot as soon as beforeprint returns,
    // so the render that adds the phrase has to finish inside the handler.
    const onBeforePrint = () => flushSync(() => setPrinting(true));
    const onAfterPrint = () => setPrinting(false);

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

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
          <button onClick={() => setSeedVisible((visible) => !visible)} aria-pressed={seedVisible}>
            {seedVisible ? "Hide recovery phrase" : "Show recovery phrase"}
          </button>
          <input type="checkbox" onChange={handleCheckBox} id="textOnly"></input><label htmlFor="textOnly">Text only</label>
         </div>
        <p className="seed-note">
          The recovery phrase is hidden on screen and appears on the printed page.
          No printer? Show it, copy the 24 words by hand, then hide it again.
        </p>
        <div className="print-area">
          {wallets.map((wallet, index) => (
            <React.Fragment key={index}>
              {textOnly ? (
                <>
                  <WalletCard wallet={wallet} showSeed={showSeed} />
                  <div className="pagebreak"></div>
                </>
              ) : (
                <WalletCardImg wallet={wallet} showSeed={showSeed} />
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
