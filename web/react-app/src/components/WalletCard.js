import React from "react";
import "./WalletCard.css";

function WalletCard({ wallet }) {
  return (
    <div className="wallet-card">
      {/* <img src="/wallet-placeholder.png" alt="Wallet" /> */}
      <p><strong>Seed phrase:</strong> {wallet.seed}</p>
      <p><strong>Address:</strong> {wallet.address}</p>
      <p><strong>UFVK:</strong> {wallet.ufvk}</p>
    </div>
  );
}

export default WalletCard;
