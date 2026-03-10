// ==UserScript==
// @name         NotebookLM Project Categorizer Pro
// @namespace    https://github.com/muharamdani
// @version      2.3.0
// @description  Adds category filters to NotebookLM projects with import/export, inline manager, drag & drop ordering, regex support, manual category assignment, configurable control layout and visibility, and protected controls that do not open the notebook when clicked.
// @author       muharamdani + B2T S.r.l. + ChatGPT
// @match        https://notebooklm.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.co
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_download
// @require      https://cdn.jsdelivr.net/npm/arrive@2.4.1/minified/arrive.min.js
// ==/UserScript==

(function() {
    'use strict';

    const DEFAULT_CATEGORY_ORDER = ['All', 'Tutorial', 'Finance', 'Other'];

    const DEFAULT_CATEGORY_RULES = {
        All: { matcher: 'keyword', patterns: [] },
        Tutorial: { matcher: 'keyword', patterns: ['How to', 'Course', 'Lecture', 'Tutorial'] },
        Finance: { matcher: 'keyword', patterns: ['Investing', 'Gold', 'Stocks', 'Bonds', 'Funds'] },
        Other: { matcher: 'keyword', patterns: [] }
    };

    const DEFAULT_PREFERENCES = {
        controlLayout: 'right',      // right | below
        controlVisibility: 'always'  // always | hover
    };

    const STORAGE_KEYS = {
        activeFilter: 'notebooklm_active_filter',
        config: 'notebooklm_category_config_v2',
        manualAssignments: 'notebooklm_manual_category_assignments_v1',
        preferences: 'notebooklm_preferences_v2',
        exportBundleName: 'notebooklm-categories-export'
    };

    const SPECIAL_CATEGORIES = new Set(['All', 'Other']);

    let state = loadConfig();
    let manualAssignments = loadManualAssignments();
    let preferences = loadPreferences();

    GM_addStyle(`
        .category-filter-container {
            padding: 10px 15px;
            margin-bottom: 15px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
        }

        .category-filter-button,
        .category-action-button,
        .nlm-btn,
        .nlm-manual-select,
        .nlm-mini-btn {
            padding: 8px 14px;
            border: 1px solid #ccc;
            border-radius: 16px;
            background-color: #f8f8f8;
            color: #333;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.2s, color 0.2s, box-shadow 0.2s, border-color 0.2s;
        }

        .category-filter-button:hover,
        .category-action-button:hover,
        .nlm-btn:hover,
        .nlm-mini-btn:hover {
            background-color: #eee;
            border-color: #bbb;
        }

        .category-filter-button.active {
            background-color: #4285f4;
            color: white;
            border-color: #4285f4;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .category-controls-separator {
            width: 1px;
            height: 28px;
            background: #ddd;
            margin: 0 4px;
        }

        project-button[data-filtered="hidden"],
        tr.mat-mdc-row[data-filtered="hidden"] {
            display: none !important;
        }

        .nlm-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .nlm-modal {
            width: min(1100px, 96vw);
            max-height: 90vh;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 20px;
            font-family: Arial, sans-serif;
            color: #222;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .nlm-modal-scrollable {
            flex: 1 1 auto;
            overflow-y: auto;
            min-height: 0;
        }

        .nlm-modal h2 {
            margin: 0 0 10px 0;
            font-size: 1.3rem;
        }

        .nlm-modal p {
            margin: 0 0 14px 0;
            color: #555;
        }

        .nlm-category-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .nlm-category-row {
            display: grid;
            grid-template-columns: 40px 220px 140px 1fr auto;
            gap: 10px;
            align-items: start;
            padding: 12px;
            border: 1px solid #eee;
            border-radius: 12px;
            background: #fafafa;
        }

        .nlm-category-row.dragging {
            opacity: 0.55;
        }

        .nlm-category-row.drag-over {
            border-color: #4285f4;
            background: #f2f7ff;
        }

        .nlm-drag-handle {
            user-select: none;
            cursor: grab;
            text-align: center;
            padding-top: 10px;
            font-size: 18px;
            color: #666;
        }

        .nlm-drag-handle:active {
            cursor: grabbing;
        }

        .nlm-field label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
        }

        .nlm-category-row input[type="text"],
        .nlm-category-row select,
        .nlm-category-row textarea,
        .nlm-add-row input[type="text"],
        .nlm-add-row select,
        .nlm-pref-row select {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 14px;
            background: #fff;
            color: #222;
        }

        .nlm-category-row textarea {
            min-height: 72px;
            resize: vertical;
            font-family: inherit;
        }

        .nlm-category-row.locked input,
        .nlm-category-row.locked textarea,
        .nlm-category-row.locked select {
            background: #f7f7f7;
        }

        .nlm-modal-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 18px;
            flex-shrink: 0;
            padding-top: 14px;
            border-top: 1px solid #eee;
        }

        .nlm-btn.primary {
            background: #4285f4;
            border-color: #4285f4;
            color: white;
            font-weight: bold;
        }

        .nlm-btn.danger {
            background: #fff4f4;
            border-color: #e0b4b4;
            color: #b00020;
        }

        .nlm-add-row {
            display: grid;
            grid-template-columns: 220px 140px 1fr auto;
            gap: 10px;
            align-items: center;
            margin-top: 18px;
            padding-top: 14px;
            border-top: 2px solid #eee;
        }

        .nlm-pref-row {
            display: grid;
            grid-template-columns: 220px 260px 1fr;
            gap: 10px;
            align-items: center;
            margin: 0 0 12px 0;
            padding: 12px;
            border: 1px solid #eee;
            border-radius: 12px;
            background: #fafafa;
        }

        .nlm-note {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }

        .nlm-project-tools {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            position: relative;
            z-index: 5;
            transition: opacity 0.15s ease, visibility 0.15s ease;
        }

        .nlm-project-tools.layout-below {
            margin-top: 6px;
        }

        .nlm-project-tools.layout-right {
            margin-left: auto;
            justify-content: flex-end;
        }

        .nlm-project-tools.visibility-hover {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        project-button:hover .nlm-project-tools.visibility-hover,
        tr.mat-mdc-row:hover .nlm-project-tools.visibility-hover,
        project-button:focus-within .nlm-project-tools.visibility-hover,
        tr.mat-mdc-row:focus-within .nlm-project-tools.visibility-hover,
        .nlm-project-tools.visibility-hover:hover,
        .nlm-project-tools.visibility-hover:focus-within {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }

        .nlm-manual-select {
            padding: 4px 8px;
            border-radius: 10px;
            font-size: 12px;
            min-width: 130px;
            background: #fff;
            position: relative;
            z-index: 6;
        }

        .nlm-mini-btn {
            padding: 4px 8px;
            font-size: 12px;
            border-radius: 10px;
            position: relative;
            z-index: 6;
        }

        .nlm-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            padding: 2px 8px;
            font-size: 11px;
            background: #eef4ff;
            color: #2457b2;
            border: 1px solid #cfe0ff;
            position: relative;
            z-index: 6;
        }

        .nlm-inline-host {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }

        .nlm-inline-host .project-button-title,
        .nlm-inline-host .project-table-title {
            min-width: 0;
            flex: 1 1 auto;
        }
    `);

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function createDefaultState() {
        return {
            order: [...DEFAULT_CATEGORY_ORDER],
            categories: deepClone(DEFAULT_CATEGORY_RULES)
        };
    }

    function normalizeCategoryRule(name, rule) {
        const safeRule = rule && typeof rule === 'object' ? rule : {};
        const matcher = safeRule.matcher === 'regex' ? 'regex' : 'keyword';
        const patterns = Array.isArray(safeRule.patterns) ? safeRule.patterns.map(v => String(v)).filter(Boolean) : [];

        if (name === 'All') {
            return { matcher: 'keyword', patterns: [] };
        }

        return { matcher, patterns };
    }

    function normalizeConfig(raw) {
        const fallback = createDefaultState();

        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return fallback;
        }

        const rawCategories = raw.categories && typeof raw.categories === 'object' && !Array.isArray(raw.categories)
            ? raw.categories
            : raw;

        const names = new Set(Object.keys(rawCategories));
        names.add('All');
        names.add('Other');

        let order = Array.isArray(raw.order) ? raw.order.map(String) : Object.keys(rawCategories);
        order = order.filter(name => names.has(name));

        if (!order.includes('All')) {
            order.unshift('All');
        } else {
            order = order.filter(name => name !== 'All');
            order.unshift('All');
        }

        order = order.filter(name => name !== 'Other');
        order.push('Other');

        const categories = {};
        for (const name of order) {
            categories[name] = normalizeCategoryRule(name, rawCategories[name]);
        }

        return { order, categories };
    }

    function normalizePreferences(raw) {
        const prefs = {
            ...DEFAULT_PREFERENCES,
            ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})
        };

        if (!['right', 'below'].includes(prefs.controlLayout)) {
            prefs.controlLayout = DEFAULT_PREFERENCES.controlLayout;
        }

        if (!['always', 'hover'].includes(prefs.controlVisibility)) {
            prefs.controlVisibility = DEFAULT_PREFERENCES.controlVisibility;
        }

        return prefs;
    }

    function loadConfig() {
        const saved = GM_getValue(STORAGE_KEYS.config, null);
        return normalizeConfig(saved);
    }

    function saveConfig(nextState) {
        state = normalizeConfig(nextState);
        GM_setValue(STORAGE_KEYS.config, state);
        GM_log('Saved config:', state);
    }

    function loadManualAssignments() {
        const saved = GM_getValue(STORAGE_KEYS.manualAssignments, null);
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            return {};
        }
        return saved;
    }

    function saveManualAssignments(nextAssignments) {
        manualAssignments = nextAssignments && typeof nextAssignments === 'object' ? nextAssignments : {};
        GM_setValue(STORAGE_KEYS.manualAssignments, manualAssignments);
        GM_log('Saved manual assignments:', manualAssignments);
    }

    function loadPreferences() {
        return normalizePreferences(GM_getValue(STORAGE_KEYS.preferences, null));
    }

    function savePreferences(nextPreferences) {
        preferences = normalizePreferences(nextPreferences);
        GM_setValue(STORAGE_KEYS.preferences, preferences);
        GM_log('Saved preferences:', preferences);
    }

    function getCategoryNames() {
        return [...state.order];
    }

    function isSpecialCategory(name) {
        return SPECIAL_CATEGORIES.has(name);
    }

    function getProjectElements() {
        return Array.from(document.querySelectorAll('project-button, tr.mat-mdc-row'));
    }

    function getTitleElement(projectElement) {
        return projectElement.querySelector('.project-button-title, .project-table-title');
    }

    function getProjectTitle(projectElement) {
        const titleElement = getTitleElement(projectElement);
        return titleElement ? titleElement.textContent.trim() : '';
    }

    function getProjectKey(projectElement) {
        const title = getProjectTitle(projectElement);
        if (!title) return null;
        return title.toLowerCase();
    }

    function safeRegexMatch(pattern, text) {
        try {
            const re = new RegExp(pattern, 'i');
            return re.test(text);
        } catch (err) {
            return false;
        }
    }

    function matchesCategoryRule(rule, title) {
        if (!rule || !title) return false;
        const text = title.toLowerCase().trim();

        if (rule.matcher === 'regex') {
            return (rule.patterns || []).some(pattern => safeRegexMatch(pattern, title));
        }

        return (rule.patterns || []).some(keyword => text.includes(String(keyword).toLowerCase()));
    }

    function getProjectCategory(projectElement) {
        const key = getProjectKey(projectElement);
        const title = getProjectTitle(projectElement);

        if (!title) return 'Other';

        if (key && manualAssignments[key] && state.categories[manualAssignments[key]]) {
            return manualAssignments[key];
        }

        for (const categoryName of state.order) {
            if (categoryName === 'All' || categoryName === 'Other') continue;
            if (matchesCategoryRule(state.categories[categoryName], title)) {
                return categoryName;
            }
        }

        if (matchesCategoryRule(state.categories.Other, title)) {
            return 'Other';
        }

        return 'Other';
    }

    function updateButtonCounts() {
        const projectButtons = getProjectElements();
        const categoryCounts = {};

        for (const name of getCategoryNames()) {
            categoryCounts[name] = 0;
        }
        categoryCounts.All = projectButtons.length;

        projectButtons.forEach(proj => {
            const category = getProjectCategory(proj);
            if (categoryCounts[category] !== undefined) {
                categoryCounts[category]++;
            }
        });

        document.querySelectorAll('.category-filter-button').forEach(btn => {
            const categoryName = btn.getAttribute('data-category');
            if (categoryName && categoryCounts[categoryName] !== undefined) {
                btn.textContent = `${categoryName} (${categoryCounts[categoryName]})`;
            }
        });
    }

    function filterProjects(selectedCategory) {
        const safeCategory = state.categories[selectedCategory] ? selectedCategory : 'All';

        getProjectElements().forEach(proj => {
            const projectCategory = getProjectCategory(proj);
            if (safeCategory === 'All' || projectCategory === safeCategory) {
                proj.setAttribute('data-filtered', 'visible');
            } else {
                proj.setAttribute('data-filtered', 'hidden');
            }
        });

        document.querySelectorAll('.category-filter-button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-category') === safeCategory);
        });

        GM_setValue(STORAGE_KEYS.activeFilter, safeCategory);
    }

    function getSavedFilter() {
        const saved = GM_getValue(STORAGE_KEYS.activeFilter, 'All');
        return state.categories[saved] ? saved : 'All';
    }

    function rebuildUI() {
        const existing = document.querySelector('.category-filter-container');
        if (existing) existing.remove();

        document.querySelectorAll('.nlm-project-tools').forEach(el => el.remove());
        document.querySelectorAll('.nlm-inline-host').forEach(host => {
            if (host.dataset.nlmGenerated === '1') {
                const title = host.querySelector('.project-button-title, .project-table-title');
                if (title && host.parentNode) {
                    host.parentNode.insertBefore(title, host);
                }
                host.remove();
            }
        });

        const targetContainer = document.querySelector('.project-buttons-flow, table.mdc-data-table__table, .project-cards-container');
        if (targetContainer) {
            createFilterUI(targetContainer);
        } else {
            // Fallback: find the parent of the first project element
            const firstProject = document.querySelector('project-button, tr.mat-mdc-row');
            if (firstProject && firstProject.parentElement) {
                createFilterUI(firstProject.parentElement);
            }
        }

        decorateProjects();
        updateButtonCounts();
        filterProjects(getSavedFilter());
    }

    function exportPayload() {
        return {
            version: 4,
            exportedAt: new Date().toISOString(),
            activeFilter: getSavedFilter(),
            config: state,
            manualAssignments,
            preferences
        };
    }

    async function saveTextFileWithPicker(filename, content) {
        if (typeof window.showSaveFilePicker !== 'function') {
            return false;
        }

        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [
                    {
                        description: 'JSON file',
                        accept: {
                            'application/json': ['.json']
                        }
                    }
                ]
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return 'cancelled';
            }
            console.error('showSaveFilePicker failed:', err);
            return false;
        }
    }

    function gmDownloadWithSaveAs(filename, content) {
        return new Promise((resolve) => {
            if (typeof GM_download !== 'function') {
                resolve(false);
                return;
            }

            const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            try {
                GM_download({
                    url,
                    name: filename,
                    saveAs: true,
                    onload: () => {
                        URL.revokeObjectURL(url);
                        resolve(true);
                    },
                    onerror: (err) => {
                        console.error('GM_download failed:', err);
                        URL.revokeObjectURL(url);
                        resolve(false);
                    },
                    ontimeout: () => {
                        URL.revokeObjectURL(url);
                        resolve(false);
                    }
                });
            } catch (err) {
                console.error('GM_download exception:', err);
                URL.revokeObjectURL(url);
                resolve(false);
            }
        });
    }

    function fallbackDownload(filename, content) {
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function exportCategories() {
        try {
            const payload = exportPayload();
            const content = JSON.stringify(payload, null, 2);
            const filename = `${STORAGE_KEYS.exportBundleName}-${new Date().toISOString().slice(0, 10)}.json`;

            const pickerResult = await saveTextFileWithPicker(filename, content);
            if (pickerResult === true || pickerResult === 'cancelled') return;

            const gmResult = await gmDownloadWithSaveAs(filename, content);
            if (gmResult) return;

            fallbackDownload(filename, content);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Errore durante l’esportazione.');
        }
    }

    function validateImportedPayload(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

        const config = obj.config || obj;
        const categories = config.categories || config;
        if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return false;

        for (const [key, rule] of Object.entries(categories)) {
            if (typeof key !== 'string') return false;

            if (rule && typeof rule === 'object' && !Array.isArray(rule)) {
                if (rule.matcher !== undefined && !['keyword', 'regex'].includes(rule.matcher)) return false;
                if (rule.patterns !== undefined && !Array.isArray(rule.patterns)) return false;
            } else if (!Array.isArray(rule)) {
                return false;
            }
        }

        return true;
    }

    function normalizeImportedPayload(obj) {
        const configCandidate = obj.config || obj;
        const config = normalizeConfig(configCandidate);

        const activeFilter = typeof obj.activeFilter === 'string' && config.categories[obj.activeFilter]
            ? obj.activeFilter
            : 'All';

        const assignments = obj.manualAssignments && typeof obj.manualAssignments === 'object' && !Array.isArray(obj.manualAssignments)
            ? obj.manualAssignments
            : {};

        const importedPreferences = normalizePreferences(obj.preferences || null);

        return {
            config,
            activeFilter,
            manualAssignments: assignments,
            preferences: importedPreferences
        };
    }

    function importCategoriesFromFile(file) {
        const reader = new FileReader();

        reader.onload = event => {
            try {
                const parsed = JSON.parse(event.target.result);

                if (!validateImportedPayload(parsed)) {
                    alert('File JSON non valido o formato non riconosciuto.');
                    return;
                }

                const normalized = normalizeImportedPayload(parsed);
                saveConfig(normalized.config);
                saveManualAssignments(normalized.manualAssignments);
                savePreferences(normalized.preferences);
                GM_setValue(STORAGE_KEYS.activeFilter, normalized.activeFilter);

                rebuildUI();
                alert('Import completato.');
            } catch (err) {
                console.error('Import failed:', err);
                alert('Errore durante l’importazione del JSON.');
            }
        };

        reader.readAsText(file);
    }

    function triggerImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';

        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (file) {
                importCategoriesFromFile(file);
            }
            input.remove();
        });

        document.body.appendChild(input);
        input.click();
    }

    function parsePatterns(text) {
        return text
            .split('\n')
            .flatMap(line => line.split(','))
            .map(s => s.trim())
            .filter(Boolean);
    }

    function escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function makeEditableStateCopy() {
        const copy = deepClone(state);
        copy.order = normalizeConfig(copy).order;
        copy.categories = normalizeConfig(copy).categories;
        return copy;
    }

    function protectInteractiveControl(element) {
        const stopHard = (e) => {
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
        };

        [
            'click',
            'dblclick',
            'mousedown',
            'mouseup',
            'pointerdown',
            'pointerup',
            'touchstart',
            'touchend'
        ].forEach(eventName => {
            element.addEventListener(eventName, stopHard, true);
        });

        element.addEventListener('keydown', (e) => {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
                stopHard(e);
            }
        }, true);

        element.onclick = (e) => e.stopPropagation();
        element.onmousedown = (e) => e.stopPropagation();
        element.onpointerdown = (e) => e.stopPropagation();
    }

    function openCategoryManager() {
        const overlay = document.createElement('div');
        overlay.className = 'nlm-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'nlm-modal';

        let editorState = makeEditableStateCopy();
        let editorPreferences = deepClone(preferences);
        let draggedName = null;

        function getRowsDataFromDOM() {
            const rows = Array.from(modal.querySelectorAll('.nlm-category-row'));
            const order = [];
            const categories = {};

            rows.forEach(row => {
                const originalName = row.getAttribute('data-original-name');
                const nameInput = row.querySelector('.nlm-name');
                const matcherSelect = row.querySelector('.nlm-matcher');
                const patternsInput = row.querySelector('.nlm-patterns');

                let finalName = originalName;
                if (nameInput && !nameInput.disabled) {
                    finalName = nameInput.value.trim();
                }

                if (!finalName) return;

                let matcher = matcherSelect ? matcherSelect.value : 'keyword';
                if (finalName === 'All') matcher = 'keyword';

                categories[finalName] = {
                    matcher,
                    patterns: finalName === 'All' ? [] : parsePatterns(patternsInput ? patternsInput.value : '')
                };

                order.push(finalName);
            });

            return normalizeConfig({ order, categories });
        }

        function getPreferencesFromDOM() {
            const layoutSelect = modal.querySelector('.nlm-pref-layout');
            const visibilitySelect = modal.querySelector('.nlm-pref-visibility');

            return normalizePreferences({
                controlLayout: layoutSelect ? layoutSelect.value : editorPreferences.controlLayout,
                controlVisibility: visibilitySelect ? visibilitySelect.value : editorPreferences.controlVisibility
            });
        }

        function persistManagerEditsToMemory() {
            editorState = getRowsDataFromDOM();
            editorPreferences = getPreferencesFromDOM();
        }

        function closeModal() {
            overlay.remove();
        }

        function render() {
            const rowsHtml = editorState.order.map(categoryName => {
                const rule = editorState.categories[categoryName] || { matcher: 'keyword', patterns: [] };
                const isLocked = isSpecialCategory(categoryName);
                const patternsText = (rule.patterns || []).join('\n');

                return `
                    <div class="nlm-category-row ${isLocked ? 'locked' : ''}" data-original-name="${escapeHtml(categoryName)}" draggable="${isLocked ? 'false' : 'true'}">
                        <div class="nlm-drag-handle" title="${isLocked ? 'Categoria fissa' : 'Trascina per riordinare'}">${isLocked ? '•' : '☰'}</div>

                        <div class="nlm-field">
                            <label>Category</label>
                            <input type="text" class="nlm-name" value="${escapeHtml(categoryName)}" ${isLocked ? 'disabled' : ''}>
                            <div class="nlm-note">${isLocked ? 'Categoria speciale protetta' : 'Nome categoria'}</div>
                        </div>

                        <div class="nlm-field">
                            <label>Matcher</label>
                            <select class="nlm-matcher" ${categoryName === 'All' ? 'disabled' : ''}>
                                <option value="keyword" ${rule.matcher === 'keyword' ? 'selected' : ''}>keyword</option>
                                <option value="regex" ${rule.matcher === 'regex' ? 'selected' : ''}>regex</option>
                            </select>
                            <div class="nlm-note">${categoryName === 'All' ? 'Non usa pattern' : 'Tipo di confronto'}</div>
                        </div>

                        <div class="nlm-field">
                            <label>Patterns</label>
                            <textarea class="nlm-patterns" ${categoryName === 'All' ? 'disabled' : ''}>${escapeHtml(patternsText)}</textarea>
                            <div class="nlm-note">${categoryName === 'All' ? 'Vuota per definizione' : 'Una per riga oppure separate da virgola'}</div>
                        </div>

                        <div>
                            ${isLocked ? '' : '<button class="nlm-btn danger nlm-delete" type="button">Delete</button>'}
                        </div>
                    </div>
                `;
            }).join('');

            modal.innerHTML = `
                <h2>Manage Categories</h2>
                <p>Puoi riordinare le categorie trascinandole, usare matcher keyword o regex, aggiungere nuove categorie, importare/esportare e scegliere layout e visibilità dei controlli.</p>

                <div class="nlm-modal-scrollable">
                    <div class="nlm-pref-row">
                        <div class="nlm-field">
                            <label>Control layout</label>
                        </div>
                        <div>
                            <select class="nlm-pref-layout">
                                <option value="right" ${editorPreferences.controlLayout === 'right' ? 'selected' : ''}>Inline right</option>
                                <option value="below" ${editorPreferences.controlLayout === 'below' ? 'selected' : ''}>Below title</option>
                            </select>
                        </div>
                        <div class="nlm-note">Determina dove mostrare i controlli di categoria manuale per ogni notebook.</div>
                    </div>

                    <div class="nlm-pref-row">
                        <div class="nlm-field">
                            <label>Control visibility</label>
                        </div>
                        <div>
                            <select class="nlm-pref-visibility">
                                <option value="always" ${editorPreferences.controlVisibility === 'always' ? 'selected' : ''}>Always visible</option>
                                <option value="hover" ${editorPreferences.controlVisibility === 'hover' ? 'selected' : ''}>Show on hover</option>
                            </select>
                        </div>
                        <div class="nlm-note">Con hover i controlli appaiono al passaggio del mouse o quando il notebook riceve focus.</div>
                    </div>

                    <div class="nlm-category-list">
                        ${rowsHtml}
                    </div>

                    <div class="nlm-add-row">
                        <input type="text" class="nlm-new-name" placeholder="New category name">
                        <select class="nlm-new-matcher">
                            <option value="keyword">keyword</option>
                            <option value="regex">regex</option>
                        </select>
                        <input type="text" class="nlm-new-patterns" placeholder="pattern1, pattern2 oppure regex">
                        <button class="nlm-btn nlm-add" type="button">Add</button>
                    </div>
                </div>

                <div class="nlm-modal-buttons">
                    <button class="nlm-btn" data-action="cancel" type="button">Cancel</button>
                    <button class="nlm-btn" data-action="reset" type="button">Reset defaults</button>
                    <button class="nlm-btn" data-action="export" type="button">Export</button>
                    <button class="nlm-btn" data-action="import" type="button">Import</button>
                    <button class="nlm-btn primary" data-action="save" type="button">Save</button>
                </div>
            `;

            bindModalEvents();
        }

        function bindDnD() {
            const rows = Array.from(modal.querySelectorAll('.nlm-category-row'));

            rows.forEach(row => {
                if (isSpecialCategory(row.getAttribute('data-original-name'))) {
                    return;
                }

                row.addEventListener('dragstart', () => {
                    persistManagerEditsToMemory();
                    draggedName = row.getAttribute('data-original-name');
                    row.classList.add('dragging');
                });

                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    rows.forEach(r => r.classList.remove('drag-over'));
                });

                row.addEventListener('dragover', e => {
                    e.preventDefault();
                    if (!draggedName) return;
                    row.classList.add('drag-over');
                });

                row.addEventListener('dragleave', () => {
                    row.classList.remove('drag-over');
                });

                row.addEventListener('drop', e => {
                    e.preventDefault();
                    row.classList.remove('drag-over');

                    const targetName = row.getAttribute('data-original-name');
                    if (!draggedName || !targetName || draggedName === targetName) return;
                    if (isSpecialCategory(targetName)) return;

                    const current = getRowsDataFromDOM();
                    const movable = current.order.filter(name => !isSpecialCategory(name));

                    const from = movable.indexOf(draggedName);
                    const to = movable.indexOf(targetName);
                    if (from < 0 || to < 0) return;

                    const reorderedMovable = [...movable];
                    const [item] = reorderedMovable.splice(from, 1);
                    reorderedMovable.splice(to, 0, item);

                    current.order = ['All', ...reorderedMovable, 'Other'];
                    editorState = normalizeConfig(current);
                    render();
                });
            });
        }

        function bindModalEvents() {
            bindDnD();

            // Fix BACK-003: disable draggable on parent row when interacting with
            // input/textarea/select so the browser can position the cursor normally.
            modal.querySelectorAll('.nlm-category-row input, .nlm-category-row textarea, .nlm-category-row select').forEach(field => {
                field.addEventListener('mousedown', () => {
                    const row = field.closest('.nlm-category-row');
                    if (row) row.setAttribute('draggable', 'false');
                });
                field.addEventListener('blur', () => {
                    const row = field.closest('.nlm-category-row');
                    if (row && !isSpecialCategory(row.getAttribute('data-original-name'))) {
                        row.setAttribute('draggable', 'true');
                    }
                });
            });

            modal.querySelectorAll('.nlm-delete').forEach(btn => {
                btn.addEventListener('click', e => {
                    const row = e.target.closest('.nlm-category-row');
                    if (!row) return;
                    row.remove();
                });
            });

            modal.querySelector('.nlm-add').addEventListener('click', () => {
                persistManagerEditsToMemory();

                const nameInput = modal.querySelector('.nlm-new-name');
                const matcherSelect = modal.querySelector('.nlm-new-matcher');
                const patternsInput = modal.querySelector('.nlm-new-patterns');

                const name = nameInput.value.trim();
                if (!name) {
                    alert('Inserisci un nome categoria.');
                    return;
                }

                if (isSpecialCategory(name)) {
                    alert('Nome riservato.');
                    return;
                }

                const existing = new Set(editorState.order.map(n => n.toLowerCase()));
                if (existing.has(name.toLowerCase())) {
                    alert('Esiste già una categoria con questo nome.');
                    return;
                }

                editorState.categories[name] = {
                    matcher: matcherSelect.value === 'regex' ? 'regex' : 'keyword',
                    patterns: parsePatterns(patternsInput.value)
                };

                editorState.order = ['All', ...editorState.order.filter(n => n !== 'All' && n !== 'Other'), name, 'Other'];
                render();
            });

            modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);

            modal.querySelector('[data-action="reset"]').addEventListener('click', () => {
                if (!confirm('Ripristinare le categorie di default?')) return;
                editorState = createDefaultState();
                editorPreferences = deepClone(DEFAULT_PREFERENCES);
                render();
            });

            modal.querySelector('[data-action="export"]').addEventListener('click', async () => {
                persistManagerEditsToMemory();
                const oldState = state;
                const oldPreferences = preferences;
                state = normalizeConfig(editorState);
                preferences = normalizePreferences(editorPreferences);
                await exportCategories();
                state = oldState;
                preferences = oldPreferences;
            });

            modal.querySelector('[data-action="import"]').addEventListener('click', () => {
                closeModal();
                triggerImport();
            });

            modal.querySelector('[data-action="save"]').addEventListener('click', () => {
                const nextState = getRowsDataFromDOM();
                const nextPreferences = getPreferencesFromDOM();

                const lowered = new Set();
                for (const name of nextState.order) {
                    const k = name.toLowerCase();
                    if (lowered.has(k)) {
                        alert(`Nome categoria duplicato: ${name}`);
                        return;
                    }
                    lowered.add(k);
                }

                saveConfig(nextState);
                savePreferences(nextPreferences);
                rebuildUI();
                closeModal();
            });
        }

        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });

        render();
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function ensureInlineHost(titleElement) {
        const parent = titleElement.parentElement;
        if (!parent) return null;

        if (parent.classList.contains('nlm-inline-host')) {
            return parent;
        }

        const host = document.createElement('div');
        host.className = 'nlm-inline-host';
        host.dataset.nlmGenerated = '1';

        parent.insertBefore(host, titleElement);
        host.appendChild(titleElement);

        return host;
    }

    function ensureManualTools(projectElement) {
        if (projectElement.querySelector('.nlm-project-tools')) {
            return;
        }

        const titleElement = getTitleElement(projectElement);
        if (!titleElement) return;

        const projectKey = getProjectKey(projectElement);
        if (!projectKey) return;

        const container = document.createElement('div');
        container.className = `nlm-project-tools layout-${preferences.controlLayout} visibility-${preferences.controlVisibility}`;

        const badge = document.createElement('span');
        badge.className = 'nlm-pill';
        badge.textContent = 'Category';
        badge.tabIndex = 0;

        const select = document.createElement('select');
        select.className = 'nlm-manual-select';

        const autoOption = document.createElement('option');
        autoOption.value = '';
        autoOption.textContent = 'Auto';
        select.appendChild(autoOption);

        getCategoryNames()
            .filter(name => name !== 'All')
            .forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });

        select.value = manualAssignments[projectKey] || '';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'nlm-mini-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.type = 'button';

        [container, badge, select, clearBtn].forEach(protectInteractiveControl);

        const stopHard = (e) => {
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
        };

        select.addEventListener('change', (e) => {
            stopHard(e);

            if (select.value) {
                manualAssignments[projectKey] = select.value;
            } else {
                delete manualAssignments[projectKey];
            }

            saveManualAssignments(manualAssignments);
            updateProjectToolLabel(projectElement);
            updateButtonCounts();
            filterProjects(getSavedFilter());
        }, true);

        clearBtn.addEventListener('click', (e) => {
            stopHard(e);

            delete manualAssignments[projectKey];
            saveManualAssignments(manualAssignments);
            select.value = '';
            updateProjectToolLabel(projectElement);
            updateButtonCounts();
            filterProjects(getSavedFilter());
        }, true);

        container.appendChild(badge);
        container.appendChild(select);
        container.appendChild(clearBtn);

        if (preferences.controlLayout === 'right') {
            const host = ensureInlineHost(titleElement);
            if (host) {
                host.appendChild(container);
            } else {
                titleElement.insertAdjacentElement('afterend', container);
            }
        } else {
            titleElement.insertAdjacentElement('afterend', container);
        }

        updateProjectToolLabel(projectElement);
    }

    function updateProjectToolLabel(projectElement) {
        const tools = projectElement.querySelector('.nlm-project-tools');
        if (!tools) return;

        const badge = tools.querySelector('.nlm-pill');
        const projectKey = getProjectKey(projectElement);
        const effectiveCategory = getProjectCategory(projectElement);

        if (projectKey && manualAssignments[projectKey]) {
            badge.textContent = `Manual: ${effectiveCategory}`;
        } else {
            badge.textContent = `Auto: ${effectiveCategory}`;
        }
    }

    function decorateProjects() {
        getProjectElements().forEach(projectElement => {
            ensureManualTools(projectElement);
            updateProjectToolLabel(projectElement);
        });
    }

    function createFilterUI(targetContainer) {
        if (document.querySelector('.category-filter-container')) {
            updateButtonCounts();
            filterProjects(getSavedFilter());
            return;
        }

        const filterContainer = document.createElement('div');
        filterContainer.className = 'category-filter-container';

        getCategoryNames().forEach(categoryName => {
            const button = document.createElement('button');
            button.className = 'category-filter-button';
            button.setAttribute('data-category', categoryName);
            button.textContent = categoryName;
            button.addEventListener('click', () => filterProjects(categoryName));
            filterContainer.appendChild(button);
        });

        const separator = document.createElement('div');
        separator.className = 'category-controls-separator';
        filterContainer.appendChild(separator);

        const manageButton = document.createElement('button');
        manageButton.className = 'category-action-button';
        manageButton.textContent = 'Manage';
        manageButton.title = 'Gestisci categorie';
        manageButton.type = 'button';
        manageButton.addEventListener('click', openCategoryManager);
        filterContainer.appendChild(manageButton);

        targetContainer.parentNode.insertBefore(filterContainer, targetContainer);

        updateButtonCounts();
        filterProjects(getSavedFilter());
    }

    function refreshAll() {
        decorateProjects();
        updateButtonCounts();
        filterProjects(getSavedFilter());
    }

    document.arrive('.project-buttons-flow, table.mdc-data-table__table, .project-cards-container', { existing: true }, element => {
        createFilterUI(element);
        refreshAll();
    });

    document.arrive('project-button, tr.mat-mdc-row', { existing: true }, (el) => {
        // If no filter bar exists yet, create it using the parent of this project element
        if (!document.querySelector('.category-filter-container')) {
            const container = el.closest('.project-buttons-flow, table.mdc-data-table__table, .project-cards-container')
                || el.parentElement;
            if (container) {
                createFilterUI(container);
            }
        }
        refreshAll();
    });

    GM_log('NotebookLM Categorizer Pro loaded');
})();