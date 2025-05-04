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
    case "fetchCursorUsage":
      console.log("Cursor kullanım bilgisi isteği alındı");
      // Hemen bir yanıt gönder, bağlantının kapanmasını önlemek için
      sendResponse({ processing: true });

      // Sonra asıl işlemi başlat
      fetchCursorUsage(message.data).then((result) => {
        // chrome.tabs.sendMessage ile content script'e yanıt gönder
        if (sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "cursorUsageResult",
            data: result,
          });
        }
      });
      break;
    case "refreshWindsurfToken":
      console.log("Windsurf token yenileme isteği alındı");
      // Hemen bir yanıt gönder, bağlantının kapanmasını önlemek için
      sendResponse({ processing: true });

      // Sonra asıl işlemi başlat
      refreshWindsurfToken(message.data).then((result) => {
        // chrome.tabs.sendMessage ile content script'e yanıt gönder
        if (sender.tab && sender.tab.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "refreshWindsurfTokenResult",
            data: result,
          });
        }
      });
      break;
    case "viewDetails":
      console.log("View Details mesajı alındı:", message.data);
      // viewDetails mesajı işlendi
      break;
    default:
      console.log("Bilinmeyen mesaj tipi:", message.action);
  }

  // Asenkron yanıt vermek istiyorsanız true döndürün
  return false;
});

/**
 * Cursor API'sinden kullanım bilgilerini çeken fonksiyon
 * @param {Object} data - İstek verileri
 * @returns {Promise<Object>} - İşlem sonucunu içeren Promise
 */
function fetchCursorUsage(data) {
  return new Promise((resolve, reject) => {
    const { userId, token } = data;

    console.log("Cursor kullanım bilgileri alınıyor...");
    console.log("User ID:", userId);
    console.log("Token değeri:", token);

    // Önce cookie'yi ayarlayalım
    console.log("Cookie ayarlanıyor...");
    try {
      chrome.cookies.set(
        {
          url: "https://www.cursor.com",
          name: "WorkosCursorSessionToken",
          value: token,
          domain: "www.cursor.com",
          path: "/",
          secure: true,
          httpOnly: false,
          sameSite: "no_restriction",
        },
        function (cookie) {
          console.log("Cookie ayarlandı:", cookie);

          // Şimdi isteği yapalım
          console.log("Fetch isteği yapılıyor...");
          fetch(`https://www.cursor.com/api/usage?user=${userId}`, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
              Accept: "*/*",
              Te: "trailers",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Dest": "empty",
              "Accept-Language": "tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3",
              "Accept-Encoding": "gzip, deflate, br",
              Cookie: `WorkosCursorSessionToken=${token}`,
              "Sec-Fetch-Site": "same-origin",
              Referer: "https://www.cursor.com/settings",
            },
            credentials: "include",
            cache: "no-store",
          })
            .then((response) => {
              console.log("Fetch durum kodu:", response.status);
              console.log("Fetch yanıt başlıkları:", [...response.headers.entries()]);

              if (response.ok) {
                return response.json();
              } else {
                throw new Error(`API isteği başarısız oldu. Durum kodu: ${response.status}`);
              }
            })
            .then((data) => {
              console.log("Cursor API yanıtı:", data);

              try {
                // Kullanım bilgilerini işle
                const usageInfo = {};

                if (data) {
                  Object.entries(data).forEach(([model, stats]) => {
                    if (stats && typeof stats === "object" && (stats.numRequests || 0) > 0) {
                      const renamedModel = model.toString().replace("gpt-4", "Premium").replace("gpt-3.5-turbo", "Free");

                      const requests = stats.numRequests;
                      const maxRequests = stats.maxRequestUsage;

                      if (requests) {
                        usageInfo[renamedModel] = maxRequests ? `${requests}/${maxRequests}` : `${requests}`;
                      }
                    }
                  });
                }

                // Kullanım bilgilerini döndür
                if (Object.keys(usageInfo).length > 0) {
                  const usageText = Object.entries(usageInfo)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" ve ");

                  console.log("Kullanım bilgisi:", usageText);
                  resolve({ success: true, usageText });
                } else {
                  console.error("Kullanım bilgisi bulunamadı");
                  resolve({ success: false, error: "Kullanım bilgisi bulunamadı" });
                }
              } catch (error) {
                console.error("Yanıt işlenirken hata oluştu:", error);
                reject({ success: false, error: error.message });
              }
            })
            .catch((error) => {
              console.error("Fetch hatası:", error);
              console.error("Tam hata detayları:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
              reject({ success: false, error: error.message });
            });
        }
      );
    } catch (error) {
      console.error("Cookie ayarlanırken hata oluştu:", error);
      reject({ success: false, error: error.message });
    }
  });
}

/**
 * Windsurf token'i yenileyen fonksiyon
 * @param {Object} data - İstek verileri
 * @returns {Promise<Object>} - İşlem sonucunu içeren Promise
 */
function refreshWindsurfToken(data) {
  return new Promise((resolve, reject) => {
    const { refreshToken } = data;
    const apiKey = "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY"; // Sabit API Key

    console.log("Refreshing Windsurf token...");
    console.log("Refresh Token:", refreshToken);

    // Token boşsa hata döndür
    if (!refreshToken) {
      console.error("Refresh token is empty");
      resolve({ success: false, error: "Refresh token is empty" });
      return;
    }

    // API isteği yap
    fetch("https://securetoken.googleapis.com/v1/token?key=" + apiKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    })
      .then((response) => {
        console.log("Fetch status code:", response.status);

        if (response.ok) {
          return response.json();
        } else {
          throw new Error(`API request failed. Status code: ${response.status}`);
        }
      })
      .then((data) => {
        console.log("Windsurf API response received");

        if (data && data.access_token) {
          console.log("Access token successfully obtained");
          resolve({
            success: true,
            accessToken: data.access_token,
          });
        } else {
          console.error("Failed to get access token");
          resolve({
            success: false,
            error: "Failed to get access token",
          });
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        reject({
          success: false,
          error: error.message,
        });
      });
  });
}
