// background.js - Logic for Context Menus and Side Panel handling

// --- KONFIGURACJA MENU ---
// Definiujemy strukturę menu wraz z naszymi niestandardowymi polami (promptTemplate)
const MENU_ITEMS = [
  { id: "gemini-root", title: "Gemini Pro Panel", contexts: ["all"] },
  { id: "separator-1", type: "separator", parentId: "gemini-root", contexts: ["all"] },
  // Akcje tekstowe
  { 
    id: "explain", 
    title: "🧐 Wyjaśnij to", 
    parentId: "gemini-root", 
    contexts: ["selection"],
    promptTemplate: "Wytłumacz mi to zagadnienie w prostych słowach:\n\n---\n{text}" 
  },
  { 
    id: "summarize", 
    title: "📝 Streść", 
    parentId: "gemini-root", 
    contexts: ["selection"],
    promptTemplate: "Streść poniższy tekst, wyciągając najważniejsze informacje:\n\n---\n{text}" 
  },
  { 
    id: "translate", 
    title: "🌍 Tłumacz na Polski", 
    parentId: "gemini-root", 
    contexts: ["selection"],
    promptTemplate: "Przetłumacz poniższy tekst na język polski, zachowując kontekst:\n\n---\n{text}" 
  },
  { 
    id: "code_check", 
    title: "💻 Sprawdź kod", 
    parentId: "gemini-root", 
    contexts: ["selection"],
    promptTemplate: "Przeanalizuj ten kod. Znajdź błędy, potencjalne problemy i zaproponuj poprawki:\n\n---\n{text}" 
  },
  { 
    id: "rewrite", 
    title: "✍️ Przeredaguj", 
    parentId: "gemini-root", 
    contexts: ["selection"],
    promptTemplate: "Przeredaguj poniższy tekst, aby brzmiał bardziej profesjonalnie i zwięźle:\n\n---\n{text}" 
  },
  { id: "separator-2", type: "separator", parentId: "gemini-root", contexts: ["all"] },
  // Akcja ogólna
  { id: "open-panel", title: "➡️ Otwórz Panel", parentId: "gemini-root", contexts: ["all"] }
];

// --- INSTALACJA ---
chrome.runtime.onInstalled.addListener(() => {
  // Ustawienie zachowania panelu
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Reset i budowa menu
  chrome.contextMenus.removeAll(() => {
    MENU_ITEMS.forEach(item => {
      // FIX: Oddzielamy 'promptTemplate' od reszty właściwości.
      // Chrome rzuca błąd, jeśli przekażemy mu nieznaną właściwość.
      const { promptTemplate, ...createProps } = item;
      chrome.contextMenus.create(createProps);
    });
  });
});

// --- OBSŁUGA KLIKNIĘĆ (Główna Logika) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // 1. Otwórz panel NATYCHMIAST (User Gesture)
  if (tab && tab.windowId) {
      // Ignorujemy błędy otwarcia (np. jeśli panel już jest otwarty w innym kontekście)
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }

  // 2. Znajdź definicję klikniętego elementu w naszej tablicy
  const selectedItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (!selectedItem) return;

  // Jeśli to tylko przycisk otwierania panelu lub root, kończymy
  if (info.menuItemId === "open-panel" || info.menuItemId === "gemini-root") return;

  // 3. Przetwarzanie promptu (jeśli zdefiniowany)
  if (info.selectionText && selectedItem.promptTemplate) {
      const finalPrompt = selectedItem.promptTemplate.replace("{text}", info.selectionText);

      // A. Zapisz do "Skrzynki Pocztowej" (dla zimnego startu panelu)
      const pendingAction = {
          type: 'gemini-context-action',
          text: finalPrompt,
          autoSubmit: true, 
          timestamp: Date.now()
      };
      await chrome.storage.local.set({ 'pending_gemini_action': pendingAction });

      // B. Próba wysłania bezpośredniej wiadomości (dla już otwartego panelu)
      // Małe opóźnienie daje czas na inicjalizację, jeśli panel właśnie wstaje
      setTimeout(() => {
          chrome.runtime.sendMessage({
              action: "gemini-context-prompt",
              text: finalPrompt
          }).catch(() => {
              // Błąd tutaj jest oczekiwany, jeśli panel się dopiero ładuje.
              // Obsłuży to mechanizm checkPendingActions() w sidepanel.js.
          });
      }, 500);
  }
});

// --- PROXY DLA AI HELPER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ask-ai-helper') {
    handleAiHelperRequest(request, sendResponse);
    return true; // Async response
  }
});

// Funkcja pomocnicza AI Helper (ZMIENIONA NA PĘTLĘ RETRY)
async function handleAiHelperRequest(request, sendResponse) {
    const { prompt, apiKey, model, systemPrompt, fallbacks } = request;

    if (!apiKey) {
        sendResponse({ error: "Brak skonfigurowanego klucza API OpenRouter." });
        return;
    }

    const finalSystemPrompt = systemPrompt || "Jesteś profesjonalnym asystentem AI.";

    // 1. Budowanie kolejki modeli (Priorytet + Fallbacki)
    // Używamy Set, aby usunąć duplikaty (jeśli wybrany model jest też w fallbackach)
    let modelQueue = [model];
    if (fallbacks && Array.isArray(fallbacks)) {
        modelQueue = [...new Set([model, ...fallbacks])];
    }
    
    // Usuń ewentualne wartości "auto" lub puste z kolejki, jeśli się tam dostały
    modelQueue = modelQueue.filter(m => m && m !== 'auto');

    // Jeśli kolejka pusta, użyj auto-routera OpenRouter
    if (modelQueue.length === 0) modelQueue.push("openrouter/free");

    console.log("[Background] Rozpoczynam próbę z kolejką modeli:", modelQueue);

    // 2. Pętla Retry
    let lastError = null;
    for (const currentModel of modelQueue) {
        try {
            console.log(`[Background] Próba modelu: ${currentModel}...`);
            const messages = [
                { role: "system", content: finalSystemPrompt },
                { role: "user", content: prompt }
            ];

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/GeminiProPanel", 
                    "X-Title": "Gemini Pro Panel"
                },
                body: JSON.stringify({
                    model: currentModel, 
                    messages: messages,
                    // Opcjonalnie: mniejsza temperatura dla większej determinacji przy auto-zadaniach
                    temperature: 0.3 
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();

            // Sprawdzenie czy jest treść (czasem API zwraca 200 ale puste choices przy błędach modelu)
            if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
                 throw new Error("Pusta odpowiedź od modelu (brak choices).");
            }

            const reply = data.choices[0].message.content || "";
            
            // SUKCES!
            // Zwracamy wynik i kończymy funkcję.
            console.log(`[Background] Sukces z modelem: ${currentModel}`);
            sendResponse({ result: reply, usedModel: currentModel });
            return;
        } catch (error) {
            console.warn(`[Background] Błąd modelu ${currentModel}:`, error.message);
            lastError = error.message;
            // Kontynuujemy pętlę do następnego modelu...
        }
    }

    // 3. Jeśli dotarliśmy tutaj, wszystkie modele zawiodły
    console.error("[Background] Wszystkie modele z puli zawiodły.");
    sendResponse({ error: `Wszystkie modele zawiodły. Ostatni błąd: ${lastError}` });
}