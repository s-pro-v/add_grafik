try {
    var _p = window.parent;
    if (_p && _p !== window) {
        _p.showAlertModal = _p.showAlertModal || alert;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const terminal = document.getElementById('sys-terminal');
        const savedTheme = localStorage.getItem('oxy_theme') || 'dark';
        let currentTheme = savedTheme === 'light' ? 'light' : 'dark';
        const getMonacoThemeName = (theme) => theme === 'light' ? 'terminal-light' : 'terminal-dark';

        const createTerminalLine = (msg, type = 'info', timestamp = null) => {
            const line = document.createElement('div');
            line.className = `terminal-line terminal-${type}`;

            if (timestamp) {
                const stamp = document.createElement('span');
                stamp.className = 'terminal-timestamp';
                stamp.textContent = `[${timestamp}] `;
                line.appendChild(stamp);
            }

            const text = document.createElement('span');
            text.className = 'terminal-message';
            text.textContent = msg;
            line.appendChild(text);

            return line;
        };

        const getTerminalType = (msg) => {
            if (/CRITICAL ERR|CRITICAL ERROR|CRITICAL/i.test(msg)) return 'critical';
            if (/ERR:|ERROR|\bERR\b/i.test(msg)) return 'error';
            if (/WARN:|WARNING/i.test(msg)) return 'warn';
            if (/SUCCESS:|OK:|POMYŚLNIE|ZAAKCEPTOWANY/i.test(msg)) return 'success';
            if (/STATUS:|KROK|MEMCACHE:|SYSTEM/i.test(msg)) return 'status';
            return 'info';
        };

        const logToTerminal = (msg) => {
            const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
            const lineType = getTerminalType(msg);
            if (terminal) {
                if (terminal.childNodes.length === 0 && terminal.textContent.trim().length > 0) {
                    const initialText = terminal.textContent.trim();
                    terminal.textContent = '';
                    terminal.appendChild(createTerminalLine(initialText, 'status'));
                }

                const line = createTerminalLine(msg, lineType, timestamp);
                terminal.appendChild(line);
                terminal.scrollTop = terminal.scrollHeight;
            } else {
                console.log(`[${timestamp}] ${msg}`);
            }
        };

        const confirmModal = document.getElementById('confirm-modal');
        const confirmModalTitle = document.getElementById('confirm-modal-main-title');
        const confirmModalMessage = document.getElementById('confirm-modal-message');
        const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
        const confirmModalCancel = document.getElementById('confirm-modal-cancel');
        const confirmModalClose = document.getElementById('confirm-modal-close');

        const toggleConfirmModal = (show, type = 'warning') => {
            if (!confirmModal) return;
            confirmModal.setAttribute('data-alert-type', type);
            confirmModal.classList.toggle('active', show);
        };

        const showConfirmModal = async ({
            type = 'warning',
            title = 'Potwierdź akcję',
            message = '',
            confirmText = 'Potwierdź',
            cancelText = 'Anuluj'
        } = {}) => {
            if (!confirmModal) {
                return window.confirm(message || title);
            }

            confirmModalTitle.textContent = title;
            confirmModalMessage.textContent = message;
            confirmModalConfirm.textContent = confirmText;
            confirmModalCancel.textContent = cancelText;
            toggleConfirmModal(true, type);

            return new Promise((resolve) => {
                const cleanup = () => {
                    toggleConfirmModal(false);
                    confirmModalConfirm.removeEventListener('click', onConfirm);
                    confirmModalCancel.removeEventListener('click', onCancel);
                    confirmModalClose.removeEventListener('click', onCancel);
                };

                const onConfirm = () => {
                    cleanup();
                    resolve(true);
                };

                const onCancel = () => {
                    cleanup();
                    resolve(false);
                };

                confirmModalConfirm.addEventListener('click', onConfirm);
                confirmModalCancel.addEventListener('click', onCancel);
                confirmModalClose.addEventListener('click', onCancel);
            });
        };

        if (typeof require === 'undefined') {
            logToTerminal('CRITICAL ERR: BRAK MODUŁU REQUIRE().');
            return;
        }

        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

        require(['vs/editor/editor.main'], function () {
            logToTerminal('STATUS: BIBLIOTEKA MONACO EDITOR ZAŁADOWANA.');

            if (typeof defineMonacoThemes === 'function') {
                defineMonacoThemes();
            }

            window.editorM1 = monaco.editor.create(document.getElementById('sys-editor-m1'), {
                value: JSON.stringify({
                    "status": "STACJA 01: GOTOWA"
                }, null, 2),
                language: 'json',
                theme: getMonacoThemeName(currentTheme),
                automaticLayout: true,
                minimap: { enabled: false },
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                scrollBeyondLastLine: false,
                roundedSelection: false
            });

            window.editorM2 = monaco.editor.create(document.getElementById('sys-editor-m2'), {
                value: JSON.stringify({
                    "status": "STACJA 02: GOTOWA"
                }, null, 2),
                language: 'json',
                theme: getMonacoThemeName(currentTheme),
                automaticLayout: true,
                minimap: { enabled: false },
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                scrollBeyondLastLine: false,
                roundedSelection: false
            });

            logToTerminal('STATUS: EDYTORY GOTOWE. INICJALIZACJA LOGIKI...');
            initSystemLogic();
        });

        async function fetchAndDecryptToken(key) {
            logToTerminal('KROK 1: POBIERANIE auth.json Z GITHUB RAW...');
            const url = `https://raw.githubusercontent.com/s-pro-v/json-lista/refs/heads/main/dev/auth.json?t=${Date.now()}`;

            try {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`BŁĄD HTTP CDN: ${res.status}`);
                }
                const data = await res.json();

                // Obsługa tablicy obiektów
                let tokenData = null;
                if (Array.isArray(data)) {
                    logToTerminal('KROK 1a: PLIK TO TABLICA. SZUKANIE KLUCZA "json_up"...');
                    tokenData = data.find(obj => obj && obj.json_up);
                } else if (data && data.json_up) {
                    tokenData = data;
                }

                if (!tokenData || !tokenData.json_up) {
                    throw new Error('BRAK KLUCZA "json_up" W PLIKU ZDALNYM.');
                }

                logToTerminal('KROK 1b: ZNALEZIONO json_up. PRZYSTĘPUJĘ DO DEKODOWANIA...');
                logToTerminal('KROK 2: DEKODOWANIE BASE64...');
                let cleanBase64 = tokenData.json_up.trim().replace(/\s/g, '');

                // Obsługa base64+ (padding)
                const padding = 4 - (cleanBase64.length % 4);
                if (padding && padding !== 4) {
                    cleanBase64 += '='.repeat(padding);
                }

                logToTerminal('KROK 2a: DEKODOWANIE BAZY64 ZAKOŃCZONE.');
                const encString = atob(cleanBase64);
                logToTerminal('KROK 2b: ZASTOSOWANIE ODSZYFROWANIAXOR...');

                let decrypted = '';
                if (!key || key.length === 0) {
                    throw new Error('KLUCZ XOR JEST PUSTY!');
                }

                for (let i = 0; i < encString.length; i++) {
                    const encCharCode = encString.charCodeAt(i);
                    const keyCharCode = key.charCodeAt(i % key.length);
                    const decCharCode = encCharCode ^ keyCharCode;
                    decrypted += String.fromCharCode(decCharCode);
                }


                logToTerminal('KROK 2c: ODSZYFROWYWANIE TOKENA ZAKOŃCZONE.');

                // Walidacja zdekodowanego tokena
                if (!decrypted || decrypted.length < 10) {
                    throw new Error('ZDEKODOWANY TOKEN JEST ZBYT KRÓTKI LUB PUSTY. WERYFIKUJ KLUCZ XOR!');
                }

                // Sprawdzenie czy token wygląda jak prawidłowy GitHub token
                if (!decrypted.startsWith('ghp_') && !decrypted.startsWith('ghs_') && !decrypted.startsWith('ghu_')) {
                    logToTerminal('WARN: TOKEN MOŻE BYĆ NIEPRAWIDŁOWY (NIE PASUJE DO WZORCA GitHub). PRÓBUJĘ...');
                }

                logToTerminal(`KROK 2d: TOKEN ZDEKODOWANY POMYŚLNIE. DŁUGOŚĆ: ${decrypted.length}`);
                return decrypted;
            } catch (err) {
                logToTerminal(`CRITICAL ERR (TOKEN): ${err.message}`);
                return null; // Zwracamy null w przypadku błędu
            }
        }

        function initSystemLogic() {
            const GITHUB_API_URL = 'https://api.github.com/repos/s-pro-v/json-lista/contents/mobile-grafik.json';

            const base64ToUtf8 = (base64) => {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return new TextDecoder().decode(bytes);
            };

            const utf8ToBase64 = (str) => {
                const bytes = new TextEncoder().encode(str);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                return btoa(binary);
            };

            const xorInput = document.getElementById('sys-xor-key');
            const btnFetchToken = document.getElementById('sys-fetch-token');
            const btnFetchData = document.getElementById('sys-fetch-data');
            const btnSubmit = document.getElementById('sys-submit');
            const loaderFetchToken = document.getElementById('sys-loader-fetch-token');
            const loaderFetchData = document.getElementById('sys-loader-fetch-data');
            const loaderPush = document.getElementById('sys-loader-push');
            const dotM1 = document.getElementById('m1-status-dot');
            const dotM2 = document.getElementById('m2-status-dot');
            const themeToggleBtn = document.getElementById('sys-theme-toggle');

            const applyTheme = (theme) => {
                currentTheme = theme === 'light' ? 'light' : 'dark';
                document.documentElement.setAttribute('theme', currentTheme);
                localStorage.setItem('oxy_theme', currentTheme);
                if (themeToggleBtn) {
                    themeToggleBtn.textContent = `TRYB: ${currentTheme === 'dark' ? 'CIEMNY' : 'JASNY'}`;
                }
                if (window.editorM1 && window.editorM2 && typeof monaco !== 'undefined') {
                    monaco.editor.setTheme(getMonacoThemeName(currentTheme));
                }
                logToTerminal(`STATUS: USTAWIONO MOTYW ${currentTheme.toUpperCase()}.`);
            };

            if (themeToggleBtn) {
                themeToggleBtn.addEventListener('click', () => {
                    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    applyTheme(nextTheme);
                });
            }

            let systemState = {
                sha: null,
                activeToken: null
            };

            logToTerminal('SYSTEM ODBIORU GOTOWY.');
            applyTheme(currentTheme);

            // Funkcja do ukrywania klucza i pokazania statusu
            const hideKeyInput = () => {
                xorInput.classList.add('hidden');
                const keyStatus = document.getElementById('sys-key-status');
                if (keyStatus) {
                    keyStatus.classList.remove('hidden');
                }
            };

            // Funkcja do pokazania inputu klucza
            const showKeyInput = () => {
                xorInput.classList.remove('hidden');
                const keyStatus = document.getElementById('sys-key-status');
                if (keyStatus) {
                    keyStatus.classList.add('hidden');
                }
            };

            // ZAPAMIĘTYWANIE: Wczytanie klucza XOR z localStorage
            const savedXorKey = localStorage.getItem('oxy_xor_key');
            if (savedXorKey) {
                xorInput.value = savedXorKey;
                logToTerminal(`MEMCACHE: WCZYTANO ZAPAMIĘTANY KLUCZ XOR (${savedXorKey.length} znaków).`);
            }

            // ZAPAMIĘTYWANIE: Wczytanie tokena z localStorage
            const savedToken = localStorage.getItem('oxy_active_token');
            if (savedToken) {
                systemState.activeToken = savedToken;
                logToTerminal(`MEMCACHE: WCZYTANO ZAPAMIĘTANY TOKEN (${savedToken.length} znaków).`);
                btnFetchData.disabled = false;
                // Ukryj input jeśli token jest zapamiętany
                hideKeyInput();
            }

            // Event listener do zmiany klucza (kliknięcie na status)
            const keyStatus = document.getElementById('sys-key-status');
            if (keyStatus) {
                keyStatus.addEventListener('click', () => {
                    showKeyInput();
                    xorInput.focus();
                    logToTerminal('EDYCJA: WPROWADŹ NOWY KLUCZ XOR.');
                });
                keyStatus.style.cursor = 'pointer';
            }

            // ZAPAMIĘTYWANIE: Zapisz klucz przy każdej zmianie
            xorInput.addEventListener('input', (e) => {
                const key = e.target.value.trim();
                if (key) {
                    localStorage.setItem('oxy_xor_key', key);
                    logToTerminal(`MEMCACHE: KLUCZ XOR ZAPAMIĘTANY.`);
                } else {
                    localStorage.removeItem('oxy_xor_key');
                    logToTerminal(`MEMCACHE: KLUCZ XOR USUNIĘTY Z PAMIĘCI.`);
                }
            });

            btnFetchToken.addEventListener('click', async () => {
                const key = xorInput.value.trim();
                if (!key) {
                    logToTerminal('ERR: WPROWADŹ KLUCZ DEKRYPCJI XOR.');
                    (window.parent?.showAlertModal || alert)('⚠️ BŁĄD: Musisz wpisać klucz XOR aby odszyfrować token!');
                    return;
                }

                const fetchConfirmed = await showConfirmModal({
                    type: 'info',
                    title: 'Pobieranie tokena',
                    message: 'Czy na pewno chcesz pobrać i odszyfrować token z GitHub? Ta operacja zapisze token w pamięci lokalnej.',
                    confirmText: 'Tak, pobierz',
                    cancelText: 'Nie, anuluj'
                });

                if (!fetchConfirmed) {
                    logToTerminal('WARN: POBIERANIE TOKENA ANULOWANE PRZEZ UŻYTKOWNIKA.');
                    return;
                }

                logToTerminal(`STATUS: ROZPOCZĘCIE ODSZYFROWYWANIA TOKENEM O DŁUGOŚCI: ${key.length}`);

                loaderFetchToken.classList.remove('hidden');

                const token = await fetchAndDecryptToken(key);
                if (!token) {
                    logToTerminal('ERR: PROCES POBIERANIA TOKENA ZAKOŃCZONY NIEPOWODZENIEM. PRZERWANO.');
                    loaderFetchToken.classList.add('hidden');
                    return;
                }

                systemState.activeToken = token;
                localStorage.setItem('oxy_active_token', token);
                logToTerminal('SUCCESS: TOKEN ZAAKCEPTOWANY W PAMIĘCI KERNELA I CACHE\'U.');
                hideKeyInput();
                btnFetchData.disabled = false;
                btnSubmit.disabled = true;
                loaderFetchToken.classList.add('hidden');
            });

            btnFetchData.addEventListener('click', async () => {
                if (!systemState.activeToken) {
                    logToTerminal('ERR: BRAK TOKENA. POBIERZ NAJPIERW TOKEN.');
                    return;
                }

                const fetchConfirmed = await showConfirmModal({
                    type: 'info',
                    title: 'Pobieranie danych',
                    message: 'Czy chcesz pobrać dane z GitHub przy użyciu aktywnego tokena?',
                    confirmText: 'Tak, pobierz',
                    cancelText: 'Nie, anuluj'
                });

                if (!fetchConfirmed) {
                    logToTerminal('WARN: POBIERANIE DANYCH ANULOWANE PRZEZ UŻYTKOWNIKA.');
                    return;
                }

                loaderFetchData.classList.remove('hidden');
                logToTerminal('KROK 3: POBIERANIE STRUKTURY DANYCH Z GITHUB API...');

                try {
                    const res = await fetch(GITHUB_API_URL, {
                        headers: {
                            'Authorization': `token ${systemState.activeToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });

                    if (!res.ok) {
                        if (res.status === 401) throw new Error('BŁĄD 401: ODRZUCONO DOSTĘP (BŁĘDNY TOKEN/KLUCZ).');
                        throw new Error(`BŁĄD API GITHUB: HTTP ${res.status}`);
                    }

                    const fileData = await res.json();
                    systemState.sha = fileData.sha;
                    localStorage.setItem('oxy_file_sha', fileData.sha);
                    logToTerminal('MEMCACHE: SHA PLIKU ZAPAMIĘTANE.');

                    const contentClean = fileData.content.replace(/\s/g, '');
                    const jsonString = base64ToUtf8(contentClean);
                    const parsedArray = JSON.parse(jsonString);

                    if (Array.isArray(parsedArray)) {
                        if (parsedArray[0]) {
                            const m1Content = JSON.stringify(parsedArray[0], null, 2);
                            window.editorM1.setValue(m1Content);
                            localStorage.setItem('oxy_editor_m1', m1Content);
                            dotM1.style.backgroundColor = '#f36c00';
                            dotM1.style.boxShadow = '0 0 8px #f36c00';
                        } else {
                            window.editorM1.setValue('{}');
                            localStorage.setItem('oxy_editor_m1', '{}');
                        }

                        if (parsedArray[1]) {
                            const m2Content = JSON.stringify(parsedArray[1], null, 2);
                            window.editorM2.setValue(m2Content);
                            localStorage.setItem('oxy_editor_m2', m2Content);
                            dotM2.style.backgroundColor = '#f36c00';
                            dotM2.style.boxShadow = '0 0 8px #f36c00';
                        } else {
                            window.editorM2.setValue('{}');
                            localStorage.setItem('oxy_editor_m2', '{}');
                        }
                        logToTerminal('SUCCESS: DANE WSTRZYKNIĘTE DO OBU STACJI I ZAPAMIĘTANE.');
                    } else {
                        window.editorM1.setValue(JSON.stringify(parsedArray, null, 2));
                        window.editorM2.setValue('{}');
                        dotM1.style.backgroundColor = '#f36c00';
                        logToTerminal('WARN: STRUKTURA ZDALNA TO OBIEKT, WSTRZYKNIĘTO TYLKO DO STACJI 01.');
                    }

                    btnSubmit.disabled = false;
                } catch (error) {
                    logToTerminal(`CRITICAL ERR: ${error.message}`);
                } finally {
                    loaderFetchData.classList.add('hidden');
                }
            });

            btnSubmit.addEventListener('click', async () => {
                if (!systemState.activeToken) {
                    logToTerminal('ERR: BRAK AKTYWNEGO TOKENA. PONÓW POBIERANIE.');
                    return;
                }

                const contentM1 = window.editorM1.getValue().trim();
                const contentM2 = window.editorM2.getValue().trim();
                let compiledArray = [];

                try {
                    const obj1 = JSON.parse(contentM1);
                    if (Object.keys(obj1).length > 0) compiledArray.push(obj1);
                } catch (e) {
                    logToTerminal('ERR: BŁĄD SKŁADNI JSON W STACJI 01.');
                    return;
                }

                try {
                    const obj2 = JSON.parse(contentM2);
                    if (Object.keys(obj2).length > 0) compiledArray.push(obj2);
                } catch (e) {
                    logToTerminal('ERR: BŁĄD SKŁADNI JSON W STACJI 02.');
                    return;
                }

                if (compiledArray.length === 0) {
                    logToTerminal('ERR: OBYDWIE STACJE SĄ PUSTE.');
                    return;
                }

                const submitConfirmed = await showConfirmModal({
                    type: 'warning',
                    title: 'Wyślij zmiany',
                    message: 'Czy chcesz skompilować zawartość i wysłać ją do repozytorium? Ta operacja nadpisze istniejący plik.',
                    confirmText: 'Tak, wyślij',
                    cancelText: 'Anuluj'
                });

                if (!submitConfirmed) {
                    logToTerminal('WARN: WYSYŁANIE DANYCH ANULOWANE PRZEZ UŻYTKOWNIKA.');
                    return;
                }

                loaderPush.classList.remove('hidden');
                btnSubmit.disabled = true;
                logToTerminal('STATUS: KOMPILOWANIE DO TABLICY GŁÓWNEJ...');

                try {
                    const finalJsonString = JSON.stringify(compiledArray, null, 2);
                    const encodedContent = utf8ToBase64(finalJsonString);

                    logToTerminal('STATUS: WYSYŁANIE PAKIETU DO GITHUB API...');

                    const putRes = await fetch(GITHUB_API_URL, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${systemState.activeToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `OXY_OS: Aktualizacja bazy danych wro5`,
                            content: encodedContent,
                            sha: systemState.sha
                        })
                    });

                    if (!putRes.ok) throw new Error(`HTTP PUT ${putRes.status}`);
                    const putData = await putRes.json();

                    systemState.sha = putData.content.sha;
                    // ZAPAMIĘTYWANIE: Zapisz nowe SHA po aktualizacji
                    localStorage.setItem('oxy_file_sha', putData.content.sha);
                    // ZAPAMIĘTYWANIE: Zapisz aktualne zawartości edytorów
                    localStorage.setItem('oxy_editor_m1', contentM1);
                    localStorage.setItem('oxy_editor_m2', contentM2);
                    logToTerminal('SUCCESS: DANE POPRAWNIE NADPISANE W REPOZYTORIUM GŁÓWNYM I CACHE`U.');

                } catch (error) {
                    logToTerminal(`CRITICAL ERR: BŁĄD ZAPISU (${error.message})`);
                } finally {
                    loaderPush.classList.add('hidden');
                    btnSubmit.disabled = false;
                }
            });
        }
    });
} catch (e) {
    console.error("Zewnętrzny błąd JavaScript:", e);
}