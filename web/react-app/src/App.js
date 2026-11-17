import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import { loadTemplate } from "./components/template";
import initWasm, { generate_wallet_with_salt } from "./wasm/web";

function App() {
  const [wasm, setWasm] = React.useState(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    // Fetch the card template now, while the page is still loading. People
    // are told to go offline before they generate, and the image mode has
    // nothing to draw on without it. If it fails, that mode shows text.
    loadTemplate().catch(() => {});

    const loadWasm = async () => {
      try {
        await initWasm();
      } catch (error) {
        // An old browser that refuses WebAssembly under the page's security
        // policy, or a .wasm file that did not arrive. Say so: the page used
        // to stay on "Loading..." for good.
        setLoadFailed(true);
        return;
      }
      // Hand out the typed wrapper, not what initWasm() resolves to. That is
      // the raw export table: its functions take a pointer and a length, and
      // a Uint8Array passed to them is read as an empty slice, so the
      // collected entropy was dropped without any error.
      setWasm({ generate_wallet_with_salt });
    };
    loadWasm();
  }, []);

  if (loadFailed) {
    return (
      <div className="load-error" role="alert">
        The wallet generator did not load in this browser. No wallet was made.
        Update the browser or use another one, then open this page again.
      </div>
    );
  }

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
