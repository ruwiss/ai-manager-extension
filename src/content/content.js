// Sürüm bilgisi
const EXTENSION_VERSION = "1.0.0";
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
      // Meta etiketi bulunamadı, test için bir tane oluşturalım
      const head = document.head || document.getElementsByTagName("head")[0];
      const meta = document.createElement("meta");
      meta.setAttribute("name", "extension-version");
      meta.setAttribute("content", "1.0.0"); // Test için farklı bir sürüm
      head.appendChild(meta);

      // Global değişkenleri güncelle
      siteVersion = "1.0.0";
      isVersionMismatch = true;
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
    // <tr> etiketinin data-token, data-addon ve data-type değerlerini al
    const dataToken = trElement.getAttribute("data-token");
    const dataAddon = trElement.getAttribute("data-addon");
    const dataType = trElement.getAttribute("data-type");

    // Son görüntülenen hesap verilerini global olarak sakla
    window.lastViewedAccountData = {
      dataType: dataType,
      dataToken: dataToken,
      dataAddon: dataAddon,
      timestamp: Date.now(),
    };

    console.log("Saved account data to window.lastViewedAccountData:", `type=${dataType}, token exists=${!!dataToken}, addon exists=${!!dataAddon}`);

    try {
      // Arka plan scriptine mesaj gönder
      chrome.runtime.sendMessage({
        action: "viewDetails",
        data: {
          elementId: event.target.id,
          url: window.location.href,
          dataToken: dataToken,
          dataAddon: dataAddon,
          dataType: dataType,
        },
      });
    } catch (error) {
      console.log("Eklenti mesajı gönderilirken hata oluştu:", error.message);
    }

    // Eğer hesap türü "cursor" ise ve token varsa, kalan kullanım limitini kontrol et
    if (dataType === "cursor" && dataToken) {
      // Diyalog açıldıktan sonra Cursor API'sine istek yap
      setTimeout(() => {
        fetchCursorUsage(dataToken);
      }, 500);
    }

    // Eğer hesap türü "windsurf" ise ve token varsa, token-copy-button butonunu göster
    if (dataType === "windsurf" && dataToken) {
      // Diyalog açıldıktan sonra token-copy-button butonunu göster
      setTimeout(() => {
        const tokenCopyButton = document.querySelector("#token-copy-button");
        if (tokenCopyButton && dataToken.trim() !== "") {
          // hidden class'ı varsa kaldır
          tokenCopyButton.classList.remove("hidden");
          console.log("Token copy button is now visible for windsurf account");

          // Butona tıklama olayı ekle (eğer yoksa)
          if (!tokenCopyButton.hasAttribute("windsurf-listener-added")) {
            tokenCopyButton.setAttribute("windsurf-listener-added", "true");
            console.log("Added click listener to token copy button");

            tokenCopyButton.addEventListener("click", function () {
              console.log("Token copy button clicked, requesting token refresh");
              // Background service'e token yenileme isteği gönder
              chrome.runtime.sendMessage({
                action: "refreshWindsurfToken",
                data: {
                  refreshToken: dataToken,
                },
              });

              // Butonu disabled yap ve "Getting token..." metnini göster
              tokenCopyButton.disabled = true;
              tokenCopyButton.textContent = "Getting token...";
            });
          }
        }
      }, 500);
    }

    // Diyalog açıldıktan sonra içindeki "open-in-browser" butonunu dinle
    setTimeout(() => {
      listenForDialogOpenInBrowserButton();
    }, 500);
  } else {
    console.log("No parent TR element found for view-details click");
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
    console.log("Dialog open-in-browser button found");

    // Orijinal onclick fonksiyonunu tamamen kaldır
    dialogOpenInBrowserButton.onclick = null;

    // Diyalog içindeki tüm tr elementlerini bulalım ve loglayalım
    const dialogContainer = dialogOpenInBrowserButton.closest(".dialog, .modal, .popup");
    if (dialogContainer) {
      const allTrElements = dialogContainer.querySelectorAll("tr");
      console.log(`Found ${allTrElements.length} TR elements in dialog`);

      // Her tr'nin özelliklerini görelim
      allTrElements.forEach((tr, index) => {
        const type = tr.getAttribute("data-type");
        const token = tr.getAttribute("data-token");
        const addon = tr.getAttribute("data-addon");
        console.log(`TR #${index}: type=${type || "not set"}, token exists=${!!token}, addon exists=${!!addon}`);
      });
    } else {
      console.log("Could not find dialog container");
    }

    // Önce diyalog içindeki type ve token bilgilerini alalım
    // Bu bilgiler genelde diyalog başlığında veya gizli bir alanda bulunabilir
    let dataType = null;
    let dataToken = null;
    let dataAddon = null;

    // TR elementini bulmaya çalışalım
    const trElement = findParentTr(dialogOpenInBrowserButton);

    // TR elementinden type ve token değerlerini almayı deneyelim
    if (trElement) {
      dataType = trElement.getAttribute("data-type");
      dataToken = trElement.getAttribute("data-token");
      dataAddon = trElement.getAttribute("data-addon");
      console.log(`Account type from TR: ${dataType || "not found"}, token available: ${dataToken ? "yes" : "no"}, addon available: ${dataAddon ? "yes" : "no"}`);
    } else {
      console.log("TR element not found, trying to find data from dialog context");

      // TR bulunamadıysa, diyalog içinde data-type ve data-token öznitelikleri olan başka elementler arayalım
      const dialogContainer = dialogOpenInBrowserButton.closest(".dialog, .modal, .popup");
      if (dialogContainer) {
        const elementsWithType = dialogContainer.querySelectorAll("[data-type]");
        const elementsWithToken = dialogContainer.querySelectorAll("[data-token]");
        const elementsWithAddon = dialogContainer.querySelectorAll("[data-addon]");

        if (elementsWithType.length > 0) {
          dataType = elementsWithType[0].getAttribute("data-type");
          console.log(`Found data-type="${dataType}" from another element in dialog`);
        }

        if (elementsWithToken.length > 0) {
          dataToken = elementsWithToken[0].getAttribute("data-token");
          console.log(`Found data-token (exists: ${!!dataToken}) from another element in dialog`);
        }

        if (elementsWithAddon.length > 0) {
          dataAddon = elementsWithAddon[0].getAttribute("data-addon");
          console.log(`Found data-addon (exists: ${!!dataAddon}) from another element in dialog`);
        }
      }
    }

    // Alternatif olarak, handleViewDetailsClick'te kullanılan dataType ve dataToken değerlerini saklayalım
    // ve burada kullanalım
    if (window.lastViewedAccountData) {
      if (!dataType) dataType = window.lastViewedAccountData.dataType;
      if (!dataToken) dataToken = window.lastViewedAccountData.dataToken;
      if (!dataAddon) dataAddon = window.lastViewedAccountData.dataAddon;
      console.log(`Using cached account data - type: ${dataType}, token exists: ${!!dataToken}, addon exists: ${!!dataAddon}`);
    }

    // Eğer type ve token değerleri varsa, butona tıklama olayı ekle
    if (dataType) {
      console.log(`Account data found - type: ${dataType}, token available: ${dataToken ? "yes" : "no"}, addon available: ${dataAddon ? "yes" : "no"}`);

      // Butona tıklama olayı ekle
      dialogOpenInBrowserButton.addEventListener(
        "click",
        function (event) {
          // Varsayılan davranışı ve event propagasyonu engelle
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          console.log(`Open in browser button clicked for ${dataType} account`);

          // Background service'e mesaj gönder
          chrome.runtime.sendMessage(
            {
              action: "openInBrowser",
              data: {
                dataType: dataType,
                dataToken: dataToken,
                dataAddon: dataAddon,
                url: window.location.href,
              },
            },
            function (response) {
              if (chrome.runtime.lastError) {
                console.log("Error receiving response:", chrome.runtime.lastError);
              } else {
                console.log("Open in browser response:", response);
              }
            }
          );

          // Ek önlem olarak, event'i durdurduktan sonra return false ile fonksiyonu sonlandır
          return false;
        },
        true
      ); // Capture phase'de event'i yakala
    } else {
      console.log("Could not find required data-type attribute for open-in-browser functionality");
    }
  }
}

/**
 * Bir elementin üst <tr> etiketini bulan yardımcı fonksiyon
 * @param {Element} element - Başlangıç elementi
 * @returns {Element|null} - Bulunan <tr> elementi veya null
 */
function findParentTr(element) {
  if (!element) {
    console.log("findParentTr: Input element is null or undefined");
    return null;
  }

  console.log("findParentTr: Starting search from element:", element.tagName, element.id ? `#${element.id}` : "");

  let currentElement = element;

  // En fazla 10 seviye yukarı çık
  for (let i = 0; i < 10; i++) {
    if (!currentElement) {
      console.log(`findParentTr: Null element at level ${i}`);
      return null;
    }

    // Eğer <tr> elementine ulaştıysak, onu döndür
    if (currentElement.tagName && currentElement.tagName.toLowerCase() === "tr") {
      console.log("findParentTr: Found TR element at level", i);

      // TR elementinin data-type ve data-token değerlerini de loglayalım
      const dataType = currentElement.getAttribute("data-type");
      const dataToken = currentElement.getAttribute("data-token");
      console.log(`findParentTr: TR element data - type: ${dataType || "not set"}, token exists: ${!!dataToken}`);

      return currentElement;
    }

    // Bir üst elemente geç
    console.log(`findParentTr: Level ${i} - Current: ${currentElement.tagName}${currentElement.id ? `#${currentElement.id}` : ""}, moving to parent`);
    currentElement = currentElement.parentElement;
  }

  console.log("findParentTr: Could not find TR element within 10 levels up");
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
  // Varsayılan tıklama davranışını engelle
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  // Tıklanan butonun tr elementini bul
  const openInBrowserButton = event.target.closest("#open-in-browser") || event.target;

  // Orijinal onclick fonksiyonunu tamamen kaldır
  openInBrowserButton.onclick = null;

  const trElement = findParentTr(openInBrowserButton);

  let dataType = null;
  let dataToken = null;
  let dataAddon = null;

  // tr elementinden type ve token değerlerini al
  if (trElement) {
    dataType = trElement.getAttribute("data-type");
    dataToken = trElement.getAttribute("data-token");
    dataAddon = trElement.getAttribute("data-addon");
    console.log(`Account type: ${dataType}, token available: ${dataToken ? "yes" : "no"}, addon available: ${dataAddon ? "yes" : "no"}`);
  } else if (window.lastViewedAccountData) {
    // Son görüntülenen hesap verilerini kullan
    dataType = window.lastViewedAccountData.dataType;
    dataToken = window.lastViewedAccountData.dataToken;
    dataAddon = window.lastViewedAccountData.dataAddon;
    console.log(`Using cached account data - type: ${dataType}, token exists: ${!!dataToken}, addon exists: ${!!dataAddon}`);
  }

  if (dataType) {
    try {
      console.log(`Sending openInBrowser message for ${dataType} account`);
      // Arka plan scriptine mesaj gönder
      chrome.runtime.sendMessage(
        {
          action: "openInBrowser",
          data: {
            elementId: event.target.id,
            url: window.location.href,
            dataType: dataType,
            dataToken: dataToken,
            dataAddon: dataAddon,
          },
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.log("Error receiving response:", chrome.runtime.lastError);
          } else {
            console.log("Open in browser response:", response);
          }
        }
      );
    } catch (error) {
      console.log("Error sending extension message:", error.message);
    }
  } else {
    console.log("Cannot open in browser: missing data-type");
  }

  // Ek önlem olarak, event'i durdurduktan sonra return false ile fonksiyonu sonlandır
  return false;
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
      console.log("Diyalog içeriği:", container.innerHTML);

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
      console.log("Sayfa genelinde new-version-alert elementi arandı:", alertElement ? "bulundu" : "bulunamadı");
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
        console.log("Paragraf elementi bulunamadı, yeni bir paragraf oluşturuluyor");
        const newParagraph = document.createElement("p");
        newParagraph.textContent = `Yeni bir sürüm mevcut: ${newVersion}`;
        alertElement.appendChild(newParagraph);
      }
    } else {
      console.log("Alert elementi bulunamadı. Diyalog içerikleri:", dialogContainers.map((d) => d.innerHTML.substring(0, 100) + "...").join("\n"));
    }
  }, 300); // Diyaloğun tam olarak açılması için biraz bekleyelim
}

/**
 * Cursor API'sinden kullanım bilgilerini çeken fonksiyon
 * @param {string} token - Cursor hesabının token değeri
 */
function fetchCursorUsage(token) {
  console.log("Cursor kullanım bilgileri alınıyor...");

  // Token'ı decode et
  let userId = "";

  try {
    // Token'ı "%3A%3A" ile böl
    const parts = token.split("%3A%3A");
    if (parts.length >= 2) {
      // İlk kısım userId
      userId = parts[0];
      console.log("User ID:", userId);
    } else {
      console.error("Token formatı beklendiği gibi değil");
      return;
    }
  } catch (error) {
    console.error("Token işlenirken hata oluştu:", error);
    return;
  }

  if (!userId) {
    console.error("Token'dan gerekli bilgiler alınamadı");
    return;
  }

  try {
    // Background script'e mesaj gönder
    chrome.runtime.sendMessage(
      {
        action: "fetchCursorUsage",
        data: {
          userId: userId,
          token: token,
        },
      },
      function (response) {
        // İlk yanıtı al
        console.log("Cursor API isteği başlatıldı, işleniyor:", response);
      }
    );
  } catch (error) {
    console.error("Background script'e mesaj gönderilirken hata oluştu:", error);
  }
}

// Sayfa yüklendiğinde dinleyicileri başlat
function initListeners() {
  listenForViewDetailsClicks();
  listenForOpenInBrowserClicks();
}

// Hesapları kontrol eden fonksiyon
function checkAccounts() {
  console.log("Hesaplar kontrol ediliyor...");
  // Burada hesapları kontrol etme işlemleri yapılabilir
}

// Tüm olay dinleyicilerini ekleyen fonksiyon
function addEventListeners() {
  console.log("Olay dinleyicileri ekleniyor...");
  listenForViewDetailsClicks();
  listenForOpenInBrowserClicks();
}

// Sayfa yüklendiğinde dinleyicileri başlat
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initListeners);
} else {
  initListeners();
}

// Background script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log("Content script mesaj aldı:", message);

  if (message.action === "cursorUsageResult") {
    const result = message.data;

    if (result && result.success) {
      console.log("Kullanım bilgisi alındı:", result.usageText);

      // Diyalogdaki remaining-limit elementini bul ve güncelle
      const remainingLimitElement = document.getElementById("remaining-limit");
      const remainingLimitValueElement = document.getElementById("remaining-limit-value");

      if (remainingLimitElement && remainingLimitValueElement) {
        // hidden class'ını kaldır
        remainingLimitElement.classList.remove("hidden");

        // Değeri güncelle
        remainingLimitValueElement.textContent = result.usageText;
      }
    } else {
      console.error("Kullanım bilgisi alınamadı:", result ? result.error : "Yanıt alınamadı");
    }
  } else if (message.action === "refreshWindsurfTokenResult") {
    console.log("Windsurf token refresh result received:", message.data);

    // Token-copy-button butonunu bul
    const tokenCopyButton = document.querySelector("#token-copy-button");

    if (tokenCopyButton) {
      if (message.data.success) {
        // Access token'ı panoya kopyala
        navigator.clipboard
          .writeText(message.data.accessToken)
          .then(() => {
            // Kopyalama başarılı olduğunda buton metnini değiştir ve disabled bırak
            console.log("Access token copied to clipboard successfully");
            tokenCopyButton.textContent = "Copied!";
            // Buton bir kez kullanıldıktan sonra kalıcı olarak devre dışı bırakılır
            tokenCopyButton.disabled = true;

            // Butonun metin rengini siyah yap (açık temada görünür olması için)
            tokenCopyButton.style.color = "#22C55E";
          })
          .catch((err) => {
            console.error("Error copying to clipboard:", err);
            tokenCopyButton.textContent = "Error!";
            tokenCopyButton.disabled = false;

            // Hata durumunda metin rengini kırmızı yap (açık temada görünür olması için)
            tokenCopyButton.style.color = "#FF0000";
          });
      } else {
        // Hata durumunda
        console.error("Failed to refresh token:", message.data.error);
        tokenCopyButton.textContent = "Error!";
        tokenCopyButton.disabled = false;

        // Hata durumunda metin rengini kırmızı yap (açık temada görünür olması için)
        tokenCopyButton.style.color = "#FF0000";
      }
    }
  }

  // Yanıt gönder (gerekirse)
  return true;
});
