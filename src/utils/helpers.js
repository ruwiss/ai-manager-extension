// Eklenti sürümü
const EXTENSION_VERSION = "1.0.0";

/**
 * Meta etiketinden extension-version değerini alıp eklenti sürümüyle karşılaştıran fonksiyon
 * @returns {Object} Karşılaştırma sonuçları
 */
function checkVersion() {
  const metaTag = document.querySelector('meta[name="extension-version"]');
  let result = {
    siteVersion: null,
    extensionVersion: EXTENSION_VERSION,
    isCompatible: false,
    found: false,
  };

  if (metaTag) {
    result.siteVersion = metaTag.getAttribute("content");
    result.isCompatible = result.siteVersion === EXTENSION_VERSION;
    result.found = true;

    console.log("Site sürümü:", result.siteVersion);
    console.log("Eklenti sürümü:", EXTENSION_VERSION);

    if (!result.isCompatible) {
      console.log("Sürüm uyumsuzluğu tespit edildi!");
    } else {
      console.log("Sürümler uyumlu.");
    }
  } else {
    console.log("extension-version meta etiketi bulunamadı.");
  }

  return result;
}

/**
 * Chrome eklentisine mesaj gönderen yardımcı fonksiyon
 * @param {string} action - Mesaj tipi
 * @param {Object} data - Mesaj verileri
 */
function sendMessageToBackground(action, data) {
  chrome.runtime.sendMessage({
    action: action,
    data: data,
  });
}

// Fonksiyonları global olarak dışa aktar
window.extensionHelpers = {
  checkVersion,
  sendMessageToBackground,
};
