# ♊ Gemini Pro Panel - Chrome Extension

<p align="center">
  <img src="https://img.shields.io/badge/Manifest_V3-Chrome_API-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/AI-OpenRouter_API-9D4EDD?style=flat-square" alt="AI Models" />
</p>

Zaawansowane rozszerzenie przeglądarki działające w panelu bocznym (Side Panel), zaprojektowane w celu maksymalnej optymalizacji pracy z modelami LLM. Pozwala na błyskawiczne zarządzanie kontekstem z przeglądanych stron i automatyzację wprowadzania promptów.

> Projekt idealnie wpisuje się w automatyzację procesów biurowych – pozwala m.in. na szybkie podsumowywanie maili, analizę otwartych kart i wyciąganie kluczowych danych (np. logistycznych) bez przełączania okien.

## ✨ Główne funkcje

* **Ghost Writer:** Moduł wstrzykujący wygenerowany tekst oraz wycięte obrazy bezpośrednio do pola wejściowego na stronie `gemini.google.com`.
* **Szybkie Menu Kontekstowe:** Akcje pod prawym przyciskiem myszy na zaznaczonym tekście (Wyjaśnij, Streszcz, Przetłumacz, Sprawdź kod).
* **Tab Cluster & Token Counter:** Narzędzie do analizy zawartości wielu otwartych kart jednocześnie, wyposażone w wizualny licznik zużycia tokenów, zapobiegający przekroczeniu limitów kontekstu.
* **Smart Crop Tool:** Wbudowane narzędzie do natychmiastowego zaznaczania, wycinania i przesyłania fragmentów ekranu do modelu wizyjnego.
* **Menadżer Promptów i Notatnik:** Lokalne zarządzanie ulubionymi szablonami zapytań.
* **Obsługa modeli zapasowych:** Pełna integracja z OpenRouter API, pozwalająca na przełączanie się w locie między modelami takimi jak Gemini, Llama 3, Qwen czy Mistral w zależności od potrzeb zadania.

## 🛠️ Tech Stack

* **Vanilla JavaScript** (ES Modules, w pełni natywna wydajność)
* **HTML5 & CSS3** (Lekki, responsywny interfejs dopasowany do Side Panelu)
* **Chrome Extension API** (Manifest V3, SidePanel API, ContextMenus, Scripting, Storage)
* **OpenRouter API / Google Gemini API**

## 🚀 Jak zainstalować i przetestować (Tryb Developera)

Jako że rozszerzenie nie jest jeszcze opublikowane w Chrome Web Store, możesz je uruchomić lokalnie w kilku prostych krokach:

1. Pobierz lub sklonuj to repozytorium na swój dysk:
   ```bash
   git clone [https://github.com/xIIIk4oIIIx/gemini-pro-panel.git](https://github.com/xIIIk4oIIIx/gemini-pro-panel.git)
2.  Otwórz przeglądarkę Chrome (lub opartą na Chromium, np. Brave, Edge) i przejdź pod adres: `chrome://extensions/`
3.  W prawym górnym rogu włącz **"Tryb programisty"** (Developer mode).
4.  Kliknij przycisk **"Załaduj rozpakowane"** (Load unpacked) w lewym górnym rogu.
5.  Wybierz folder z projektem.
6.  *Gotowe\!* Kliknij ikonę rozszerzenia na pasku lub otwórz Panel Boczny, aby rozpocząć korzystanie.

*(Opcjonalnie: Aby w pełni korzystać z funkcji zewnętrznych modeli, wprowadź swój klucz OpenRouter API w ustawieniach wtyczki).*

## 📸 Zrzuty ekranu / Demo
| | | |
|:---:|:---:|:---:|
| <img height="400" alt="Image 1" src="https://github.com/user-attachments/assets/5ecf28db-02da-4df5-bf4b-846ddae44a57" /> | <img height="400" alt="Image 2" src="https://github.com/user-attachments/assets/94c9193f-b76b-4740-8c1a-142ecc18f033" /> | <img height="400" alt="Image 3" src="https://github.com/user-attachments/assets/e04a3f43-d627-4f3b-8cdf-06103e88169c" /> |
| <img height="400" alt="Image 4" src="https://github.com/user-attachments/assets/dcb9d484-1adf-4e91-b274-544cd0ef067f" /> | <img height="400" alt="Image 5" src="https://github.com/user-attachments/assets/591ec48b-6ed2-4fb8-89a2-a689ff891b0c" /> | <img height="400" alt="Image 6" src="https://github.com/user-attachments/assets/6f2aa032-6969-488b-9af2-7a2532dfe745" /> |
| <img height="400" alt="Image 7" src="https://github.com/user-attachments/assets/a5ea1bad-ee58-46bb-8d4d-d9b4ebdfc165" /> | <img height="400" alt="Image 8" src="https://github.com/user-attachments/assets/bac7a259-9243-4233-876d-2c8db06422b2" /> | <img height="400" alt="Image 9" src="https://github.com/user-attachments/assets/8153280a-bdc6-47db-a7b9-2cbfd1cc9594" /> |
| <img height="400" alt="Image 10" src="https://github.com/user-attachments/assets/176b556e-3d9c-4a08-be3b-877d63345116" /> | <img height="400" alt="Image 11" src="https://github.com/user-attachments/assets/0dfedfca-b3e9-463d-af2f-429b3275664e" /> | <img height="400" alt="Image 12" src="https://github.com/user-attachments/assets/26aba96e-ce15-4f37-83a4-44bed2ca97b5" /> |
