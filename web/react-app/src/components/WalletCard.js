import React from "react";
import "./WalletCard.css";
import QRCodeGenerator from "./QRCodeGenerator";

function WalletCard({ wallet }) {
  return (
    <div class="wallet-card">
      <div class="wallet-section">
        <div class="section-title">
          <strong>Zcash Unified Address</strong>
        </div>
        <div class="content">
         <QRCodeGenerator class="qr-code" data={wallet.address} scale="2" />
          <p class="text-content">{wallet.address}</p>
        </div>
      </div>

      <hr class="divider" />

      <div class="wallet-section">
        <div class="section-title">
          <strong>Unified Full Viewing Key</strong>
        </div>
        <div class="content">
         <QRCodeGenerator class="qr-code" data={wallet.ufvk} scale="2" />
          <p class="text-content">{wallet.ufvk}</p>
        </div>
      </div>

      <hr class="divider" />

      <div class="wallet-section">
        <div class="section-title">
          <strong>Recovery Phrase</strong>
        </div>
        <div class="content">
          <QRCodeGenerator class="qr-code" data={wallet.seed} scale="3" />
          <p class="text-content">
            {wallet.seed}
            <p class="text-centent">Wallet birthday: {wallet.birthday}</p>
          </p>   
        </div>
      </div>
    </div>
  );
}

export default WalletCard;
