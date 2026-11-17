// The blank card the image mode draws on.
export const TEMPLATE_URL = "/Paper_Zcash_Wallet_vazio.jpg";

let pending = null;

// Loads the template once and keeps the decoded image in memory. The page
// asks for it as soon as it opens, so a wallet made after the network is
// switched off still gets its card, and making a wallet needs no request.
export function loadTemplate() {
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        pending = null; // the next wallet tries again
        reject(new Error("the wallet template image did not load"));
      };
      image.src = TEMPLATE_URL;
    });
  }
  return pending;
}
