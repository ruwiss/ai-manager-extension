// Content script başlangıcı
console.log("AI Manager Extension content script başlatıldı.");

// Sürüm bilgisi
const EXTENSION_VERSION = "1.1.0";
let siteVersion = null;
let isVersionMismatch = false;

// Sürüm kontrolü fonksiyonu
function checkVersion() {
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

      // Global değişkenleri güncelle
      siteVersion = result.siteVersion;
      isVersionMismatch = !result.isCompatible;
    } else {
      // Test için meta etiketi oluşturalım
      const head = document.head || document.getElementsByTagName("head")[0];
      const meta = document.createElement("meta");
      meta.setAttribute("name", "extension-version");
      meta.setAttribute("content", "1.1.0"); // Farklı bir sürüm belirtelim
      head.appendChild(meta);

      // Global değişkenleri güncelle
      siteVersion = "1.0.0"; // Burada farklı bir sürüm belirtelim ki uyumsuzluk oluşsun
      isVersionMismatch = true;
    }

    // Sürüm kontrolü sonuçlarını arka plan scriptine bildir
    chrome.runtime.sendMessage({
      action: "versionCheck",
      data: result,
    });

    // Sayfa yüklendikten sonra new-version-alert elementini kontrol et
    setTimeout(() => {
      // Artık checkOrCreateVersionAlert fonksiyonunu çağırmıyoruz
      // Sadece mevcut elementi bulup kullanacağız
    }, 1000);
  }, 500);
}

// Sürüm kontrolünü çağır
checkVersion();

/**
 * "view-details" ID'li veya class'lı elementlere tıklanma olayını dinleyen fonksiyon
 */
function listenForViewDetailsClicks() {
  // ID ve class seçicileri ile elementleri bul
  const viewDetailsById = document.querySelectorAll("#view-details");
  const viewDetailsByClass = document.querySelectorAll(".view-details");
  const viewDetailsByAttribute = document.querySelectorAll('[id*="view-details"]');

  // ID ile bulunan elementlere event listener ekle
  viewDetailsById.forEach((element) => {
    element.addEventListener("click", handleViewDetailsClick);
  });

  // Class ile bulunan elementlere event listener ekle
  viewDetailsByClass.forEach((element) => {
    element.addEventListener("click", handleViewDetailsClick);
  });

  // Attribute ile bulunan elementlere event listener ekle
  viewDetailsByAttribute.forEach((element) => {
    element.addEventListener("click", handleViewDetailsClick);
  });

  // Dinamik olarak eklenen elementleri dinle
  document.addEventListener("click", function (event) {
    // Tıklanan element veya üst elementlerinden biri view-details ID'sine veya class'ına sahip mi kontrol et
    let targetElement = event.target;
    let isViewDetailsElement = false;

    // En fazla 5 seviye yukarı çık
    for (let i = 0; i < 5; i++) {
      if (!targetElement) break;

      if (targetElement.id === "view-details" || targetElement.classList.contains("view-details") || (targetElement.id && targetElement.id.includes("view-details"))) {
        isViewDetailsElement = true;
        break;
      }

      targetElement = targetElement.parentElement;
    }

    // Eğer view-details elementi ise, işle
    if (isViewDetailsElement) {
      handleViewDetailsClick(event);
    }
  });
}

/**
 * view-details tıklama olayını işleyen fonksiyon
 */
function handleViewDetailsClick(event) {
  // Tıklanan elementin bulunduğu <tr> etiketini bul
  const trElement = findParentTr(event.target);

  if (trElement) {
    // <tr> etiketinin data-token ve data-addon değerlerini al
    const dataToken = trElement.getAttribute("data-token");
    const dataAddon = trElement.getAttribute("data-addon");

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

    // Diyalog açıldıktan sonra içindeki "open-in-browser" butonunu dinle
    setTimeout(() => {
      listenForDialogOpenInBrowserButton();
    }, 500);
  } else {
    // Arka plan scriptine mesaj gönder
    chrome.runtime.sendMessage({
      action: "viewDetails",
      data: {
        elementId: event.target.id,
        url: window.location.href,
      },
    });
  }
}

/**
 * Diyalog içindeki "open-in-browser" butonunu dinleyen fonksiyon
 */
function listenForDialogOpenInBrowserButton() {
  // Diyalog içindeki "open-in-browser" butonunu bul
  const dialogOpenInBrowserButton = document.querySelector(".dialog #open-in-browser") || document.querySelector(".modal #open-in-browser") || document.querySelector(".popup #open-in-browser");

  if (dialogOpenInBrowserButton) {
    console.log("Diyalog içinde open-in-browser butonu bulundu");

    // Butona tıklama olayı ekle
    dialogOpenInBrowserButton.addEventListener("click", function (event) {
      console.log("Diyalog içindeki open-in-browser butonuna tıklandı");

      // Eğer sürüm uyumsuzluğu varsa, güncelleme uyarısını göster
      if (isVersionMismatch && siteVersion) {
        showVersionAlert(siteVersion);
      }

      // Orijinal tıklama olayının normal şekilde devam etmesine izin ver
      // event.stopPropagation(); // Eğer orijinal olayı durdurmak isterseniz bu satırı açın
    });
  }
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
 * "open-in-browser" ID'li veya class'lı elementlere tıklanma olayını dinleyen fonksiyon
 */
function listenForOpenInBrowserClicks() {
  // ID ve class seçicileri ile elementleri bul
  const openInBrowserById = document.querySelectorAll("#open-in-browser");
  const openInBrowserByClass = document.querySelectorAll(".open-in-browser");
  const openInBrowserByAttribute = document.querySelectorAll('[id*="open-in-browser"]');

  // ID ile bulunan elementlere event listener ekle
  openInBrowserById.forEach((element) => {
    element.addEventListener("click", handleOpenInBrowserClick);
  });

  // Class ile bulunan elementlere event listener ekle
  openInBrowserByClass.forEach((element) => {
    element.addEventListener("click", handleOpenInBrowserClick);
  });

  // Attribute ile bulunan elementlere event listener ekle
  openInBrowserByAttribute.forEach((element) => {
    element.addEventListener("click", handleOpenInBrowserClick);
  });

  // Dinamik olarak eklenen elementleri dinle
  document.addEventListener("click", function (event) {
    // Tıklanan element veya üst elementlerinden biri open-in-browser ID'sine veya class'ına sahip mi kontrol et
    let targetElement = event.target;
    let isOpenInBrowserElement = false;

    // En fazla 5 seviye yukarı çık
    for (let i = 0; i < 5; i++) {
      if (!targetElement) break;

      if (targetElement.id === "open-in-browser" || targetElement.classList.contains("open-in-browser") || (targetElement.id && targetElement.id.includes("open-in-browser"))) {
        isOpenInBrowserElement = true;
        break;
      }

      targetElement = targetElement.parentElement;
    }

    // Eğer open-in-browser elementi ise, işle
    if (isOpenInBrowserElement) {
      handleOpenInBrowserClick(event);
    }
  });
}

/**
 * open-in-browser tıklama olayını işleyen fonksiyon
 */
function handleOpenInBrowserClick(event) {
  // Arka plan scriptine mesaj gönder
  chrome.runtime.sendMessage({
    action: "openInBrowser",
    data: {
      elementId: event.target.id,
      url: window.location.href,
    },
  });

  // Eğer sürüm uyumsuzluğu varsa, güncelleme uyarısını göster
  if (isVersionMismatch && siteVersion) {
    showVersionAlert(siteVersion);
  }
}

/**
 * Sürüm uyarı diyaloğunu gösteren fonksiyon
 * @param {string} newVersion - Yeni sürüm numarası
 */
function showVersionAlert(newVersion) {
  console.log("showVersionAlert çağrıldı, sürüm:", newVersion);

  // Diyalog içinde "new-version-alert" ID'li elementi aramak için biraz bekleyelim
  setTimeout(() => {
    // Önce diyalog içinde ara
    let alertElement = null;

    // Olası diyalog containerları
    const dialogContainers = [document.querySelector(".dialog"), document.querySelector(".modal"), document.querySelector(".popup"), document.querySelector("[role='dialog']"), document.querySelector("[aria-modal='true']")].filter((el) => el !== null);

    console.log("Bulunan diyalog sayısı:", dialogContainers.length);

    // Diyalog içinde "new-version-alert" ID'li elementi ara
    for (const container of dialogContainers) {
      const alertInDialog = container.querySelector("#new-version-alert");
      if (alertInDialog) {
        alertElement = alertInDialog;
        console.log("Diyalog içinde new-version-alert elementi bulundu");
        break;
      }

      // ID'si olmayan ama benzer class'ı olan elementleri de kontrol et
      const possibleAlerts = container.querySelectorAll(".version-alert, .update-alert, [class*='version'], [class*='alert']");
      if (possibleAlerts.length > 0) {
        alertElement = possibleAlerts[0];
        console.log("Diyalog içinde benzer bir alert elementi bulundu:", alertElement.className);
        break;
      }
    }

    // Eğer diyalog içinde bulunamadıysa, tüm sayfada ara
    if (!alertElement) {
      alertElement = document.querySelector("#new-version-alert");
    }

    if (alertElement) {
      console.log("Alert elementi bulundu, görünür yapılıyor");

      // "hidden" class'ını kaldır
      alertElement.classList.remove("hidden");

      // Diğer yaygın gizleme class'larını da kontrol et
      if (alertElement.classList.contains("d-none")) {
        alertElement.classList.remove("d-none");
      }

      // Görünürlük ayarı
      if (alertElement.style.display === "none") {
        alertElement.style.display = "block";
      }

      // İçindeki <p> etiketini bul
      const paragraphElement = alertElement.querySelector("p");

      if (paragraphElement) {
        console.log("Paragraf elementi bulundu, mevcut metin:", paragraphElement.textContent);

        // Mevcut metni al ve sonuna yeni sürüm bilgisini ekle
        const currentText = paragraphElement.textContent;

        // Eğer metin zaten sürüm bilgisini içermiyorsa ekle
        if (!currentText.includes(newVersion)) {
          paragraphElement.textContent = `${currentText} ${newVersion}`;
          console.log("Yeni metin:", paragraphElement.textContent);
        }
      } else {
        // Paragraf yoksa oluştur
        const newParagraph = document.createElement("p");
        newParagraph.textContent = `Yeni bir sürüm mevcut: ${newVersion}`;
        alertElement.appendChild(newParagraph);
        console.log("Yeni paragraf oluşturuldu");
      }
    } else {
      console.log(
        "Alert elementi bulunamadı, diyalog içeriği:",
        dialogContainers.map((d) => d.innerHTML)
      );
    }
  }, 300); // Diyaloğun tam olarak açılması için biraz bekleyelim
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
