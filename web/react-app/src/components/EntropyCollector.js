import React, { useState, useEffect, useRef } from "react";
import "./EntropyCollector.css";
import MouseTrail from "@pjsalita/react-mouse-trail";

function EntropyCollector({ onEntropyCollected }) {
    const trailConfig = {
        color: "#000000",
        idleAnimation: true,
        idleAnimationCount: 10,
        inverted: false,
        size: 16,
        trailCount: 64,
    };
    
    const entropyRef = useRef([]); // Use ref for entropy
    const [done, setDone] = useState(false);
    const [percentage, setPercentage] = useState(0);
    const [trail, setTrail] = useState([]); // Array of mouse positions for the trail

    useEffect(() => {
        let moveCounter = 0; // Counter to track mouse movements
  
        const collectEntropy = (event) => {
            if (entropyRef.current.length < 512) {
                const newValue = (event.clientX ^ event.clientY) % 255;                                
                if(Math.random() > 0.25) entropyRef.current.push(newValue)
                
            } else if (!done) {
                setDone(true);
                onEntropyCollected(new Uint8Array(entropyRef.current));
            }

            // Update the trail every `n` moves
            moveCounter++;
            if (moveCounter % 2 === 0) {
                setTrail((prev) => [
                ...prev,
                { x: event.clientX, y: event.clientY, id: Date.now() },
                ]);
            }
        };

        window.addEventListener("mousemove", collectEntropy);

        return () => window.removeEventListener("mousemove", collectEntropy);
    }, [entropyRef, percentage, done, onEntropyCollected]);

    // Convert entropy to a hexadecimal string
    const entropyHex = entropyRef.current 
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ");

    return (
        <div className="entropy-collector">       
            {/* Full-screen wrapper for MouseTrail */}
            <div className="mouse-trail-wrapper">
                {/* <MouseTrail {...trailConfig} /> */}
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
            <p>Collected {((entropyRef.current.length / 512) * 100).toFixed(2)} %</p>

            </>
        )}
        </div>
    );
}

export default EntropyCollector;
