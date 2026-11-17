import React, { useState, useEffect, useRef } from "react";
import "./EntropyCollector.css";

const ENTROPY_SIZE = 512;

function EntropyCollector({ onEntropyCollected }) {
    const entropyRef = useRef([]); // Use ref for entropy
    const [done, setDone] = useState(false);
    const [trail, setTrail] = useState([]); // Array of mouse positions for the trail

    useEffect(() => {
        let moveCounter = 0; // Counter to track mouse movements
  
        const collectEntropy = (event) => {
            if (entropyRef.current.length < ENTROPY_SIZE) {
                let x, y;

                // Handle mousemove for desktop
                if (event.type === "mousemove") {
                    x = event.clientX;
                    y = event.clientY;
                }
                
                // Handle touchmove for mobile
                if (event.type === "touchmove") {
                    const touch = event.touches[0]; // Get the first touch point
                    x = touch.clientX;
                    y = touch.clientY;
                }
                const newValue = (x ^ y) % 255;                                
                
                if(Math.random() > 0.25) entropyRef.current.push(newValue);

                // Update the trail every `n` moves
                moveCounter++;
                if (moveCounter % 2 === 0) {
                    setTrail((prev) => [
                        ...prev,
                        { x: x, y: y, id: Date.now() + Math.random() * 1024 },
                    ]);
                }                
            } else if (!done) {
                setDone(true);
                window.removeEventListener("mousemove", collectEntropy);
                window.removeEventListener("touchmove", collectEntropy);

                onEntropyCollected(new Uint8Array(entropyRef.current));
            }            
        };

        window.addEventListener("mousemove", collectEntropy);
        window.addEventListener("touchmove", collectEntropy);

        return () => {
            window.removeEventListener("mousemove", collectEntropy);
            window.removeEventListener("touchmove", collectEntropy);
        }
    }, [entropyRef, done, onEntropyCollected]);

    // Convert entropy to a hexadecimal string
    const entropyHex = entropyRef.current 
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ");

    return (
        <div className="entropy-collector">       
            {/* Full-screen wrapper for mouse trail */}
            <div className="mouse-trail-wrapper">                
                {/* Render the drag marks */}
                {trail.map((point) => (
                    <div
                        key={point.id}
                        className="trail-dot"
                        style={{ top: point.y, left: point.x }}
                    ></div>
                ))}
            </div>
        {done ? (
            <p>Entropy gathered! Generating wallet...</p>
        ) : (
            <>
            <p>Move your mouse to gather entropy...</p>
            <div className="entropy-hex"> 
                {/* <strong>Entropy:</strong> */}
                 {entropyHex}
            </div>
            <p>Collected {((entropyRef.current.length / ENTROPY_SIZE) * 100).toFixed(2)} %</p>

            </>
        )}
        </div>
    );
}

export default EntropyCollector;
