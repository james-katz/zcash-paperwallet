import React from "react";
import "./WalletCard.css";
import QRCodeGenerator from "./QRCodeGenerator";

export const SEED_HIDDEN_TEXT =
  "Hidden on screen. The 24 words appear on the printed page.";

function WalletCard({ wallet, showSeed = false }) {
  return (
    <div className="wallet-card">
      <div className="wallet-section">
        <div className="section-title">
          <strong>Zcash Unified Address</strong>
        </div>
        <div className="content">
         <QRCodeGenerator data={wallet.address} scale="2" />
          <p className="text-content">{wallet.address}</p>
        </div>
      </div>

      <hr className="divider" />

      <div className="wallet-section">
        <div className="section-title">
          <strong>Unified Full Viewing Key</strong>
        </div>
        <div className="content">
         <QRCodeGenerator data={wallet.ufvk} scale="2" />
          <p className="text-content">{wallet.ufvk}</p>
        </div>
      </div>

      <hr className="divider" />

      <div className="wallet-section">
        <div className="section-title">
          <strong>Recovery Phrase</strong>
        </div>
        <div className="content">
          {/* No QR code here: the phrase only exists as words on paper. */}
          <div className="text-content">
            <p className="text-content">
              {showSeed ? wallet.seed : SEED_HIDDEN_TEXT}
            </p>
            <p className="text-content">
              Wallet birthday: {wallet.birthday}. The wallet syncs from this block.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalletCard;
