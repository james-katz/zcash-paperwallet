import React, { useRef, useEffect } from "react";
import QRCode from "qrcode";
import "./WalletCardImg.css";

function drawWrappedText(ctx, text, x, y, maxWidth, fontSize, lineHeight) {
    const words = text.split("");
    let line = "";
    let currentY = y;
   
    ctx.font = `${fontSize}px Arial`;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const testWidth = ctx.measureText(testLine).width;
  
      if (testWidth > maxWidth && i > 0) {
        // Draw the current line and move to the next
        ctx.fillText(line, x, currentY);
        line = words[i] + " "; // Start a new line
        currentY += lineHeight; // Move down by line height
      } else {
        line = testLine;
      }
    }
  
    // Draw the remaining text
    ctx.fillText(line, x, currentY);
} 

function printRecoveryPhrase(ctx, seed) {
  const startX = 1700;
  const startY = 748;
  let currentX = startX;
  let currentY = startY;
  const lineSpace = 39;

  const words = seed.split(" ");

  // WARNING: DO NOT UNCOMMENT NEXT LINE!!!  
  // words[0] = "refrigerator"; // Test long word

  for(let i = 0; i < words.length; i ++) {
    if(i == 12) {
      currentX = startX + 262;
      currentY = startY;
    } 

    ctx.font = "36px Sans";
    ctx.fillStyle = "#000"; // Black text
    ctx.fillText(`${words[i]}`, currentX, currentY);

    currentY += lineSpace;
  }

}

const WalletCardImg = ({ wallet }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const renderWallet = async () => {
      // Hardcoded background image
      const bgImage = new Image();
      bgImage.src = "/paperwallet_bg2.png";

      bgImage.onload = async () => {
        // Set canvas size to match the background image
        canvas.width = bgImage.width;
        canvas.height = bgImage.height;

        // Draw the background image
        ctx.drawImage(bgImage, 0, 0);

        // Add ufvk text
        // drawWrappedText(ctx, wallet.ufvk, 180, 210, 430, 12, 12);

        // Add address text
        // drawWrappedText(ctx, wallet.address, 180, 1025, 430, 20, 18);

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
        ctx.font = "48px Arial";
        ctx.fillStyle = "#000"; // Black text
        ctx.fillText(`${wallet.birthday}`, 1975, 1530);

        // Add recovery phrase
        printRecoveryPhrase(ctx, wallet.seed);

        // Generate and add QR code for the ufvk
        const ufvkQrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(ufvkQrCanvas, wallet.ufvk, { width: 464});

        // Generate and add QR code for the address
        const addrQrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(addrQrCanvas, wallet.address, { width: 464});

        // Generate and add QR code for the recovery phrase
        const seedQrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(seedQrCanvas, wallet.seed, { width: 460});

        // Draw the QR code on the main canvas
        ctx.drawImage(ufvkQrCanvas, 145, 238); // UFVK
        ctx.drawImage(addrQrCanvas, 145, 1021); // Unified Address
        ctx.drawImage(seedQrCanvas, 1668, 224); // Recovery Phrase
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
