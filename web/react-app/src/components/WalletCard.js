import React from "react";
import "./WalletCard.css";
import QRCodeGenerator from "./QRCodeGenerator";

// Shown in place of the phrase. If a print ever goes out without the words,
// this is what lands on the paper, so it has to make sense there as well.
export const SEED_HIDDEN_TEXT =
  "Hidden on screen. If you are reading this on paper, the print failed: do not use this wallet.";

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
