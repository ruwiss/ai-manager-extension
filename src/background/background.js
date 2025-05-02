// Arka plan script'i başlatıldığında çalışacak kod
console.log("AI Manager Extension background script başlatıldı.");

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mesaj tipine göre işlem yap
  switch (message.action) {
    case "viewDetails":
      handleViewDetails(message.data);
      break;
    case "openInBrowser":
      handleOpenInBrowser(message.data);
      break;
    case "versionCheck":
      handleVersionCheck(message.data);
      break;
    default:
      console.log("Bilinmeyen mesaj tipi:", message.action);
  }

  // Asenkron yanıt vermek istiyorsanız true döndürün
  return false;
});

// "view-details" tıklaması işleme fonksiyonu
function handleViewDetails(data) {
  console.log("View Details işleniyor:", data);

  // data-token ve data-addon değerlerini kontrol et
  if (data.dataToken && data.dataAddon) {
    console.log("TR Etiket Bilgileri:");
    console.log("data-token:", data.dataToken);
    console.log("data-addon:", data.dataAddon);
  }
}

// "open-in-browser" tıklaması işleme fonksiyonu
function handleOpenInBrowser(data) {
  console.log("Open In Browser işleniyor:", data);

  // Yeni bir sekme açma
  chrome.tabs.create({ url: data.url });
}

// Sürüm kontrolü sonuçlarını işleme fonksiyonu
function handleVersionCheck(data) {
  if (!data.found) {
    console.log("UYARI: Web sayfasında extension-version meta etiketi bulunamadı!");
  } else if (!data.isCompatible) {
    console.log("UYARI: Sürüm uyumsuzluğu tespit edildi!");
    console.log(`Site sürümü: ${data.siteVersion}, Eklenti sürümü: ${data.extensionVersion}`);
  } else {
    console.log("Sürüm kontrolü başarılı: Sürümler uyumlu.");
  }
}
