// Arka plan script'i başlatıldığında çalışacak kod
console.log("AI Manager Extension background script başlatıldı.");

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mesaj tipine göre işlem yap
  switch (message.action) {
    case "openInBrowser":
      console.log("Open In Browser mesajı alındı:", message.data);
      // Hiçbir durumda yeni sekme açılmayacak
      break;
    default:
      console.log("Bilinmeyen mesaj tipi:", message.action);
  }

  // Asenkron yanıt vermek istiyorsanız true döndürün
  return false;
});
