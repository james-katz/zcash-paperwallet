import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import initWasm from "./wasm/web";

function App() {
  const [wasm, setWasm] = React.useState(null);

  React.useEffect(() => {
    const loadWasm = async () => {
      const wasmModule = await initWasm();
      setWasm(wasmModule);
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
