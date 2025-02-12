import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
          <img className='navbar-logo-img' src="logo192.png"/>
          <p className="navbar-title">Zcash Paper Wallet Generator</p>
        </div>
      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </div>
    </nav>
  );
}

export default Navbar;
