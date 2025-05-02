// Content script başlangıcı
console.log("AI Manager Extension content script başlatıldı.");

// Sürüm kontrolü fonksiyonu
function checkVersion() {
  const EXTENSION_VERSION = "1.0.0";

  // Meta etiketi DOM yüklenmeden önce bulunamayabilir, bu yüzden biraz bekleyelim
  setTimeout(() => {
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
    } else {
      // Test için meta etiketi oluşturalım
      const head = document.head || document.getElementsByTagName("head")[0];
      const meta = document.createElement("meta");
      meta.setAttribute("name", "extension-version");
      meta.setAttribute("content", "1.0.0");
      head.appendChild(meta);
    }

    // Sürüm kontrolü sonuçlarını arka plan scriptine bildir
    chrome.runtime.sendMessage({
      action: "versionCheck",
      data: result,
    });
  }, 500);
}

// Sürüm kontrolünü çağır
checkVersion();

/**
 * "view-details" ID'li elementlere tıklanma olayını dinleyen fonksiyon
 */
function listenForViewDetailsClicks() {
  const viewDetailsElements = document.querySelectorAll("#view-details");

  viewDetailsElements.forEach((element) => {
    element.addEventListener("click", function (event) {
      // Tıklanan elementin bulunduğu <tr> etiketini bul
      const trElement = findParentTr(event.target);

      if (trElement) {
        // <tr> etiketinin data-token ve data-addon değerlerini al
        const dataToken = trElement.getAttribute("data-token");
        const dataAddon = trElement.getAttribute("data-addon");

        console.log("Tıklanan elementin <tr> bilgileri:");
        console.log("data-token:", dataToken);
        console.log("data-addon:", dataAddon);

        // Arka plan scriptine mesaj gönder
        chrome.runtime.sendMessage({
          action: "viewDetails",
          data: {
            elementId: event.target.id,
            url: window.location.href,
            dataToken: dataToken,
            dataAddon: dataAddon,
          },
        });
      } else {
        console.log("Tıklanan element bir <tr> etiketi içinde değil!");

        // Arka plan scriptine mesaj gönder
        chrome.runtime.sendMessage({
          action: "viewDetails",
          data: {
            elementId: event.target.id,
            url: window.location.href,
          },
        });
      }
    });
  });
}

/**
 * Bir elementin üst <tr> etiketini bulan yardımcı fonksiyon
 * @param {Element} element - Başlangıç elementi
 * @returns {Element|null} - Bulunan <tr> elementi veya null
 */
function findParentTr(element) {
  let currentElement = element;

  // En fazla 10 seviye yukarı çık
  for (let i = 0; i < 10; i++) {
    if (!currentElement) return null;

    // Eğer <tr> elementine ulaştıysak, onu döndür
    if (currentElement.tagName && currentElement.tagName.toLowerCase() === "tr") {
      return currentElement;
    }

    // Bir üst elemente geç
    currentElement = currentElement.parentElement;
  }

  return null; // <tr> elementi bulunamadı
}

/**
 * "open-in-browser" ID'li elementlere tıklanma olayını dinleyen fonksiyon
 */
function listenForOpenInBrowserClicks() {
  const openInBrowserElements = document.querySelectorAll("#open-in-browser");

  openInBrowserElements.forEach((element) => {
    element.addEventListener("click", function (event) {
      // Arka plan scriptine mesaj gönder
      chrome.runtime.sendMessage({
        action: "openInBrowser",
        data: {
          elementId: event.target.id,
          url: window.location.href,
        },
      });
    });
  });
}

// Sayfa yüklendiğinde dinleyicileri başlat
function initListeners() {
  listenForViewDetailsClicks();
  listenForOpenInBrowserClicks();
}

// Sayfa yüklendiğinde dinleyicileri başlat
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initListeners);
} else {
  initListeners();
}
