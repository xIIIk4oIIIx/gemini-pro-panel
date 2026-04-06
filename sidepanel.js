// sidepanel.js - Zawiera zmodyfikowane funkcje handleContext i fragment listenera

import * as Config from './modules/Config.js';
import * as StorageService from './modules/StorageService.js';
import * as UIManager from './modules/UIManager.js';
import * as GeminiBridge from './modules/GeminiBridge.js';
import * as CaptureService from './modules/CaptureService.js';
import * as TabService from './modules/TabService.js';
// Import nowych modułów (Features)
import * as ClusterManager from './modules/features/TabClusterManager.js';
import * as ArchitectManager from './modules/features/PromptArchitectManager.js';
import * as NotebookManager from './modules/features/NotebookManager.js';
import * as TemplateManager from './modules/features/TemplateManager.js';
import * as GemManager from './modules/features/GemManager.js';

// --- MAPA DOSTAWCÓW ---
const PROVIDER_URLS = {
    'gemini': 'https://gemini.google.com/',
    'duck': 'https://duck.ai/'
};

// --- STAN LOKALNY (Zredukowany) ---

// --- KONFIGURACJA MENU KONTEKSTOWEGO (Right Click) ---
const CONTEXT_MENU_CONFIG = {
    'btn-settings': [
      { id: 'toggle_autosubmit', label: 'Auto-Submit (Włącz/Wyłącz)', type: 'toggle' }
    ],
    'btn-detach': [
      { id: 'open_popup', label: 'Otwórz w Oknie (Domyślne)' },
      { id: 'open_tab', label: 'Otwórz w Nowej Karcie' }
    ],
    'btn-gems': 'gems',
    'btn-notebook': [
      { id: 'new_note', label: '📝 Nowa notatka' },
      { id: 'search_note', label: '🔍 Szukaj notatki' }
    ],
    'btn-architect': [
        { id: 'improve_clipboard', label: '📋 Ulepsz ze schowka' },
        { id: 'improve_draft', label: '💬 Ulepsz bieżący Draft' }
    ],
    'btn-cluster': [
        { id: 'cluster_all_quick', label: '⚡ Analizuj WSZYSTKIE (Quick)' },
        { id: 'cluster_open_current', label: '📌 Analizuj aktywną kartę' }
    ],
    'btn-zen-mode': [
        { id: 'lock_topbar', label: '🔒 Przypnij górny pasek' }
    ],
    // Specjalny klucz dla istniejącego menu szablonów
    'btn-context': 'templates' 
};

// --- GLUE CODE (LOGIKA APLIKACJI) ---

// ------------------------------------
// HANDLERY AKCJI (Delegacja do modułów)
// ------------------------------------

// 1. ZWYKŁY ZRZUT EKRANU (Całość)
async function handleScreenshot() {
    const btnId = 'btn-screenshot';
    const btn = document.getElementById(btnId);
    const icon = btn.querySelector('i');
    const originalIconClass = 'fas fa-camera'; 
    
    icon.className = 'fas fa-circle-notch fa-spin';
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || TabService.isRestrictedUrl(tab.url)) {
            UIManager.showToast("Nie można zrobić zrzutu na tej stronie.", true);
            icon.className = originalIconClass; 
            return;
        }
        
        const dataUrl = await CaptureService.captureVisibleTab();
        CaptureService.playShutterEffect(tab.id).catch(err => console.warn(err));

        let clipboardSuccess = false;
        try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            clipboardSuccess = true;
        } catch (clipboardErr) {
            console.warn("Clipboard warning:", clipboardErr);
        }
        
        const settings = await StorageService.getSettings();
        const sent = GeminiBridge.sendToGeminiIframeImage(dataUrl, settings.autoSubmit);

        icon.className = originalIconClass;

        if (sent) {
            const msg = settings.autoSubmit ?
            "Wysłano zrzut do Gemini!" : "Wklejono zrzut do Gemini!";
            UIManager.showToast(msg);
            UIManager.showButtonFeedback(btnId, true);
        } else if (clipboardSuccess) {
            UIManager.showToast("Zrzut ekranu w schowku.");
            UIManager.showButtonFeedback(btnId, true);
        } else {
             UIManager.showToast("Problem ze schowkiem, sprawdź czat.", true);
        }

    } catch (err) {
        console.error("Screenshot error:", err);
        UIManager.showToast("Błąd zrzutu ekranu.", true);
        
        icon.className = originalIconClass;
        UIManager.showButtonFeedback(btnId, false);
    }
}

// 2. WYCINEK EKRANU (Crop Tool)
async function handleCrop() {
    const btnId = 'btn-crop';
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || TabService.isRestrictedUrl(tab.url)) {
            UIManager.showToast("Nie można zrobić zrzutu na tej stronie.", true);
            return;
        }

        // A. Wybór obszaru
        const injectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: CaptureService.injectCropTool
        });
        const cropArea = injectionResults[0].result;
        if (!cropArea) return; // Anulowano

        // B. Przetwarzanie - START SPINNERA
        const btn = document.getElementById(btnId);
        const icon = btn.querySelector('i');
        const originalIconClass = 'fas fa-crop-simple';
        icon.className = 'fas fa-circle-notch fa-spin';
        // C. Capture & Crop
        const fullScreenshotDataUrl = await CaptureService.captureVisibleTab();
        
        CaptureService.playShutterEffect(tab.id).catch(err => console.warn(err));
        const croppedBlob = await CaptureService.cropImage(fullScreenshotDataUrl, cropArea);
        
        // Backup: Schowek
        let clipboardSuccess = false;
        try {
            await navigator.clipboard.write([
               new ClipboardItem({ 'image/png': croppedBlob })
            ]);
            clipboardSuccess = true;
        } catch (clipboardErr) {
            console.warn("Clipboard warning:", clipboardErr);
        }
        
        // D. Ghost Writer
        const base64Data = await CaptureService.blobToBase64(croppedBlob);
        const settings = await StorageService.getSettings();
        const sent = GeminiBridge.sendToGeminiIframeImage(base64Data, settings.autoSubmit);

        icon.className = originalIconClass;
        if (sent) {
            const msg = settings.autoSubmit ?
            "Wysłano wycinek do Gemini!" : "Wklejono wycinek do Gemini!";
            UIManager.showToast(msg);
            UIManager.showButtonFeedback(btnId, true);
        } else if (clipboardSuccess) {
            UIManager.showToast("Wycinek w schowku.");
            UIManager.showButtonFeedback(btnId, true);
        } else {
             UIManager.showToast("Problem ze schowkiem, sprawdź czat.", true);
        }

    } catch (err) {
        console.error("Crop error:", err);
        UIManager.showToast("Błąd wycinania ekranu.", true);
        
        const btn = document.getElementById(btnId);
        if(btn) {
            btn.querySelector('i').className = 'fas fa-crop-simple';
            UIManager.showButtonFeedback(btnId, false);
        }
    }
}


// 3. CONTEXT - Zbieranie danych + GHOST WRITER (Text)
async function handleContext(overrideTemplateId = null) {
    const btnId = 'btn-context';
    try {
        const contextData = await TabService.getPageContext();
        if (contextData && contextData.error) {
            UIManager.showToast(contextData.error, true);
            UIManager.showButtonFeedback(btnId, false);
            return;
        }

        if (!contextData) throw new Error("Nie udało się pobrać danych kontekstowych.");
        const finalPrompt = TemplateManager.getFinalPrompt(contextData, overrideTemplateId);
        
        let templateName;
        if (overrideTemplateId) {
            const templates = TemplateManager.getTemplates();
            const t = templates.find(t => t.id === overrideTemplateId);
            templateName = t ? t.name : 'Nieznany';
        } else {
            templateName = TemplateManager.getSelectedTemplateName();
        }

        // --- GHOST WRITER ---
        const settings = await StorageService.getSettings();
        const sentToGhost = GeminiBridge.sendToGeminiIframe(finalPrompt, settings.autoSubmit);

        // Backup: Kopiujemy do schowka
        let clipboardSuccess = false;
        try {
            await navigator.clipboard.writeText(finalPrompt);
            clipboardSuccess = true;
        } catch (clipErr) {
            console.warn("Błąd schowka (niekrytyczny):", clipErr);
        }
        
        const sourceInfo = contextData.isSelection ?
        'ZAZNACZENIE' : 'STRONĘ';
        
        if (sentToGhost) {
            const actionMsg = settings.autoSubmit ?
            "Wysłano do Gemini!" : "Wpisano do Gemini!";
            UIManager.showToast(`${actionMsg} (Tryb: ${templateName})`);
            UIManager.showButtonFeedback(btnId, true);
        } else if (clipboardSuccess) {
            UIManager.showToast(`Skopiowano ${sourceInfo} (Tryb: ${templateName})`);
            UIManager.showButtonFeedback(btnId, true);
        } else {
            throw new Error("Nie udało się ani wysłać do Gemini, ani skopiować do schowka.");
        }

    } catch (err) {
        console.error(err);
        UIManager.showToast("Błąd pobierania danych lub zapisu. Sprawdź konsolę.", true);
        UIManager.showButtonFeedback(btnId, false);
    }
}


// NOWA FUNKCJA: Przełączanie Trybu Zen
function toggleZenMode() {
    const body = document.body;
    const btn = document.getElementById('btn-zen-mode');
    if (!body || !btn) return;
    
    body.classList.toggle('zen-mode');
    const isZenMode = body.classList.contains('zen-mode');

    const icon = btn.querySelector('i');
    if (isZenMode) {
        icon.className = 'fas fa-chevron-right';
        btn.title = "Tryb Zen (Pokaż pasek)";
    } else {
        icon.className = 'fas fa-chevron-left';
        btn.title = "Tryb Zen (Ukryj pasek)";
        const topbar = document.querySelector('.content-top-bar');
        if (topbar.classList.contains('locked')) {
            topbar.classList.remove('locked');
            localStorage.setItem('zenTopbarLocked', 'false');
        }
    }

    localStorage.setItem('zenModeActive', isZenMode);
}

// NOWA FUNKCJA: Przełączanie przypięcia górnego paska
function toggleTopbarLock() {
    const topbar = document.querySelector('.content-top-bar');
    if (!topbar) return;
    const isLocked = topbar.classList.toggle('locked');
    localStorage.setItem('zenTopbarLocked', isLocked);
    UIManager.showToast(`Górny pasek: ${isLocked ? 'Przypięty' : 'Odpięty'}`);
}

// ------------------------------------
// INICJALIZACJA I LISTENERY
// ------------------------------------

async function checkPendingActions() {
    try {
        const data = await chrome.storage.local.get('pending_gemini_action');
        const action = data.pending_gemini_action;

        if (action && (Date.now() - action.timestamp < 30000)) {
            GeminiBridge.sendToGeminiIframe(action.text, action.autoSubmit);
            await chrome.storage.local.remove('pending_gemini_action');
        }
    } catch (err) {
        console.error("Błąd odczytu pending actions:", err);
    }
}

function getDraftTextFromIframe() {
    const iframe = document.getElementById('gemini-frame');
    if (!iframe || !iframe.contentWindow) {
        return Promise.resolve("");
    }

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('message', messageListener);
            resolve(null);
        }, 500);

        const messageListener = (event) => {
            if (event.data && event.data.action === "return_input_text") {
              
                clearTimeout(timeout);
                window.removeEventListener('message', messageListener);
                resolve(event.data.text);
            }
        };
        window.addEventListener('message', messageListener);

        iframe.contentWindow.postMessage({ action: "get_input_text" }, "*");
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "gemini-context-prompt") {
        GeminiBridge.sendToGeminiIframe(request.text, true);
    }
});
window.addEventListener('message', (event) => {
    if (event.data && event.data.action === "close_sidepanel_menus") {
        UIManager.closeContextMenu();
    }
});
async function handleDetach() {
    const iframe = document.getElementById('gemini-frame');
    const defaultUrl = chrome.runtime.getURL("sidepanel.html"); 
    const btnId = 'btn-detach';
    const btn = document.getElementById(btnId);
    const icon = btn.querySelector('i');
    const originalIconClass = 'fas fa-external-link-alt'; 
    icon.className = 'fas fa-circle-notch fa-spin';
    try {
        if (!iframe || !iframe.contentWindow) {
             await chrome.windows.create({
                 url: defaultUrl,
                 type: "popup", width: 500, height: 850, focused: true
             });
             icon.className = originalIconClass;
             UIManager.showButtonFeedback(btnId, true);
             return;
        }

        const receivedUrl = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener('message', messageListener);
                resolve(null);
            }, 300);

            const messageListener = 
            (event) => {
                if (event.data && event.data.action === "return_current_url") {
                    clearTimeout(timeout);
                    window.removeEventListener('message', messageListener);
                    resolve(event.data.url);
               
                }
            };
            window.addEventListener('message', messageListener);
            iframe.contentWindow.postMessage({ action: "get_current_url" }, "*");
        });
        let newWindowUrl;
        
        if (receivedUrl && (receivedUrl.startsWith("https://gemini.google.com/") || receivedUrl.startsWith("https://duck.ai/"))) {
            newWindowUrl = defaultUrl + "?targetUrl=" + encodeURIComponent(receivedUrl);
        } else {
            newWindowUrl = defaultUrl;
            UIManager.showToast("Nie udało się pobrać aktywnego czatu. Otwieram stronę główną.", true);
        }

        await chrome.windows.create({
            url: newWindowUrl,
            type: "popup", width: 500, height: 850, focused: true
        });
        icon.className = originalIconClass;
        UIManager.showButtonFeedback(btnId, true);

    } catch (err) {
        console.error("Błąd otwierania okna lub komunikacji:", err);
        UIManager.showToast("Błąd otwierania okna.", true);
        icon.className = originalIconClass;
        UIManager.showButtonFeedback(btnId, false);
    }
}

function setupNotebookEditorListeners() {
    document.getElementById('btn-editor-back')?.addEventListener('click', NotebookManager.cancelEdit);
    document.getElementById('btn-editor-cancel')?.addEventListener('click', NotebookManager.cancelEdit);
    document.getElementById('btn-editor-save')?.addEventListener('click', NotebookManager.saveEditedNote);
    document.getElementById('btn-toggle-pin')?.addEventListener('click', NotebookManager.togglePin);
    UIManager.setupEditorTabs(NotebookManager.refreshEditorView);
}


// --- GŁÓWNA INICJALIZACJA ---
document.addEventListener('DOMContentLoaded', async () => {
    const iframe = document.getElementById('gemini-frame');
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get('targetUrl');

    // Pobierz stan dostawcy
    const provider = await StorageService.getProvider();
    const providerSelect = document.getElementById('setting-ai-provider');
    if (providerSelect) {
        providerSelect.value = provider;
        providerSelect.addEventListener('change', async () => {
            const newProvider = providerSelect.value;
            await StorageService.setProvider(newProvider);
            UIManager.showToast(`Zmieniono dostawcę AI na ${newProvider === 'gemini' ? 'Gemini' : 'Duck AI'}.`);
            if (iframe) {
                iframe.src = PROVIDER_URLS[newProvider];
            }
        });
    }

    if (iframe && targetUrl) {
        try {
            const decodedUrl = decodeURIComponent(targetUrl);
            iframe.src = decodedUrl;
        } catch (e) {
        
            console.error("Błąd dekodowania targetUrl:", e);
        }
    } else if (iframe) {
        iframe.src = PROVIDER_URLS[provider] || PROVIDER_URLS['gemini'];
    }
    
    await TemplateManager.initializeTemplatesAndUI();
    await NotebookManager.init();
    await GemManager.init();
    setupNotebookEditorListeners();

    const settings = await StorageService.getSettings();
    const apiKeyInput = document.getElementById('setting-api-key');
    const toggleKeyBtn = document.getElementById('btn-toggle-key');
    const modelSelect = document.getElementById('setting-model-select');
    const autoSubmitCheckbox = document.getElementById('setting-auto-submit');
    
    UIManager.populateModelSelect(modelSelect, Config.MODEL_GROUPS);
    apiKeyInput.value = settings.apiKey;
    modelSelect.value = settings.model;
    autoSubmitCheckbox.checked = settings.autoSubmit;
    apiKeyInput.addEventListener('change', async () => {
        await StorageService.saveSettings('apiKey', apiKeyInput.value.trim());
        UIManager.showToast('Zapisano klucz API.');
    });
    modelSelect.addEventListener('change', async () => {
        await StorageService.saveSettings('model', modelSelect.value);
        UIManager.showToast('Zapisano wybrany model.');
    });
    autoSubmitCheckbox.addEventListener('change', async () => {
        await StorageService.saveSettings('autoSubmit', autoSubmitCheckbox.checked);
        UIManager.showToast('Zapisano ustawienie Auto-Submit.');
    });
    toggleKeyBtn.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        const icon = toggleKeyBtn.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
    document.getElementById('btn-screenshot').addEventListener('click', handleScreenshot);
    document.getElementById('btn-crop').addEventListener('click', handleCrop);
    document.getElementById('btn-context').addEventListener('click', handleContext);
    document.getElementById('btn-detach').addEventListener('click', handleDetach);
    
    const zenModeBtn = document.getElementById('btn-zen-mode');
    if (zenModeBtn) {
        zenModeBtn.addEventListener('click', toggleZenMode);
        const isTopbarLocked = localStorage.getItem('zenTopbarLocked') === 'true';
        const topbar = document.querySelector('.content-top-bar');
        if (topbar && isTopbarLocked) {
             topbar.classList.add('locked');
        }
    }

    document.getElementById('btn-gems')?.addEventListener('click', () => {
        GemManager.renderGemsList();
        UIManager.toggleModal('gems-modal', true);
    });
    document.getElementById('btn-add-gem')?.addEventListener('click', () => {
        const name = document.getElementById('gem-name').value;
        const url = document.getElementById('gem-url').value;
        GemManager.addGem(name, url);
        document.getElementById('gem-name').value = '';
        document.getElementById('gem-url').value = '';
    });
    for (const btnId in CONTEXT_MENU_CONFIG) {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('contextmenu', async (e) => {
                e.preventDefault(); 
                
                const config = CONTEXT_MENU_CONFIG[btnId];
                let menuItems = [];

           
                if (config === 'templates') {
                    const templates = TemplateManager.getTemplates();
                    const currentId = TemplateManager.getSelectedTemplateId();
                    menuItems = templates.map(t => ({
                     
    label: t.name,
                        id: t.id,
                        isActive: (t.id === currentId)
                    }));
                } else if (config === 'gems') {
  
                    const gems = GemManager.getGems();
                    menuItems = gems.map(g => ({
                        label: g.name,
                        id: g.url // URL as ID 
                    }));
                } else {
                    const settings = await StorageService.getSettings();
                    const autoSubmitStatus = settings.autoSubmit;
                    const isTopbarLocked = localStorage.getItem('zenTopbarLocked') === 'true';
                    menuItems = config.map(item => {
                        let isActive = false;
                        if (item.type === 'toggle' && item.id === 'toggle_autosubmit') {
                            isActive = autoSubmitStatus;
       
                        }
                        if (item.id === 'lock_topbar') {
                            isActive = isTopbarLocked;
                        }
 
                        return { ...item, isActive: isActive };
                    });
                }


                UIManager.showContextMenu(e.clientX, e.clientY, menuItems, async (selectedId) => {
                    if (selectedId.startsWith('https://gemini.google.com/')) {
                         const gem = GemManager.getGems().find(g => g.url === selectedId);
                        
                        if (gem) GemManager.openGem(gem);
                         return;
                    }

                    switch (selectedId) {
                        case 'toggle_autosubmit':
     
                            const settings = await StorageService.getSettings();
                            const newValue = !settings.autoSubmit;
                            await StorageService.saveSettings('autoSubmit', newValue);
            
                            const checkbox = document.getElementById('setting-auto-submit');
                            if (checkbox) checkbox.checked = newValue;
                            UIManager.showToast(`Auto-Submit: ${newValue ? 'Włączony' : 'Wyłączony'}`);
                
                        break;
                        case 'open_tab':
                            const iframe = document.getElementById('gemini-frame');
                            const defaultUrl = chrome.runtime.getURL("sidepanel.html"); 
                            let newWindowUrl;
                            let targetUrl = null;
                            if (iframe && iframe.contentWindow) {
                                targetUrl = await new Promise((resolve) => {
                                    const timeout = setTimeout(() => { resolve(null); }, 300);
              
                                     const messageListener = (event) => {
                                        if (event.data && event.data.action === "return_current_url") {
                           
                                            clearTimeout(timeout);
                                            window.removeEventListener('message', messageListener);
                                      
                                            resolve(event.data.url);
                                        }
                                    };
                  
                                    window.addEventListener('message', messageListener);
                                    iframe.contentWindow.postMessage({ action: "get_current_url" }, "*");
                                });
                            }
                            if (targetUrl && (targetUrl.startsWith("https://gemini.google.com/") || targetUrl.startsWith("https://duck.ai/"))) {
                                newWindowUrl = defaultUrl + "?targetUrl=" + encodeURIComponent(targetUrl);
                            } else {
                                newWindowUrl = defaultUrl;
                            }
                            await chrome.tabs.create({ url: newWindowUrl });
                            UIManager.showToast("Otwarto w Nowej Karcie.");
                            break;

                        case 'open_popup':
                            await handleDetach();
                        break;
                            
                        case 'new_note':
                            await NotebookManager.prepareForModal();
                            UIManager.toggleModal('notebook-modal', true);
                            UIManager.toggleNotebookView('editor');
                            document.getElementById('edit-note-title').value = '';
                            document.getElementById('edit-note-content').value = '';
                            UIManager.showToast("Gotowy na nową notatkę.");
                            break;
                        case 'search_note':
                            await NotebookManager.prepareForModal();
                            UIManager.toggleModal('notebook-modal', true);
                            UIManager.toggleNotebookView('list'); 
                            setTimeout(() => {
                                const searchInput = document.getElementById('notebook-search');
                                if (searchInput) searchInput.focus();
                          
                            }, 100);
                            UIManager.showToast("Wyszukiwanie notatek...");
                            break;
                            
                        case 'improve_clipboard':
                            try {
                                const clipboardText = await navigator.clipboard.readText();
                                if (!clipboardText.trim()) {
                                    UIManager.showToast("Schowek jest pusty.", true);
                                    return;
                                }
                                UIManager.toggleModal('architect-modal', true);
                                ArchitectManager.fillAndImprove(clipboardText);
                            } catch (error) {
                                UIManager.showToast("Błąd dostępu do schowka.", true);
                            }
                            break;
                        case 'improve_draft':
                            const draftText = await getDraftTextFromIframe();
                            if (!draftText || !draftText.trim()) {
                                UIManager.showToast("Bieżący Draft w Gemini jest pusty.", true);
                                return;
                            }
                            UIManager.toggleModal('architect-modal', true);
                            ArchitectManager.fillAndImprove(draftText);
                            break;
                            
                        case 'cluster_all_quick':
                            await ClusterManager.initCluster();
                            setTimeout(async () => {
                                const targetTabsCount = ClusterManager.clusterAvailableTabs.length;
                                if (targetTabsCount === 0) {
                          
                                    UIManager.showToast("Brak dostępnych kart do analizy.", true);
                                    return;
                                }
                 
                                await ClusterManager.handleClusterAnalysis({ silent: true, analyzeAll: true });
                            }, 50);
                        break;

                        case 'cluster_open_current':
                            await ClusterManager.initCluster();
                            const [currentTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                            if (!currentTab) return;
                            const tabIndex = ClusterManager.clusterAvailableTabs.findIndex(tab => tab.id === currentTab.id);
                            if (tabIndex === -1) {
                                UIManager.showToast("Aktywna karta jest chroniona.", true);
                                return;
                            }
                            UIManager.toggleModal('cluster-modal', true);
                            ClusterManager.setClusterInput((tabIndex + 1).toString());
                            break;

                        case 'lock_topbar':
                            toggleTopbarLock();
                        break;


                        default:
                            if (btnId === 'btn-context') {
                                handleContext(selectedId);
                            }
                            break;
                    }
                });
            });
        }
    }

    document.getElementById('btn-settings').addEventListener('click', () => UIManager.toggleModal('settings-modal', true));
    document.getElementById('btn-add-template').addEventListener('click', TemplateManager.handleSaveTemplate);
    document.getElementById('btn-cancel-edit').addEventListener('click', TemplateManager.cancelEdit);
    document.getElementById('btn-reset-defaults').addEventListener('click', TemplateManager.resetDefaults);
    document.getElementById('btn-improve-prompt').addEventListener('click', () => ArchitectManager.handleImprovePrompt(false));

    document.getElementById('btn-notebook').addEventListener('click', () => { NotebookManager.prepareForModal(); UIManager.toggleModal('notebook-modal', true); });
    document.getElementById('btn-save-note').addEventListener('click', NotebookManager.handleSaveNote);
    document.getElementById('btn-paste-note').addEventListener('click', NotebookManager.handlePasteNote);
    document.getElementById('notebook-search')?.addEventListener('input', NotebookManager.handleSearch);
    document.getElementById('btn-architect').addEventListener('click', () => UIManager.toggleModal('architect-modal', true));
    document.getElementById('btn-architect-improve').addEventListener('click', () => ArchitectManager.handleImprovePrompt(true));
    document.getElementById('btn-architect-send').addEventListener('click', ArchitectManager.handleArchitectSend);
    
    document.getElementById('btn-cluster').addEventListener('click', () => { ClusterManager.initCluster(); UIManager.toggleModal('cluster-modal', true); });
    document.getElementById('btn-start-cluster').addEventListener('click', () => ClusterManager.handleClusterAnalysis({ silent: false }));
    
    const clusterInput = document.getElementById('cluster-input');
    const clusterPrompt = document.getElementById('cluster-custom-prompt');
    if (clusterInput) {
        const updateStatsWrapper = () => ClusterManager.updateClusterStats([]);
        clusterInput.addEventListener('input', updateStatsWrapper);
        clusterPrompt.addEventListener('input', updateStatsWrapper);
    }
    
    document.getElementById('btn-refresh').addEventListener('click', () => {
        const frame = document.getElementById('gemini-frame');
        frame.src = frame.src; 
        const btn = document.getElementById('btn-refresh');
        btn.style.transform = "rotate(360deg)";
        setTimeout(() => { btn.style.transform = ""; }, 500);
    });
    const modals = ['settings-modal', 'notebook-modal', 'architect-modal', 'cluster-modal', 'gems-modal'];
    modals.forEach(id => {
        document.getElementById(`btn-close-${id.replace('-modal', '')}`)?.addEventListener('click', () => UIManager.toggleModal(id, false));
        document.getElementById(id)?.addEventListener('click', (e) => { 
            if (e.target === document.getElementById(id)) UIManager.toggleModal(id, false); 
        });
    });
    document.getElementById('selected-template').addEventListener('click', (e) => {
        e.stopPropagation(); TemplateManager.toggleCustomDropdown();
    });
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('template-dropdown');
        if (dropdown && !dropdown.contains(e.target)) TemplateManager.closeCustomDropdown();
    });
    if (iframe) {
        iframe.addEventListener('load', () => {
            setTimeout(() => {
                checkPendingActions();
            }, 1500); 
        });
    } else {
        setTimeout(checkPendingActions, 2000);
    }
    
    const isZenModeActive = localStorage.getItem('zenModeActive') === 'true';
    if (isZenModeActive) {
        const body = document.body;
        const btn = document.getElementById('btn-zen-mode');
        if (body && btn) {
            body.classList.add('zen-mode');
            const icon = btn.querySelector('i');
            icon.className = 'fas fa-chevron-right';
            btn.title = "Tryb Zen (Pokaż pasek)";
        }
    }
});