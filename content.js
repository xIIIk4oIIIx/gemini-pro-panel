// content.js - "Ghost Writer" Logic (Text + Image Support)
// Ten skrypt działa BEZPOŚREDNIO wewnątrz strony gemini.google.com

console.log("[Gemini Panel] Ghost Writer: Załadowano skrypt wstrzykiwania (v2).");

// --- HELPER: Znajdowanie pola input ---
function findInputField() {
  const selectors = [
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea[aria-label*="prompt"]', 
    'rich-textarea > div',
    'textarea'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// --- NOWY HELPER: Pobieranie tekstu z inputu ---
function getTextInput(inputField) {
    if (!inputField) return "";

    // Preferuj innerText dla div[contenteditable] (Gemini)
    if (inputField.matches('div[contenteditable="true"]')) {
        return inputField.innerText;
    } 
    // Użyj value dla textarea
    else if (inputField.matches('textarea')) {
        return inputField.value;
    }
    // Fallback dla innych przypadków
    return inputField.textContent;
}


window.addEventListener("message", (event) => {
  // 1. Weryfikacja bezpieczeństwa
  if (!event.origin.startsWith("chrome-extension://")) return;

  // 2. Obsługa akcji
  if (event.data) {
    if (event.data.action === "inject_text") {
      console.log("[Gemini Panel] Otrzymano tekst.");
      injectTextToGemini(event.data.text, event.data.autoSubmit);
    } 
    else if (event.data.action === "inject_image") {
      console.log("[Gemini Panel] Otrzymano obraz.");
      injectImageToGemini(event.data.imageData, event.data.autoSubmit);
    }
    // AKCJA 3: Zwracanie bieżącego URL
    else if (event.data.action === "get_current_url") {
        console.log("[Gemini Panel] Otrzymano żądanie URL.");
        // Wysyłamy wiadomość zwrotną do sidepanel.js (window.parent)
        window.parent.postMessage({ 
            action: "return_current_url", 
            url: window.location.href 
        }, "*"); // TargetOrigin: "*"
    }
    // AKCJA 4: Zwracanie bieżącego tekstu z inputu (dla Prompt Architect)
    else if (event.data.action === "get_input_text") {
        console.log("[Gemini Panel] Otrzymano żądanie tekstu inputu.");
        const inputField = findInputField();
        const text = getTextInput(inputField);
        
        window.parent.postMessage({ 
            action: "return_input_text", 
            text: text 
        }, "*");
        // TargetOrigin: "*"
    }
  }
});

// --- LOGIKA TEKSTU ---
function injectTextToGemini(text, autoSubmit) {
  try {
    const inputField = findInputField();
    if (!inputField) return console.error("Błąd: Brak pola input.");

    inputField.focus();

    // Próba 1: execCommand
    const execSuccess = document.execCommand('insertText', false, text);

    // Próba 2: DOM Fallback
    if (!execSuccess) {
      inputField.innerText = text;
      const events = [
        new Event('input', { bubbles: true }),
        new KeyboardEvent('keydown', { key: 'Space', bubbles: true }),
        new KeyboardEvent('keyup', { key: 'Space', bubbles: true })
      ];
      events.forEach(ev => inputField.dispatchEvent(ev));
    }
    
    if (autoSubmit) handleAutoSubmit(600);
  } catch (err) {
    console.error("Błąd injectText:", err);
  }
}

// --- LOGIKA OBRAZU (NOWOŚĆ) ---
async function injectImageToGemini(base64Data, autoSubmit) {
  try {
    const inputField = findInputField();
    if (!inputField) return console.error("Błąd: Brak pola input dla obrazu.");

    inputField.focus();

    // 1. Konwersja Base64 -> Blob -> File
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const file = new File([blob], "screenshot.png", { type: "image/png" });

    // 2. Tworzenie DataTransfer (Symulacja schowka)
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    // 3. Dispatch zdarzenia 'paste'
    // To jest kluczowe - Gemini nasłuchuje zdarzenia 'paste' dla plików
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    inputField.dispatchEvent(pasteEvent);
    console.log("[Gemini Panel] Wysłano zdarzenie paste z obrazkiem.");
    
    // Auto-Submit dla obrazków musi czekać dłużej (upload trwa)
    if (autoSubmit) handleAutoSubmit(2000);
  } catch (err) {
    console.error("Błąd injectImage:", err);
  }
}

// --- HELPER: Auto Submit ---
function handleAutoSubmit(delay) {
  setTimeout(() => {
    const sendBtnSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="Wyślij"]',
        'button.send-button',
        'button[data-testid="send-button"]',
        'button[type="submit"]'
    ];

    let sendButton = null;
    for (const sel of sendBtnSelectors) {
         const btn = document.querySelector(sel);
         if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
             sendButton = btn;
             break;
         }
    }

    if (sendButton) {
      sendButton.click();
      console.log("[Gemini Panel] Auto-Submit wykonany.");
    }
  }, delay);
}

// --- LISTENERY GLOBALNE ---
// Wykrywanie kliknięcia w treść strony, aby zamknąć menu w panelu bocznym
document.addEventListener('click', () => {
    // Wysyłamy sygnał do rodzica (sidepanel), że nastąpiło kliknięcie
    window.parent.postMessage({ action: "close_sidepanel_menus" }, "*");
});