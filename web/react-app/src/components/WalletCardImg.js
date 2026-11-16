import React, { useRef, useEffect } from "react";
import QRCode from "qrcode";
import "./WalletCardImg.css";

function printRecoveryPhrase(ctx, seed) {
  const startX = 1150;
  const startY = 219;
  let currentX = startX;
  let currentY = startY;
  const lineSpace = 26;

  const words = seed.split(" ");

  // WARNING: DO NOT UNCOMMENT NEXT LINE!!!  
  // words[0] = "refrigerator"; // Test long word
  // words[11] = "refrigerator"; // Test long word

  for(let i = 0; i < words.length; i ++) {
    if(i === 12) {
      currentX = startX + 180;
      currentY = startY;
    } 

    ctx.font = "24px Sans";
    ctx.fillStyle = "#000"; // Black text
    ctx.fillText(`${words[i]}`, currentX, currentY);

    currentY += lineSpace;
  }

}

// Fills the frame where the template expected a QR code of the phrase.
export const NO_SEED_QR_NOTE = [
  "No QR code here,",
  "on purpose.",
  "Never photograph",
  "or scan these words.",
];

function printNoSeedQrNote(ctx) {
  const centerX = 1271; // middle of the 266 px frame that starts at x 1138
  let currentY = 655;

  ctx.save();
  ctx.font = "22px Sans";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  NO_SEED_QR_NOTE.forEach((line) => {
    ctx.fillText(line, centerX, currentY);
    currentY += 30;
  });
  ctx.restore();
}

const WalletCardImg = ({ wallet }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const renderWallet = async () => {
      // Hardcoded background image
      const bgImage = new Image();
      bgImage.src = "/Paper_Zcash_Wallet_vazio.jpg";

      bgImage.onload = async () => {
        // Set canvas size to match the background image
        canvas.width = bgImage.width;
        canvas.height = bgImage.height;

        // Draw the background image
        ctx.drawImage(bgImage, 0, 0);

        /*
        // Add reference address text, rotated
        const croppedAddr = `${wallet.address.slice(0, 8)} ... ${wallet.address.slice(-8)}`;

        ctx.save(); // Save the canvas state
        ctx.translate(2240, 700); // Move origin to (50, 300)
        ctx.rotate(-Math.PI / 2); // Rotate -90º (clockwise)
        ctx.font = "32px Arial";
        ctx.fillText(`Address: ${croppedAddr}`, 0, 0);
        ctx.restore(); // Restore the canvas state to undo rotation
        */

        // Add text for wallet birthday
        ctx.font = "32px Arial";
        ctx.fillStyle = "#000"; // Black text
        ctx.fillText(`${wallet.birthday}`, 1260, 995);

        // Add recovery phrase
        printRecoveryPhrase(ctx, wallet.seed);

        // Generate and add QR code for the ufvk
        const ufvkQrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(ufvkQrCanvas, wallet.ufvk, { width: 311});

        // Generate and add QR code for the address
        const addrQrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(addrQrCanvas, wallet.address, { width: 265});

        // No QR code for the recovery phrase: a QR is made to be photographed,
        // and the phrase must only ever exist as words on the printed paper.
        // The template still has a frame for it, so say why it is empty.
        printNoSeedQrNote(ctx);

        // Draw the QR code on the main canvas
        ctx.drawImage(ufvkQrCanvas, 95, 173); // UFVK
        ctx.drawImage(addrQrCanvas, 630, 191); // Unified Address
      };
    };

    renderWallet();
  }, [wallet]);

  return (
    <div className="paper-wallet-img">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

export default WalletCardImg;
