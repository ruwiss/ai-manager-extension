// Arka plan script'i başlatıldığında çalışacak kod
console.log("AI Manager Extension background script başlatıldı.");

// Content script'ten gelen mesajları dinle
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mesaj tipine göre işlem yap
  switch (message.action) {
    case "openInBrowser":
      console.log("Open In Browser message received:", message.data);

      // Type ve token değerlerini al
      const { dataType, dataToken, dataAddon } = message.data;
      console.log("Data Type:", dataType);
      console.log("Data Token:", dataToken ? "exists (length: " + dataToken.length + ")" : "null or empty");
      console.log("Data Addon:", dataAddon ? "exists" : "null or empty");

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
      } else if (dataType && dataType.toLowerCase() === "windsurf" && dataAddon) {
        console.log("Opening Windsurf account in browser");
        openWindsurfInBrowser(dataAddon, dataToken)
          .then((tab) => {
            console.log("Successfully opened Windsurf in browser, tab id:", tab.id);
          })
          .catch((error) => {
            console.error("Error opening Windsurf:", error);
          });
      } else {
        console.log(`No specific browser action for this account type or missing data. Type: ${dataType}, Token exists: ${!!dataToken}, Addon exists: ${!!dataAddon}`);
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

/**
 * Firebase verisini çözen yardımcı fonksiyon
 * @param {string} base64Data - Çözülecek Firebase verisi
 * @returns {Promise<object>} - Çözülmüş veri
 */
async function decodeFirebaseData(base64Data) {
  if (!base64Data) {
    throw new Error("Firebase data is empty");
  }

  // "FIREBASE_DATA:" önekini temizle
  if (base64Data.startsWith("FIREBASE_DATA:")) {
    base64Data = base64Data.substring("FIREBASE_DATA:".length);
  }

  try {
    // Base64'ten binary veriye çevir
    const binaryString = atob(base64Data);

    // Binary veriyi Uint8Array'e dönüştür
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Sıkıştırılmış veriyi çöz
    const decompressedStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const decompressedBlob = await new Response(decompressedStream).blob();
    const text = await decompressedBlob.text();

    // JSON'a dönüştür
    return JSON.parse(text);
  } catch (error) {
    console.error("Error decoding Firebase data:", error);
    throw error;
  }
}

/**
 * IndexedDB içinde firebaseLocalStorageDb veritabanını açar
 * @returns {Promise<IDBDatabase>} - Açılan veritabanı
 */
function openFirebaseLocalStorageDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("firebaseLocalStorageDb", 1);

    request.onerror = (event) => {
      console.error("Error opening IndexedDB:", event);
      reject(new Error("Failed to open Firebase IndexedDB"));
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Store yoksa oluştur
      if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
        db.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
  });
}

/**
 * Windsurf hesabını tarayıcıda açma fonksiyonu
 * @param {string} addonData - Windsurf için addon verisi
 * @param {string} refreshToken - İsteğe bağlı refresh token
 */
async function openWindsurfInBrowser(addonData, refreshToken = null) {
  try {
    // Firebase verisini çöz
    const userData = await decodeFirebaseData(addonData);
    console.log("Decoded windsurf user data:", userData);

    // IndexedDB ve localStorage için saklayacağımız veriyi oluştur
    const storageItem = {
      fbase_key: "firebase:authUser:AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY:[DEFAULT]",
      value: {
        uid: userData.uid || "wDvIdtliRZehyL75BRG54PEsIdX2",
        email: userData.email || "wasybewi273@mailtelig.site",
        emailVerified: userData.emailVerified || true,
        displayName: userData.displayName || "Hannah Harris",
        isAnonymous: userData.isAnonymous || false,
        providerData: userData.providerData || [
          {
            providerId: "password",
            uid: userData.email || "wasybewi273@mailtelig.site",
            displayName: userData.displayName || "Hannah Harris",
            email: userData.email || "wasybewi273@mailtelig.site",
            phoneNumber: null,
            photoURL: null,
          },
        ],
        stsTokenManager: {
          refreshToken:
            refreshToken ||
            userData.stsTokenManager?.refreshToken ||
            "AMf-vBxCrOYkmzllt2vEmfurGR-5KrLroDj5VREZKTbO_1X7MQLfQhNDaYUZP_i43PK2mVEN-FbcHJ2eM_uQErwETbqY-kEJEOoRNSXpZSFIvRMGo3DuXRImZT55qJBbwsojPEsqmi2S7frAT3Yq4qYNn9vigX4bvJjME8WS7uCv4u9zaGKfEfiOqGmV1SEUJ-oso7DKGw31ViZNdF795EhXpnncGJskFK2s7Jzpd9xXqb8jQ8IdeY8",
          accessToken:
            userData.stsTokenManager?.accessToken ||
            "eyJhbGciOiJSUzI1NiIsImtpZCI6IjNmOWEwNTBkYzRhZTgyOGMyODcxYzMyNTYzYzk5ZDUwMjc3ODRiZTUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiSGFubmFoIEhhcnJpcyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9leGEyLWZiMTcwIiwiYXVkIjoiZXhhMi1mYjE3MCIsImF1dGhfdGltZSI6MTc0NjM3NzAyOSwidXNlcl9pZCI6IndEdklkdGxpUlplaHlMNzVCUkc1NFBFc0lkWDIiLCJzdWIiOiJ3RHZJZHRsaVJaZWh5TDc1QlJHNTRQRXNJZFgyIiwiaWF0IjoxNzQ2Mzc3MDI5LCJleHAiOjE3NDYzODA2MjksImVtYWlsIjoid2FzeWJld2kyNzNAbWFpbHRlbGlnLnNpdGUiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJ3YXN5YmV3aTI3M0BtYWlsdGVsaWcuc2l0ZSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.EzYnrGy7EoP_IVTQhdmTcXpQ4kgiMuuU-DYFzEEzTHCx5mjXeIwek0LFDQeAF9w1iQp3fdlnfpxCll0QzElyaPhKWba_dRnSoZEj-GjHCHZtRaEpnP3HLsQHkykF0jNNUc3W6D5YYgMhw5PoHKYISAVjBDVquRQ7CW44UDMMwdfEaQ9bhtMG0C7BBiVCZ0Jal15og1t9W7nfdfhZQbrV2yPVcmvZ7DFbo0L9ygBr7kn9IAR_bXHDwyzir4zLU4rXnT86puB5WWhqM79KLIPrWptk2DP9WJ9hE48yw2-wzLFBPc4elkxc3L5I2oU_hA4tKd4wYA4HuzvjulSB55-cJQ",
          expirationTime: userData.stsTokenManager?.expirationTime || 1746380627810,
        },
        createdAt: userData.createdAt || "1745966697534",
        lastLoginAt: userData.lastLoginAt || "1746377029755",
        apiKey: userData.apiKey || "AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY",
        appName: userData.appName || "[DEFAULT]",
      },
    };

    // Web sayfasında script çalıştırma fonksiyonu
    const injectScriptAndOpen = async (tab) => {
      try {
        // Sekmeye veri enjekte et
        const key = "firebase:authUser:AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY:[DEFAULT]";
        const valueStr = JSON.stringify(storageItem.value);

        // Execute script in the tab
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (key, valueStr) => {
            // localStorage'a kaydet
            localStorage.setItem(key, valueStr);

            // sessionStorage'a da kaydetmeyi deneyelim
            sessionStorage.setItem(key, valueStr);

            // Kullanılabilecek diğer key formatlarını da deneyelim
            localStorage.setItem("firebase:authUser:AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY", valueStr);
            sessionStorage.setItem("firebase:authUser:AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY", valueStr);

            console.log("Firebase auth data set in localStorage and sessionStorage");
            console.log("Data:", JSON.parse(valueStr));

            // IndexedDB veri eklemesi, doğrudan web sayfasında çalışacak
            const openRequest = indexedDB.open("firebaseLocalStorageDb", 1);

            openRequest.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
                db.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
              }
            };

            openRequest.onsuccess = (event) => {
              const db = event.target.result;
              const transaction = db.transaction(["firebaseLocalStorage"], "readwrite");
              const store = transaction.objectStore("firebaseLocalStorage");

              // Veriyi temizle ve yeniden ekle
              store.clear().onsuccess = () => {
                store.add({
                  fbase_key: key,
                  value: JSON.parse(valueStr),
                }).onsuccess = () => {
                  console.log("Data saved to IndexedDB successfully");
                };
              };
            };

            openRequest.onerror = (event) => {
              console.error("Error opening IndexedDB:", event);
            };
          },
          args: [key, valueStr],
        });

        console.log("Auth data injection script executed");

        // 1 saniye bekleyip sayfayı yenile
        setTimeout(() => {
          chrome.tabs.reload(tab.id);
        }, 1000);

        return tab;
      } catch (error) {
        console.error("Error injecting script:", error);
        throw error;
      }
    };

    // Önce sekmeyi aç, sonra script enjekte et
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url: "https://windsurf.com/subscription/usage" }, async (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Error opening tab:", chrome.runtime.lastError);
          reject(new Error(`Failed to open tab: ${chrome.runtime.lastError.message}`));
          return;
        }

        console.log("Opened Windsurf tab, waiting for page load to inject scripts");

        // Sayfanın yüklenmesini bekle
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);

            console.log("Tab loaded, injecting scripts");
            injectScriptAndOpen(tab).then(resolve).catch(reject);
          }
        });
      });
    });
  } catch (error) {
    console.error("Error in openWindsurfInBrowser:", error);
    throw error;
  }
}
