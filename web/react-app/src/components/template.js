// The blank card the image mode draws on.
export const TEMPLATE_URL = "/Paper_Zcash_Wallet_vazio.jpg";

// How long the template gets, counted from the first request, which the
// page makes as it opens. Past that it counts as failed.
export const TEMPLATE_TIMEOUT_MS = 20000;

let pending = null;

// Asks for the template once, when the page opens, and keeps the decoded
// image in memory. A wallet made after the network is switched off still
// gets its card. If the request fails or takes too long, the failure is
// kept too: asking again would be a request after the page has loaded, sent
// at the moment a wallet is made. The image mode then shows wallets as text.
export function loadTemplate() {
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const fail = () => reject(new Error("the wallet template image did not load"));
      const timer = setTimeout(fail, TEMPLATE_TIMEOUT_MS);
      const image = new Image();
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      image.src = TEMPLATE_URL;
    });
  }
  return pending;
}
