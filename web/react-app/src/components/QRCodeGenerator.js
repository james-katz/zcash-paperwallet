import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";

const QRCodeGenerator = ({ data, scale = 5 }) => {
  const canvasRef = useRef();

  useEffect(() => {
    if (data) {
      const canvas = canvasRef.current;

      // Generate the QR code and draw it on the canvas
      QRCode.toCanvas(canvas, data, { scale: scale }, (error) => {
        if (error) {
          console.error("Error generating QR code:", error);
        }
      });
    }
  }, [data, scale]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default QRCodeGenerator;
