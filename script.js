// ==UserScript==
// @name         NotebookLM Project Categorizer
// @namespace    https://github.com/muharamdani
// @version      1.4.0
// @description  Adds category filter buttons to the NotebookLM project list based on project titles. Handles SPA navigation. Includes category import/export and inline category editor.
// @author       muharamdani
// @match        https://notebooklm.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.co
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @require      https://cdn.jsdelivr.net/npm/arrive@2.4.1/minified/arrive.min.js
// ==/UserScript==

(function() {
    'use strict';

    const DEFAULT_CATEGORIES = {
        'All': [],
        'Tutorial': ['How to', 'Course', 'Lecture', 'Tutorial'],
        'Finance': ['Investing', 'Gold', 'Stocks', 'Bonds', 'Funds'],
        'Other': []
    };

    const ACTIVE_FILTER_KEY = 'notebooklm_active_filter';
    const CATEGORIES_KEY = 'notebooklm_categories';

    function loadCategories() {
        const saved = GM_getValue(CATEGORIES_KEY, null);
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
            return { ...DEFAULT_CATEGORIES };
        }

        const merged = {};
        merged.All = Array.isArray(saved.All) ? saved.All : [];

        Object.keys(saved).forEach(key => {
            if (key !== 'All' && key !== 'Other') {
                merged[key] = Array.isArray(saved[key]) ? saved[key] : [];
            }
        });

        merged.Other = Array.isArray(saved.Other) ? saved.Other : [];
        return merged;
    }

    function saveCategories(newCategories) {
        GM_setValue(CATEGORIES_KEY, newCategories);
        categories = loadCategories();
        GM_log('Categories saved:', categories);
    }

    let categories = loadCategories();

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
        .category-action-button {
            padding: 8px 15px;
            border: 1px solid #ccc;
            border-radius: 16px;
            background-color: #f8f8f8;
            color: #333;
            cursor: pointer;
            font-size: 0.9em;
            transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
        }

        .category-filter-button:hover,
        .category-action-button:hover {
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
            width: min(900px, 96vw);
            max-height: 90vh;
            overflow: auto;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 20px;
            font-family: Arial, sans-serif;
            color: #222;
        }

        .nlm-modal h2 {
            margin: 0 0 16px 0;
            font-size: 1.3rem;
        }

        .nlm-modal p {
            margin: 0 0 16px 0;
            color: #555;
        }

        .nlm-category-row {
            display: grid;
            grid-template-columns: 220px 1fr auto;
            gap: 10px;
            align-items: start;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #eee;
        }

        .nlm-category-row input[type="text"],
        .nlm-category-row textarea,
        .nlm-add-row input[type="text"] {
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
        .nlm-category-row.locked textarea {
            background: #f7f7f7;
        }

        .nlm-modal-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 18px;
        }

        .nlm-btn {
            padding: 10px 14px;
            border: 1px solid #ccc;
            border-radius: 10px;
            background: #f8f8f8;
            cursor: pointer;
            font-size: 14px;
        }

        .nlm-btn:hover {
            background: #eee;
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
            grid-template-columns: 220px 1fr auto;
            gap: 10px;
            align-items: center;
            margin-top: 18px;
            padding-top: 14px;
            border-top: 2px solid #eee;
        }

        .nlm-note {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
    `);

    function getProjectCategory(projectElement) {
        const titleElement = projectElement.querySelector('.project-button-title, .project-table-title');
        if (!titleElement) {
            GM_log('No title found in project element:', projectElement);
            return 'Other';
        }

        const title = titleElement.textContent.toLowerCase().trim();

        for (const categoryName in categories) {
            if (categoryName === 'All' || categoryName === 'Other') continue;

            const keywords = categories[categoryName] || [];
            for (const keyword of keywords) {
                if (title.includes(String(keyword).toLowerCase())) {
                    return categoryName;
                }
            }
        }

        if (categories['Other'] && categories['Other'].length > 0) {
            for (const keyword of categories['Other']) {
                if (title.includes(String(keyword).toLowerCase())) {
                    return 'Other';
                }
            }
        }

        return 'Other';
    }

    function updateButtonCounts() {
        const projectButtons = document.querySelectorAll('project-button, tr.mat-mdc-row');
        const categoryCounts = {};

        Object.keys(categories).forEach(cat => {
            categoryCounts[cat] = 0;
        });

        categoryCounts['All'] = projectButtons.length;

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
        const projectButtons = document.querySelectorAll('project-button, tr.mat-mdc-row');

        projectButtons.forEach(proj => {
            const projectCategory = getProjectCategory(proj);
            if (selectedCategory === 'All' || projectCategory === selectedCategory) {
                proj.setAttribute('data-filtered', 'visible');
            } else {
                proj.setAttribute('data-filtered', 'hidden');
            }
        });

        document.querySelectorAll('.category-filter-button').forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            btn.classList.toggle('active', btnCategory === selectedCategory);
        });

        GM_setValue(ACTIVE_FILTER_KEY, selectedCategory);
    }

    function rebuildUI() {
        const existingContainer = document.querySelector('.category-filter-container');
        if (existingContainer) existingContainer.remove();

        const targetContainer = document.querySelector('.project-buttons-flow, table.mdc-data-table__table');
        if (targetContainer) {
            createFilterUI(targetContainer);
        }

        const savedFilter = GM_getValue(ACTIVE_FILTER_KEY, 'All');
        const filterToApply = categories[savedFilter] !== undefined ? savedFilter : 'All';
        filterProjects(filterToApply);
        updateButtonCounts();
    }

    function exportCategories() {
        try {
            const exportData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                categories: categories
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `notebooklm-categories-${date}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Errore durante l’esportazione delle categorie.');
        }
    }

    function validateImportedCategories(obj) {
        if (!obj || typeof obj !== 'object') return false;

        const importedCategories = obj.categories ?? obj;
        if (!importedCategories || typeof importedCategories !== 'object' || Array.isArray(importedCategories)) {
            return false;
        }

        for (const [key, value] of Object.entries(importedCategories)) {
            if (typeof key !== 'string' || !Array.isArray(value)) {
                return false;
            }
        }

        return true;
    }

    function normalizeImportedCategories(obj) {
        const importedCategories = obj.categories ?? obj;
        const normalized = {};

        normalized.All = Array.isArray(importedCategories.All) ? importedCategories.All : [];

        Object.keys(importedCategories).forEach(key => {
            if (key !== 'All' && key !== 'Other') {
                normalized[key] = Array.isArray(importedCategories[key]) ? importedCategories[key] : [];
            }
        });

        normalized.Other = Array.isArray(importedCategories.Other) ? importedCategories.Other : [];
        return normalized;
    }

    function importCategoriesFromFile(file) {
        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const parsed = JSON.parse(event.target.result);

                if (!validateImportedCategories(parsed)) {
                    alert('File JSON non valido. Formato categorie non riconosciuto.');
                    return;
                }

                const imported = normalizeImportedCategories(parsed);
                saveCategories(imported);
                rebuildUI();
                alert('Categorie importate con successo.');
            } catch (err) {
                console.error('Import failed:', err);
                alert('Errore durante l’importazione del file JSON.');
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

    function parseKeywords(text) {
        return text
            .split(',')
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

    function openCategoryManager() {
        const overlay = document.createElement('div');
        overlay.className = 'nlm-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'nlm-modal';

        const editableCategories = JSON.parse(JSON.stringify(categories));

        const render = () => {
            const rowsHtml = Object.keys(editableCategories).map(categoryName => {
                const isLocked = categoryName === 'All' || categoryName === 'Other';
                const keywords = (editableCategories[categoryName] || []).join(', ');

                return `
                    <div class="nlm-category-row ${isLocked ? 'locked' : ''}" data-category="${escapeHtml(categoryName)}">
                        <div>
                            <input type="text" class="nlm-name" value="${escapeHtml(categoryName)}" ${isLocked ? 'disabled' : ''}>
                            <div class="nlm-note">${isLocked ? 'Categoria speciale protetta' : 'Nome categoria'}</div>
                        </div>
                        <div>
                            <textarea class="nlm-keywords" ${categoryName === 'All' ? 'disabled' : ''}>${escapeHtml(keywords)}</textarea>
                            <div class="nlm-note">${categoryName === 'All' ? 'Non usa keyword' : 'Keyword separate da virgola'}</div>
                        </div>
                        <div>
                            ${isLocked ? '' : '<button class="nlm-btn danger nlm-delete">Delete</button>'}
                        </div>
                    </div>
                `;
            }).join('');

            modal.innerHTML = `
                <h2>Manage Categories</h2>
                <p>Modifica nomi e keyword delle categorie. Le keyword sono confrontate con il titolo del notebook in modo case-insensitive.</p>

                <div class="nlm-category-list">
                    ${rowsHtml}
                </div>

                <div class="nlm-add-row">
                    <input type="text" class="nlm-new-name" placeholder="New category name">
                    <input type="text" class="nlm-new-keywords" placeholder="keyword1, keyword2, keyword3">
                    <button class="nlm-btn nlm-add">Add</button>
                </div>

                <div class="nlm-modal-buttons">
                    <button class="nlm-btn" data-action="cancel">Cancel</button>
                    <button class="nlm-btn" data-action="reset">Reset defaults</button>
                    <button class="nlm-btn primary" data-action="save">Save</button>
                </div>
            `;

            bindModalEvents();
        };

        const closeModal = () => overlay.remove();

        const collectFormData = () => {
            const newCategories = {};
            const rows = modal.querySelectorAll('.nlm-category-row');

            rows.forEach(row => {
                const originalName = row.getAttribute('data-category');
                const nameInput = row.querySelector('.nlm-name');
                const keywordsInput = row.querySelector('.nlm-keywords');

                let finalName = originalName;
                if (nameInput && !nameInput.disabled) {
                    finalName = nameInput.value.trim();
                }

                if (!finalName) return;

                if (finalName === 'All') {
                    newCategories.All = [];
                    return;
                }

                const keywords = keywordsInput ? parseKeywords(keywordsInput.value) : [];

                if (finalName === 'Other') {
                    newCategories.Other = keywords;
                } else {
                    newCategories[finalName] = keywords;
                }
            });

            if (!newCategories.All) newCategories.All = [];
            if (!newCategories.Other) newCategories.Other = [];
            return normalizeImportedCategories(newCategories);
        };

        const bindModalEvents = () => {
            modal.querySelectorAll('.nlm-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.target.closest('.nlm-category-row');
                    if (row) row.remove();
                });
            });

            const addBtn = modal.querySelector('.nlm-add');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const nameInput = modal.querySelector('.nlm-new-name');
                    const keywordsInput = modal.querySelector('.nlm-new-keywords');

                    const name = nameInput.value.trim();
                    if (!name) {
                        alert('Inserisci un nome categoria.');
                        return;
                    }

                    if (name === 'All' || name === 'Other') {
                        alert('Questo nome è riservato.');
                        return;
                    }

                    const existingNames = Array.from(modal.querySelectorAll('.nlm-category-row .nlm-name'))
                        .map(input => input.value.trim().toLowerCase());

                    if (existingNames.includes(name.toLowerCase())) {
                        alert('Esiste già una categoria con questo nome.');
                        return;
                    }

                    editableCategories[name] = parseKeywords(keywordsInput.value);
                    render();
                });
            }

            modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);

            modal.querySelector('[data-action="reset"]').addEventListener('click', () => {
                if (!confirm('Ripristinare le categorie di default?')) return;
                Object.keys(editableCategories).forEach(k => delete editableCategories[k]);
                Object.assign(editableCategories, JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
                render();
            });

            modal.querySelector('[data-action="save"]').addEventListener('click', () => {
                const newCategories = collectFormData();

                const names = Object.keys(newCategories);
                const lowered = new Set();
                for (const name of names) {
                    const lower = name.toLowerCase();
                    if (lowered.has(lower)) {
                        alert(`Nome categoria duplicato: ${name}`);
                        return;
                    }
                    lowered.add(lower);
                }

                saveCategories(newCategories);
                rebuildUI();
                closeModal();
            });
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        render();
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    function createFilterUI(targetContainer) {
        if (document.querySelector('.category-filter-container')) {
            updateButtonCounts();

            const lastFilter = GM_getValue(ACTIVE_FILTER_KEY, 'All');
            const safeFilter = categories[lastFilter] !== undefined ? lastFilter : 'All';
            filterProjects(safeFilter);
            return;
        }

        const filterContainer = document.createElement('div');
        filterContainer.className = 'category-filter-container';

        Object.keys(categories).forEach(categoryName => {
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
        manageButton.addEventListener('click', openCategoryManager);
        filterContainer.appendChild(manageButton);

        const exportButton = document.createElement('button');
        exportButton.className = 'category-action-button';
        exportButton.textContent = 'Export';
        exportButton.title = 'Esporta le categorie in un file JSON';
        exportButton.addEventListener('click', exportCategories);
        filterContainer.appendChild(exportButton);

        const importButton = document.createElement('button');
        importButton.className = 'category-action-button';
        importButton.textContent = 'Import';
        importButton.title = 'Importa le categorie da un file JSON';
        importButton.addEventListener('click', triggerImport);
        filterContainer.appendChild(importButton);

        targetContainer.parentNode.insertBefore(filterContainer, targetContainer);

        updateButtonCounts();

        const lastFilter = GM_getValue(ACTIVE_FILTER_KEY, 'All');
        const safeFilter = categories[lastFilter] !== undefined ? lastFilter : 'All';
        filterProjects(safeFilter);
    }

    document.arrive('.project-buttons-flow, table.mdc-data-table__table', { existing: true }, function(element) {
        createFilterUI(element);
    });

    GM_log('NotebookLM Categorizer Script Loaded (SPA-Aware + Import/Export + Manager)');
})();