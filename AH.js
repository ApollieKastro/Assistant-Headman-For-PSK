// ==UserScript==
// @name         AH- Assistant Headman
// @namespace    https://github.com/ApollieKastro/Assistant-Headman-For-PSK 
// // @version      3.6
// @description  Скрипт который позваляет выставлять прогуллы массово, выборочно, по определенным фильтрам. значительно экномит время старостам
// @author       AbrikosV 
// @match        https://system.fgoupsk.ru/student/?mode=ucheba&act=group&act2=prog*
// @grant        GM_xmlhttpRequest
// @connect      system.fgoupsk.ru
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const REASONS = {
        '0': 'нет',
        '1': 'мед.справка',
        '2': 'общественная деятельность',
        '3': 'дежурство',
        '4': 'объяснительная'
    };

    const LS_LAST = 'sfh-last-inputs';
    const LS_COLLAPSED = 'sfh-collapsed';
    const LS_AUTORELOAD = 'sfh-autoreload';

    const state = {
        running: false,
        cancel: false,
        cancelReload: false
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // === ОПРЕДЕЛЕНИЕ ТЕМЫ ===
    // установлен ли PskStyle (дополнение оформления сайта)
    function pskStyleActive() {
        if (!document.body) return false;
        if (document.querySelector('meta[id^="psk-style-schetule2"]')) return true;
        if (document.getElementById('shs-shell')) return true;
        return document.body.classList.contains('shs-enhanced') ||
               document.body.classList.contains('shs-lite');
    }

    function detectTheme() {
        // 1) есть дополнение стиля — используем ЕГО тему
        if (pskStyleActive()) {
            const attr = document.body.getAttribute('data-theme');
            if (attr === 'dark' || attr === 'light') return attr;

            const saved = localStorage.getItem('shs-theme');
            if (saved === 'dark' || saved === 'light') return saved;
            // «system» или настройка ещё не применена — системная схема
            return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // 2) дополнения нет — свой стиль: классы сайта
        const darkClasses = ['dark', 'theme-dark', 'night', 'dark-mode', 'theme_night'];
        const lightClasses = ['light', 'theme-light', 'day', 'light-mode'];
        const has = (list) => list.some(cls =>
            document.documentElement.classList.contains(cls) || document.body.classList.contains(cls)
        );
        if (has(darkClasses)) return 'dark';
        if (has(lightClasses)) return 'light';

        // 3) иначе — системная тема
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // === ПАЛИТРЫ ===
    function getThemeStyles(theme) {
        return theme === 'dark' ? {
            bgPanel: 'rgba(35, 39, 46, .96)',
            borderPanel: '#555',
            text: '#e0e0e0',
            inputBg: '#3a3a3a',
            inputBorder: '#555',
            inputText: '#f0f0f0',
            placeholder: '#aaa',
            btnMarkBg: '#2e7d32',
            btnMarkHover: '#1b5e20',
            btnRemoveBg: '#c62828',
            btnRemoveHover: '#b71c1c',
            btnStopBg: '#ef6c00',
            btnStopHover: '#e65100',
            statusInfoBg: '#212121',
            statusSuccessBg: '#1b5e20',
            statusErrorBg: '#b71c1c',
            resultBg: '#1e3a5f',
            resultText: '#bbdefb'
        } : {
            bgPanel: 'rgba(255, 255, 255, .97)',
            borderPanel: '#4CAF50',
            text: '#333',
            inputBg: '#fff',
            inputBorder: '#ddd',
            inputText: '#333',
            placeholder: '#999',
            btnMarkBg: '#4CAF50',
            btnMarkHover: '#388E3C',
            btnRemoveBg: '#D32F2F',
            btnRemoveHover: '#C62828',
            btnStopBg: '#FB8C00',
            btnStopHover: '#EF6C00',
            statusInfoBg: '#e3f2fd',
            statusSuccessBg: '#e8f5e9',
            statusErrorBg: '#ffebee',
            resultBg: '#e3f2fd',
            resultText: '#1565c0'
        };
    }

    // === КАЛЕНДАРЬ ДНЯ (навигация: m = месяц, d = день) ===
    function parseCurrentDay() {
        const sp = new URLSearchParams(location.search);
        const now = new Date();
        const m = parseInt(sp.get('m') || '', 10);
        const d = parseInt(sp.get('d') || '', 10);
        if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return new Date(now.getFullYear(), m - 1, d);
        }
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function gotoDay(date) {
        const url = new URL(location.href);
        url.searchParams.set('m', String(date.getMonth() + 1));
        url.searchParams.set('d', String(date.getDate()));
        location.href = url.toString();
    }

    const sameDay = (a, b) =>
        a && b && a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    // панель «плавает» при прокрутке: фиксирована у правого края таблицы
    function anchorPanelNextToTable() {
        const p = document.getElementById('sfh-panel');
        const t = document.querySelector('table.table-prog');
        if (!p || !t) return false;
        const r = t.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        // не даём панели выехать за правый край экрана (~360px ширина)
        p.style.left = `${Math.min(r.right + 8, Math.max(8, vw - 380))}px`;
        return true;
    }

    function buildCalendar(container, s, theme) {
        const current = parseCurrentDay();
        const today = new Date();
        let view = new Date(current.getFullYear(), current.getMonth(), 1);

        container.innerHTML = '';

        const head = document.createElement('div');
        head.className = 'sfh-cal-head';
        const mkNav = (label) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'sfh-cal-nav';
            b.textContent = label;
            return b;
        };
        const prevM = mkNav('‹');
        const label = document.createElement('span');
        label.className = 'sfh-cal-label';
        const nextM = mkNav('›');
        head.append(prevM, label, nextM);

        const dow = document.createElement('div');
        dow.className = 'sfh-cal-dow';
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(d0 => {
            const sp0 = document.createElement('span');
            sp0.textContent = d0;
            dow.appendChild(sp0);
        });

        const grid = document.createElement('div');
        grid.className = 'sfh-cal-grid';

        const foot = document.createElement('div');
        foot.className = 'sfh-cal-foot';
        const prevD = mkNav('◀');
        prevD.title = 'Предыдущий день';
        const todayBtn = mkDayBtn('Сегодня');
        const nextD = mkNav('▶');
        nextD.title = 'Следующий день';
        foot.append(prevD, todayBtn, nextD);

        function mkDayBtn(text) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'sfh-cal-day-btn';
            b.textContent = text;
            return b;
        }

        container.append(head, dow, grid, foot);

        function render() {
            label.textContent = view.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            grid.innerHTML = '';

            let start = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
            start = start === 0 ? 6 : start - 1;
            for (let i = 0; i < start; i++) {
                grid.appendChild(document.createElement('span'));
            }

            const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(view.getFullYear(), view.getMonth(), d);
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'sfh-cal-cell';
                cell.textContent = d;
                if (sameDay(date, current)) cell.classList.add('sel');
                else if (sameDay(date, today)) cell.classList.add('today');
                cell.onclick = () => gotoDay(date);
                grid.appendChild(cell);
            }
        }

        prevM.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
        nextM.onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
        prevD.onclick = () => gotoDay(new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1));
        nextD.onclick = () => gotoDay(new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1));
        todayBtn.onclick = () => gotoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

        render();
    }

    // === СЧЁТЧИК ПРОГУЛОВ (внутри панели) ===
    function countSkippers() {
        const rows = document.querySelectorAll('table.table-prog tbody tr');
        let skipCount = 0;
        rows.forEach(row => {
            if (row.querySelector('td.danger, td.success')) skipCount++;
        });
        return skipCount;
    }

    function updateSkipCounter() {
        const el = document.getElementById('sfh-counter');
        if (el) el.textContent = `👥 Студентов с прогулом: ${countSkippers()}`;
    }

    function observeTableMutations() {
        const table = document.querySelector('table.table-prog tbody');
        if (!table) return;
        const obs = new MutationObserver(() => {
            updateSkipCounter();
        });
        obs.observe(table, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // === СОЗДАНИЕ ИНТЕРФЕЙСА (плавающая панель справа) ===
    function createUI() {
        const theme = detectTheme();
        document.body.dataset.sfhTheme = theme;
        const s = getThemeStyles(theme);

        const h2 = [...document.querySelectorAll('section h2')]
            .find(el => el.textContent.trim() === 'Прогулы');
        if (!h2) {
            console.error('[SFH] Заголовок "Прогулы" не найден. Скрипт не может инициализироваться.');
            return;
        }

        const collapsed = localStorage.getItem(LS_COLLAPSED) === 'true';
        const autoreload = localStorage.getItem(LS_AUTORELOAD) !== 'false';
        let last = {};
        try { last = JSON.parse(localStorage.getItem(LS_LAST) || '{}'); } catch (e) { }

        const panel = document.createElement('div');
        panel.id = 'sfh-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            transform: translateY(-50%);
            width: 360px;
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            z-index: 9000;
            background: ${s.bgPanel};
            backdrop-filter: blur(6px);
            border: 2px solid ${s.borderPanel};
            border-radius: 12px;
            padding: 18px 20px;
            box-shadow: 0 8px 28px rgba(0,0,0,0.25);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: ${s.text};
            font-size: 14px;
        `;

        const reasonOptions = Object.entries(REASONS)
            .map(([v, label]) => `<option value="${v}">${label}</option>`)
            .join('');

        panel.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="color:${theme === 'dark' ? '#81c784' : '#4CAF50'}; font-size:15px; font-weight:600; flex:1;">
                    📋 SFH — Прогулы
                </span>
                <button id="sfh-collapse" title="Свернуть/развернуть"
                    style="border:none; background:transparent; color:${s.text}; cursor:pointer; font-size:16px; line-height:1; padding:2px 6px;">
                    ${collapsed ? '+' : '–'}
                </button>
            </div>
            <div id="sfh-counter" style="margin-bottom:${collapsed ? '0' : '10px'}; font-size:12px; font-weight:bold;"></div>
            <div id="sfh-body" style="display:${collapsed ? 'none' : 'block'};">
                <div id="sfh-cal"></div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 12px;">Студенты:</label>
                    <input type="text" id="sfh-students" placeholder="1,3,5 или 1-10 или all"
                        style="width: 100%; padding: 7px; border: 1px solid ${s.inputBorder}; border-radius: 5px; font-size: 13px; background: ${s.inputBg}; color: ${s.inputText};">
                    <small style="color: ${s.placeholder}; font-size: 11px;">Примеры: <code>all</code>, <code>1-5</code>, <code>1,3,7</code></small>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 12px;">Пары/часы:</label>
                    <input type="text" id="sfh-pairs" placeholder="1 или 1.1 или 1-4"
                        style="width: 100%; padding: 7px; border: 1px solid ${s.inputBorder}; border-radius: 5px; font-size: 13px; background: ${s.inputBg}; color: ${s.inputText};">
                    <small style="color: ${s.placeholder}; font-size: 11px;"><code>1.1</code> = 1 пара, 1 час; <code>1-4</code> = все пары 1–4</small>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: bold; font-size: 12px;">Причина:</label>
                    <select id="sfh-reason"
                        style="width: 100%; padding: 7px; border: 1px solid ${s.inputBorder}; border-radius: 5px; font-size: 13px; background: ${s.inputBg}; color: ${s.inputText};">
                        ${reasonOptions}
                    </select>
                </div>
                <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="sfh-autoreload" ${autoreload ? 'checked' : ''}>
                    Автообновление страницы после операций
                </label>
                <button id="sfh-mark-btn" style="width:100%; margin-bottom:7px; padding: 11px; background: ${s.btnMarkBg}; color: white; border: none; border-radius: 5px; font-size: 13px; font-weight: bold; cursor: pointer;">
                    ✅ Выставить прогулы
                </button>
                <button id="sfh-remove-btn" style="width:100%; margin-bottom:7px; padding: 11px; background: ${s.btnRemoveBg}; color: white; border: none; border-radius: 5px; font-size: 13px; font-weight: bold; cursor: pointer;">
                    ❌ Удалить часы
                </button>
                <button id="sfh-stop-btn" style="width:100%; display:none; padding: 11px; background: ${s.btnStopBg}; color: white; border: none; border-radius: 5px; font-size: 13px; font-weight: bold; cursor: pointer;">
                    ⏹ Остановить
                </button>
                <div id="sfh-status" style="margin-top: 12px; padding: 9px; border-radius: 5px; font-size: 12px; display: none;"></div>
                <div id="sfh-result" style="margin-top: 9px; padding: 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: none;"></div>
                <div id="sfh-reload" style="margin-top: 9px; padding: 8px; border-radius: 5px; font-size: 12px; display: none; background: ${s.resultBg}; color: ${s.resultText};">
                    Обновление страницы через <b id="sfh-reload-num">3</b>…
                    <button id="sfh-reload-cancel" style="margin-left:6px; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:11px;">Отмена</button>
                </div>
            </div>
        `;

        // панель встаёт сразу ПОСЛЕ таблицы прогулов
        const progTable = document.querySelector('table.table-prog');
        (progTable || h2).after(panel);

        // на широких экранах панель «плавает» справа от таблицы при прокрутке,
        // на узких — обычным блоком под ней
        if (progTable && window.innerWidth > 700) {
            anchorPanelNextToTable();
        }

        buildCalendar(document.getElementById('sfh-cal'), s, theme);
        updateSkipCounter();

        // === Динамические стили ===
        let style = document.createElement('style');
        style.id = 'sfh-theme-style';
        style.textContent = `
            #sfh-mark-btn:hover { background: ${s.btnMarkHover} !important; }
            #sfh-remove-btn:hover { background: ${s.btnRemoveHover} !important; }
            #sfh-stop-btn:hover { background: ${s.btnStopHover} !important; }
            #sfh-status.info { background: ${s.statusInfoBg}; color: ${theme === 'dark' ? '#90caf9' : '#1565c0'}; }
            #sfh-status.success { background: ${s.statusSuccessBg}; color: ${theme === 'dark' ? '#a5d6a7' : '#2e7d32'}; }
            #sfh-status.error { background: ${s.statusErrorBg}; color: ${theme === 'dark' ? '#ef9a9a' : '#c62828'}; }
            #sfh-result { background: ${s.resultBg}; color: ${s.resultText}; }
            #sfh-students:focus, #sfh-pairs:focus, #sfh-reason:focus {
                outline: 2px solid ${theme === 'dark' ? '#4CAF50' : '#2E7D32'};
                border-color: transparent;
            }
            #sfh-cal { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid ${s.inputBorder}; }
            .sfh-cal-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
            .sfh-cal-label { flex:1; text-align:center; font-weight:bold; font-size:13px; text-transform:capitalize; color:${s.text}; }
            .sfh-cal-nav { width:30px; height:30px; border:1px solid ${s.inputBorder}; background:${s.inputBg}; color:${s.inputText}; border-radius:7px; cursor:pointer; font-size:14px; line-height:1; padding:0; }
            .sfh-cal-nav:hover { border-color:${theme === 'dark' ? '#4CAF50' : '#2E7D32'}; }
            .sfh-cal-dow, .sfh-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
            .sfh-cal-dow span { text-align:center; font-size:10px; font-weight:bold; color:${s.placeholder}; padding:3px 0; }
            .sfh-cal-cell { aspect-ratio:1; border:none; border-radius:6px; background:transparent; color:${s.text}; cursor:pointer; font-size:12px; padding:0; font-family:inherit; }
            .sfh-cal-cell:hover { background:${s.inputBg}; }
            .sfh-cal-cell.sel { background:${s.btnMarkBg}; color:#fff; font-weight:bold; }
            .sfh-cal-cell.today { box-shadow: inset 0 0 0 1.5px ${theme === 'dark' ? '#4CAF50' : '#2E7D32'}; font-weight:bold; }
            .sfh-cal-foot { display:flex; gap:5px; margin-top:8px; }
            .sfh-cal-day-btn { flex:1; border:1px solid ${s.inputBorder}; background:${s.inputBg}; color:${s.inputText}; font-size:11px; font-weight:bold; padding:6px 4px; border-radius:6px; cursor:pointer; white-space:nowrap; font-family:inherit; }
            .sfh-cal-day-btn:hover { border-color:${theme === 'dark' ? '#4CAF50' : '#2E7D32'}; }
            @media print { #sfh-panel { display: none !important; } }
            @media (max-width: 700px) {
                #sfh-panel { width: calc(100vw - 24px) !important; left: 12px !important; }
            }
        `;
        document.head.appendChild(style);

        // === Восстановление сохранённого ввода ===
        const inpStudents = document.getElementById('sfh-students');
        const inpPairs = document.getElementById('sfh-pairs');
        const selReason = document.getElementById('sfh-reason');

        inpStudents.value = last.students || '';
        inpPairs.value = last.pairs || '';
        if (last.reason && REASONS[last.reason] !== undefined) selReason.value = last.reason;

        const saveInputs = () => {
            localStorage.setItem(LS_LAST, JSON.stringify({
                students: inpStudents.value,
                pairs: inpPairs.value,
                reason: selReason.value
            }));
        };
        inpStudents.addEventListener('input', saveInputs);
        inpPairs.addEventListener('input', saveInputs);
        selReason.addEventListener('change', saveInputs);

        document.getElementById('sfh-autoreload').addEventListener('change', (e) => {
            localStorage.setItem(LS_AUTORELOAD, String(e.target.checked));
        });

        // === Сворачивание панели ===
        document.getElementById('sfh-collapse').onclick = () => {
            const body = document.getElementById('sfh-body');
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            localStorage.setItem(LS_COLLAPSED, String(!isHidden));
        };

        // === Обработчики ===
        document.getElementById('sfh-mark-btn').onclick = handleMarkAbsences;
        document.getElementById('sfh-remove-btn').onclick = handleRemoveAbsences;
        document.getElementById('sfh-stop-btn').onclick = () => { state.cancel = true; };
        document.getElementById('sfh-reload-cancel').onclick = () => { state.cancelReload = true; };
    }

    function showStatus(msg, type) {
        const el = document.getElementById('sfh-status');
        if (!el) return;
        el.textContent = msg;
        el.className = type;
        el.style.display = 'block';
    }

    // === ПАРСИНГ ВЫБОРА (с отчётом о нераспознанных токенах) ===
    function parseSelection(input, maxItems, numericOnly) {
        const sel = new Set();
        const bad = [];
        if (!input.trim()) return { sel, bad };
        const parts = input.replace(/[,;]/g, ' ').split(/\s+/).filter(x => x);
        for (const p of parts) {
            if (p === 'all' || p === 'все' || p === '*') {
                for (let i = 1; i <= maxItems; i++) sel.add(i);
            } else if (p.includes('-')) {
                const [a, b] = p.split('-').map(Number);
                if (!isNaN(a) && !isNaN(b)) {
                    const start = Math.max(1, Math.min(a, b));
                    const end = Math.min(maxItems, Math.max(a, b));
                    for (let i = start; i <= end; i++) sel.add(i);
                } else bad.push(p);
            } else if (p.includes('.')) {
                const [pair, hour] = p.split('.').map(Number);
                if (!isNaN(pair) && !isNaN(hour)) {
                    if (numericOnly) bad.push(p);
                    else sel.add({ pair, hour });
                } else bad.push(p);
            } else {
                const n = parseInt(p);
                if (!isNaN(n) && n >= 1 && n <= maxItems) sel.add(n);
                else bad.push(p);
            }
        }
        return { sel, bad };
    }

    function parseStudents() {
        const students = [];
        const rows = document.querySelectorAll('table.table-prog tbody tr');
        rows.forEach((row, idx) => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 3) return;
            const fio = cols[1].textContent.trim();
            const hours = [];
            for (let i = 2; i < cols.length; i++) {
                const cell = cols[i];
                const nb = cell.getAttribute('data-nb');
                if (nb) {
                    try {
                        const h = JSON.parse(nb);
                        h.alreadyNb = cell.hasAttribute('data-params');
                        h.cell = cell;
                        hours.push(h);
                    } catch (e) { }
                }
            }
            students.push({ idx: idx + 1, fio, hours });
        });
        return students;
    }

    function groupHoursByPair(hours) {
        const pairs = [];
        let cur = null;
        for (const h of hours) {
            if (!cur || cur[0].zid !== h.zid) {
                cur = [];
                pairs.push(cur);
            }
            cur.push(h);
        }
        return pairs;
    }

    function getSelectedHours(pairs, sel) {
        const res = [];
        for (const item of sel) {
            if (typeof item === 'number') {
                const i = item - 1;
                if (i >= 0 && i < pairs.length) res.push(...pairs[i]);
            } else if (item.pair && item.hour) {
                const i = item.pair - 1;
                if (i >= 0 && i < pairs.length) {
                    const pair = pairs[i];
                    const h = item.hour - 1;
                    if (h >= 0 && h < pair.length) res.push(pair[h]);
                }
            }
        }
        return res;
    }

    // правка ячейки на странице без перезагрузки
    function patchCell(h, action, reason) {
        const cell = h.cell;
        if (!cell) return;
        if (action === 'mark') {
            cell.classList.remove('success');
            cell.classList.add('danger');
            cell.setAttribute('data-params', JSON.stringify({ nb: '1', reason: '', type: reason }));
            cell.textContent = '-';
            h.alreadyNb = true;
        } else {
            cell.classList.remove('danger', 'success');
            cell.removeAttribute('data-params');
            cell.textContent = '\u00A0';
            h.alreadyNb = false;
        }
    }

    function sendMark(url, h, reason, action) {
        return new Promise(resolve => {
            const fd = new FormData();
            fd.append('userid', h.userid);
            fd.append('zid', h.zid);
            fd.append('hour', h.hour);
            if (action === 'remove') {
                fd.append('type', '0');
                fd.append('reason', '');
            } else {
                fd.append('nb', 'on');
                fd.append('type', reason);
                fd.append('reason', '');
            }
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                data: fd,
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                onload: r => {
                    if (r.status !== 200) return resolve(false);
                    try {
                        const j = JSON.parse(r.responseText);
                        if (j && j.success === false) return resolve(false);
                    } catch (e) { /* не JSON — считаем успехом по 200 */ }
                    resolve(true);
                },
                onerror: () => resolve(false)
            });
        });
    }

    async function sendMarkRetry(url, h, reason, action) {
        let ok = await sendMark(url, h, reason, action);
        if (!ok) {
            await sleep(150);
            ok = await sendMark(url, h, reason, action);
        }
        return ok;
    }

    async function handleMarkAbsences() { await markOrRemoveAbsences('mark'); }
    async function handleRemoveAbsences() { await markOrRemoveAbsences('remove'); }

    async function markOrRemoveAbsences(action) {
        if (state.running) return;

        const inpStudents = document.getElementById('sfh-students');
        const inpPairs = document.getElementById('sfh-pairs');
        const reason = document.getElementById('sfh-reason').value;

        saveLastInputs();

        const allStuds = parseStudents();
        if (!allStuds.length) return showStatus('❌ Студенты не найдены', 'error');

        const { sel: studSel, bad: badStudents } = parseSelection(inpStudents.value, allStuds.length, true);
        if (!studSel.size) {
            return showStatus(
                badStudents.length ? `❌ Не распознано: ${badStudents.join(', ')}` : '❌ Не выбраны студенты',
                'error'
            );
        }

        const selected = allStuds.filter(s => Array.from(studSel).some(x => typeof x === 'number' && x === s.idx));
        if (!selected.length) return showStatus('❌ Нет подходящих студентов', 'error');

        const tasks = [];
        let skippedState = 0;
        const url = location.href.split('#')[0];

        for (const s of selected) {
            const pairs = groupHoursByPair(s.hours);
            const { sel: pairSel, bad: badPairs } = parseSelection(inpPairs.value, pairs.length, false);
            const hours = getSelectedHours(pairs, pairSel);
            // mark: пропускаем уже отмеченные; remove: только отмеченные
            for (const h of hours) {
                if (action === 'mark' && h.alreadyNb) { skippedState++; continue; }
                if (action === 'remove' && !h.alreadyNb) { skippedState++; continue; }
                tasks.push({ student: s.fio, hour: h, idx: s.idx });
            }
        }

        const warnParts = [];
        if (badStudents.length) warnParts.push(`студенты: ${badStudents.join(', ')}`);

        if (!tasks.length) {
            let msg = skippedState
                ? `${action === 'mark' ? 'Все выбранные часы уже отмечены' : 'Среди выбранных нет отмеченных часов'} (${skippedState})`
                : '❌ Нет часов для обработки';
            if (warnParts.length) msg += ' · ⚠️ ' + warnParts.join('; ');
            return showStatus(msg, 'error');
        }

        state.running = true;
        state.cancel = false;
        state.cancelReload = false;

        const btnMark = document.getElementById('sfh-mark-btn');
        const btnRemove = document.getElementById('sfh-remove-btn');
        const btnStop = document.getElementById('sfh-stop-btn');
        const resultEl = document.getElementById('sfh-result');
        const reloadEl = document.getElementById('sfh-reload');
        btnMark.disabled = true;
        btnRemove.disabled = true;
        btnStop.style.display = 'block';
        resultEl.style.display = 'none';
        reloadEl.style.display = 'none';

        let done = 0, ok = 0;
        const affected = new Set();
        const failures = [];

        for (const t of tasks) {
            if (state.cancel) break;
            const res = await sendMarkRetry(url, t.hour, reason, action);
            done++;
            if (res) {
                ok++;
                affected.add(t.idx);
                patchCell(t.hour, action, reason);
            } else {
                failures.push(`${t.idx}. ${t.student}`);
            }
            showStatus(`⏳ Обработка… ${done}/${tasks.length}`, 'info');
            await sleep(80);
        }

        btnMark.disabled = false;
        btnRemove.disabled = false;
        btnStop.style.display = 'none';
        state.running = false;

        const parts = [];
        parts.push(state.cancel ? `⏹ Остановлено: ${ok}/${done} из ${tasks.length}` : `✅ Готово! Успешно: ${ok}/${tasks.length}`);
        if (skippedState) parts.push(`пропущено (уже в состоянии): ${skippedState}`);
        if (failures.length) parts.push(`сбоев: ${failures.length} (${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''})`);
        if (warnParts.length) parts.push(`⚠️ не распознано — ${warnParts.join('; ')}`);
        showStatus(parts.join(' · '), failures.length ? 'error' : 'success');

        if (affected.size) {
            resultEl.textContent = `${action === 'mark' ? '✅ Отмечено' : '🗑 Удалено'} у студентов: ${affected.size}`;
            resultEl.style.display = 'block';
        }

        updateSkipCounter();

        // автообновление с возможностью отмены
        const autoreload = localStorage.getItem(LS_AUTORELOAD) !== 'false';
        if (ok > 0 && autoreload && !state.cancel) {
            let n = 3;
            reloadEl.style.display = 'block';
            const tick = () => {
                if (state.cancelReload) { reloadEl.style.display = 'none'; return; }
                if (n <= 0) { location.reload(); return; }
                document.getElementById('sfh-reload-num').textContent = n--;
                setTimeout(tick, 1000);
            };
            tick();
        }
    }

    function saveLastInputs() {
        localStorage.setItem(LS_LAST, JSON.stringify({
            students: document.getElementById('sfh-students').value,
            pairs: document.getElementById('sfh-pairs').value,
            reason: document.getElementById('sfh-reason').value
        }));
    }

    // === ЗАПУСК ===
    function init() {
        createUI();
        updateSkipCounter();
        observeTableMutations();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // === АВТООБНОВЛЕНИЕ ПРИ СМЕНЕ ТЕМЫ ===
    // реагируем на классы, атрибут data-theme (PskStyle), localStorage и системную тему
    function rebuildIfThemeChanged() {
        const newTheme = detectTheme();
        if (document.body.dataset.sfhTheme === newTheme) return;
        document.body.dataset.sfhTheme = newTheme;
        ['#sfh-panel', '#sfh-theme-style'].forEach(id => {
            const el = document.querySelector(id);
            if (el) el.remove();
        });
        init();
    }

    const themeObserver = new MutationObserver(rebuildIfThemeChanged);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    window.addEventListener('storage', (e) => {
        if (e.key === 'shs-theme') rebuildIfThemeChanged();
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuildIfThemeChanged);

    // пересчёт позиции панели при изменении размеров окна
    window.addEventListener('resize', () => {
        const p = document.getElementById('sfh-panel');
        if (p && p.style.position === 'fixed') anchorPanelNextToTable();
    });
})();
