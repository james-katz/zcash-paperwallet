// The blank card the image mode draws on.
export const TEMPLATE_URL = "/Paper_Zcash_Wallet_vazio.jpg";

let pending = null;

// Asks for the template once, when the page opens, and keeps the decoded
// image in memory. A wallet made after the network is switched off still
// gets its card. If the request fails, the failure is kept too: asking
// again would be a request after the page has loaded, sent at the moment a
// wallet is made. The image mode then shows wallets as text.
export function loadTemplate() {
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("the wallet template image did not load"));
      image.src = TEMPLATE_URL;
    });
  }
  return pending;
}
