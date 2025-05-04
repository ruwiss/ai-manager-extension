// Arka plan script'i başlatıldığında çalışacak kod
console.log("AI Manager Extension background script başlatıldı.");

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mesaj tipine göre işlem yap
  switch (message.action) {
    case "openInBrowser":
      console.log("Open In Browser message received:", message.data);

      // Type ve token değerlerini al
      const { dataType, dataToken } = message.data;
      console.log("Data Type:", dataType);
      console.log("Data Token:", dataToken ? "exists (length: " + dataToken.length + ")" : "null or empty");

      // Hemen yanıt verelim ki port kapanmasın
      sendResponse({ processing: true });

      // Type değerine göre farklı işlemler yap
      if (dataType && dataType.toLowerCase() === "cursor" && dataToken) {
        console.log("Opening Cursor account in browser");
        openCursorInBrowser(dataToken)
          .then((tab) => {
            console.log("Successfully opened Cursor in browser, tab id:", tab.id);
            // Burada ek işlemler yapılabilir
          })
          .catch((error) => {
            console.error("Error opening Cursor:", error);
          });
      } else {
        console.log(`No specific browser action for this account type or missing token. Type: ${dataType}, Token exists: ${!!dataToken}`);
      }
      break;
    case "fetchCursorUsage":
      console.log("Cursor usage information request received");
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
  return true;
});

/**
 * Cursor hesabını tarayıcıda açan fonksiyon
 * @param {string} token - Cursor token
 */
function openCursorInBrowser(token) {
  if (!token) {
    throw new Error("Token is required to open Cursor in browser");
  }

  return new Promise((resolve, reject) => {
    // Önce cookie'yi ayarla
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
        console.log("Cursor cookie set:", cookie);

        if (chrome.runtime.lastError) {
          console.error("Cookie setting error:", chrome.runtime.lastError);
          reject(new Error(`Failed to set cookie: ${chrome.runtime.lastError.message}`));
          return;
        }

        // Cookie başarıyla ayarlandıysa, yeni sekme aç
        if (cookie) {
          chrome.tabs.create({ url: "https://www.cursor.com/settings" }, function (tab) {
            if (chrome.runtime.lastError) {
              console.error("Error opening tab:", chrome.runtime.lastError);
              reject(new Error(`Failed to open tab: ${chrome.runtime.lastError.message}`));
              return;
            }

            console.log("Opened Cursor settings page in new tab:", tab.id);
            resolve(tab);
          });
        } else {
          console.error("Failed to set Cursor cookie");
          reject(new Error("Failed to set Cursor cookie"));
        }
      }
    );
  });
}

/**
 * Cursor API'sinden kullanım bilgilerini çeken fonksiyon
 * @param {Object} data - İstek verileri
 * @returns {Promise<Object>} - İşlem sonucunu içeren Promise
 */
function fetchCursorUsage(data) {
  return new Promise((resolve, reject) => {
    const { userId, token } = data;

    console.log("Cursor usage information retrieval...");
    console.log("User ID:", userId);
    console.log("Token value:", token);

    // Önce cookie'yi ayarlayalım
    console.log("Cookie setting...");
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
          console.log("Cookie set:", cookie);

          // Şimdi isteği yapalım
          console.log("Fetch request...");
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
              console.log("Fetch status code:", response.status);
              console.log("Fetch response headers:", [...response.headers.entries()]);

              if (response.ok) {
                return response.json();
              } else {
                throw new Error(`API request failed. Status code: ${response.status}`);
              }
            })
            .then((data) => {
              console.log("Cursor API response:", data);

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

                  console.log("Usage information:", usageText);
                  resolve({ success: true, usageText });
                } else {
                  console.error("Usage information not found");
                  resolve({ success: false, error: "Usage information not found" });
                }
              } catch (error) {
                console.error("Error processing response:", error);
                reject({ success: false, error: error.message });
              }
            })
            .catch((error) => {
              console.error("Fetch error:", error);
              console.error("Full error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
              reject({ success: false, error: error.message });
            });
        }
      );
    } catch (error) {
      console.error("Error setting cookie:", error);
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
