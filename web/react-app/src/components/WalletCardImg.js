import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import "./WalletCardImg.css";

const WORD_MASK = "••••••";

// Draws the 24 slots of the recovery phrase: the words when `masked` is
// false, a row of dots otherwise.
function printRecoveryPhrase(ctx, seed, masked) {
  const startX = 1150;
  const startY = 219;
  let currentX = startX;
  let currentY = startY;
  const lineSpace = 26;

  const words = seed.split(" ");

  for(let i = 0; i < words.length; i ++) {
    if(i === 12) {
      currentX = startX + 180;
      currentY = startY;
    }

    ctx.font = "24px Sans";
    ctx.fillStyle = "#000"; // Black text
    ctx.fillText(masked ? WORD_MASK : `${words[i]}`, currentX, currentY);

    currentY += lineSpace;
  }

}

// The template reserves a frame for a QR code of the phrase. There is none
// (see printFrameNote), so the frame carries one of these notes instead.
export const NO_SEED_QR_NOTE = [
  "No QR code here,",
  "on purpose.",
  "Never photograph",
  "or scan these words.",
];

export const SEED_HIDDEN_NOTE = [
  "Words hidden on screen.",
  "They appear on the",
  "printed page.",
];

function printFrameNote(ctx, lines) {
  const centerX = 1271; // middle of the 266 px frame that starts at x 1138
  let currentY = 655;

  ctx.save();
  ctx.font = "22px Sans";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  lines.forEach((line) => {
    ctx.fillText(line, centerX, currentY);
    currentY += 30;
  });
  ctx.restore();
}

const WalletCardImg = ({ wallet, showSeed = false }) => {
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);
  const [assetsReady, setAssetsReady] = useState(false);

  // Everything asynchronous is loaded once per wallet: the template image
  // and the two QR codes (UFVK and address).
  useEffect(() => {
    let cancelled = false;
    assetsRef.current = null;
    setAssetsReady(false);

    // Hardcoded background image
    const bgImage = new Image();
    bgImage.onload = async () => {
      const ufvkQrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(ufvkQrCanvas, wallet.ufvk, { width: 311});

      const addrQrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(addrQrCanvas, wallet.address, { width: 265});

      // No QR code for the recovery phrase: a QR is made to be photographed,
      // and the phrase must only ever exist as words on the printed paper.

      if (cancelled) return;
      assetsRef.current = { bgImage, ufvkQrCanvas, addrQrCanvas };
      setAssetsReady(true);
    };
    bgImage.src = "/Paper_Zcash_Wallet_vazio.jpg";

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // Drawing is synchronous and runs in a layout effect. When a print job
  // flips showSeed, the words are on the canvas before the browser takes the
  // print snapshot, and they are wiped again as soon as it flips back.
  useLayoutEffect(() => {
    const assets = assetsRef.current;
    if (!assetsReady || !assets) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set canvas size to match the background image (this also clears it)
    canvas.width = assets.bgImage.width;
    canvas.height = assets.bgImage.height;

    // Draw the background image
    ctx.drawImage(assets.bgImage, 0, 0);

    // Recovery phrase: only when asked, never by default
    printRecoveryPhrase(ctx, wallet.seed, !showSeed);
    printFrameNote(ctx, showSeed ? NO_SEED_QR_NOTE : SEED_HIDDEN_NOTE);

    // Draw the QR code on the main canvas
    ctx.drawImage(assets.ufvkQrCanvas, 95, 173); // UFVK
    ctx.drawImage(assets.addrQrCanvas, 630, 191); // Unified Address

    // Add text for wallet birthday
    ctx.font = "32px Arial";
    ctx.fillStyle = "#000"; // Black text
    ctx.fillText(`${wallet.birthday}`, 1260, 995);
  }, [assetsReady, showSeed, wallet]);

  return (
    <div className="paper-wallet-img">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

export default WalletCardImg;
