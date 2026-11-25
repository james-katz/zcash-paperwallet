import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";

const QRCodeGenerator = ({ data, scale = 5 }) => {
  const canvasRef = useRef();

  useEffect(() => {
    if (data) {
      const canvas = canvasRef.current;

      // Generate the QR code and draw it on the canvas
      // Nothing is logged on failure: the data can be a key, and this app
      // never writes to the console. A failed QR leaves the canvas blank.
      QRCode.toCanvas(canvas, data, { scale: scale }, () => {});
    }
  }, [data, scale]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default QRCodeGenerator;
