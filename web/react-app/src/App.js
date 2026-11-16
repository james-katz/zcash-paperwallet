import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import initWasm, { generate_wallet_with_salt } from "./wasm/web";

function App() {
  const [wasm, setWasm] = React.useState(null);

  React.useEffect(() => {
    const loadWasm = async () => {
      await initWasm();
      // Hand out the typed wrapper, not what initWasm() resolves to. That is
      // the raw export table: its functions take a pointer and a length, and
      // a Uint8Array passed to them is read as an empty slice, so the
      // collected entropy was dropped without any error.
      setWasm({ generate_wallet_with_salt });
    };
    loadWasm();
  }, []);

  if (!wasm) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home wasm={wasm} />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
