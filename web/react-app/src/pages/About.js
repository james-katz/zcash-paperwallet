import React from "react";
import "./About.css"; // Import the CSS file

const About = () => {
  return (
    <div className="about-container">
      <h1>About This Website</h1>

      <section>
        <h2>What is Zcash?</h2>
        <p>
          Zcash is a privacy-focused cryptocurrency that offers enhanced anonymity 
          and security features. Unlike traditional cryptocurrencies, Zcash allows users 
          to shield their transactions, making them fully private and untraceable on the blockchain.
        </p>
      </section>

      <section>
        <h2>What is a Paper Wallet?</h2>
        <p>
          A paper wallet is a physical document that contains your cryptocurrency keys, 
          usually in the form of a private key, public address, and sometimes QR codes for easy access. 
          It provides a secure offline method to store your Zcash funds, protecting them from digital threats.
        </p>
      </section>

      <section>
        <h2>How to Use This Website</h2>
        <p>
          This website generates a **Zcash paper wallet** by collecting entropy from your **mouse movements**. 
          Follow these steps to create your secure wallet:
        </p>
        <ol>
          <li>Move your mouse randomly until the **entropy collector** reaches 100%.</li>
          <li>Once the entropy is collected, you will be redirected to your generated wallet.</li>
          <li>Choose between an **image-based wallet** or a **text-only wallet**.</li>
          <li>
            You can either **right-click** on the wallet image and **save it**, or click the **Print** button 
            to print your wallet (or save it as a PDF).
          </li>
        </ol>
      </section>

      <section>
        <h2>Security Considerations</h2>
        <p>
          - Never share your **seed phrase** or **private keys** with anyone.<br />
          - Store your printed wallet in a **safe and secure place**.<br />
          - Do not generate wallets on public or untrusted devices.<br />
        </p>
      </section>

      <footer>
        <p>Made with ❤️ for Zcash users. Stay private, stay secure!</p>
      </footer>
    </div>
  );
};

export default About;
