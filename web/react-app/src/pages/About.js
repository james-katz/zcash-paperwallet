import React from "react";
import "./styles.css"; // Import the CSS file

const About = () => {
  return (
    <div className="home">
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
            This website generates a <strong>Zcash paper wallet</strong> by collecting entropy from your <strong>mouse movements</strong>. 
            Follow these steps to create your secure wallet:
          </p>
          <ol>
            <li>Move your mouse randomly until the <strong>entropy collector</strong> reaches 100%.</li>
            <li>Once the entropy is collected, you will be redirected to your generated wallet.</li>
            <li>Choose between an <strong>image-based wallet</strong> or a <strong>text-only wallet</strong>.</li>
            <li>
              You can either <strong>right-click</strong> on the wallet image and <strong>save it</strong>, or click the <strong>Print</strong> button 
              to print your wallet (or save it as a PDF).
            </li>
          </ol>
        </section>

        <section>
          <h2>Security Considerations</h2>
          <ul>
            <li>Never share your <strong>seed phrase</strong> or <strong>private keys</strong> with anyone.</li>
            <li>Store your printed wallet in a <strong>safe and secure place</strong>.</li>
            <li>Do not generate wallets on public or untrusted devices.</li>
          </ul>
        </section>

        <footer>
          <p>Made with ❤️ for Zcash users. Stay private, stay secure!</p>
        </footer>
      </div>
    </div>
  );
};

export default About;
