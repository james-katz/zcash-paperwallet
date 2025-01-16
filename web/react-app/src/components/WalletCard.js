import React from "react";
import "./WalletCard.css";

function WalletCard({ wallet }) {
  return (
    <div className="wallet-card">
      <img src="/wallet-placeholder.png" alt="Wallet" />
      <p><strong>Address:</strong> {wallet.address}</p>
      <p><strong>Private Key:</strong> {wallet.privateKey}</p>
    </div>
  );
}

export default WalletCard;
