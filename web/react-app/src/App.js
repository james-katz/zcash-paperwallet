import React, { useEffect, useState } from "react";
import init, { generate_paper_wallet } from "./wasm/web";

import logo from './logo.svg';
import './App.css';

function App() {
  const [address, setAddress] = useState("");
  useEffect(() => {
    const loadWasm = async () => {
      await init(); // Initialize WASM
      const wallet = generate_paper_wallet();
      setAddress(wallet);
    };
    loadWasm();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <p>
          Address from rust: {address}
        </p>
      </header>
    </div>
  );
}

export default App;
