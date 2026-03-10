# Backlog — NotebookLM Categorizer Pro

Questo file raccoglie tutte le funzionalità da implementare e i bug da correggere per l'estensione NotebookLM Categorizer Pro.

## Riepilogo

| ID | Titolo | Tipo | Priorita | Stato |
|----|--------|------|----------|-------|
| [BACK-001](#back-001-filtri-categoria-non-visibili-nella-vista-a-riquadri) | Filtri categoria non visibili nella vista a riquadri | Bug | Must Have | Completato |
| [BACK-002](#back-002-pagina-manage---pulsanti-in-fondo-fuoriescono-dalla-modale) | Pagina "Manage" - pulsanti in fondo fuoriescono dalla modale | Bug | Must Have | Completato |
| [BACK-003](#back-003-textarea-keywords---cursore-sempre-in-prima-posizione) | Textarea keywords - cursore sempre in prima posizione | Bug | Must Have | Completato |
| [BACK-004](#back-004-multi-categoria-assegnare-un-notebook-a-piu-categorie-contemporaneamente) | Multi-categoria: assegnare un notebook a più categorie | Funzionalità | Nice to Have | Da implementare |
| [BACK-005](#back-005-nascondere-categoria-all-dalla-maschera-manage) | Nascondere categoria "All" dalla maschera Manage | Funzionalità | Nice to Have | Da implementare |

---

## [BACK-001] Filtri categoria non visibili nella vista a riquadri

**Tipo:** Bug
**Priorita:** Must Have
**Stato:** Completato

### Descrizione

I filtri di categoria vengono mostrati solo nella vista a lista/tabella di NotebookLM, ma non appaiono nella vista a riquadri (grid view). L'utente che utilizza la vista a riquadri non può filtrare i notebook per categoria.

### Comportamento atteso

- La barra dei filtri categoria deve essere visibile e funzionante in entrambe le viste: lista tabellare e riquadri (grid).
- Il filtraggio deve nascondere/mostrare correttamente i riquadri dei notebook nella grid view.

### Note tecniche

- Lo script attualmente si aggancia a `.project-buttons-flow` (grid) e `table.mdc-data-table__table` (lista). Verificare che il selettore per la grid view corrisponda all'elemento effettivamente renderizzato da NotebookLM e che il filtro `data-filtered="hidden"` copra anche i tag della vista a riquadri.

---

## [BACK-002] Pagina "Manage" - pulsanti in fondo fuoriescono dalla modale

**Tipo:** Bug
**Priorita:** Must Have
**Stato:** Completato

### Descrizione

Il layout della modale "Manage Categories" non ridimensiona correttamente la propria altezza. I pulsanti nella sezione `.nlm-modal-buttons` (Cancel, Reset, Export, Import, Save) fuoriescono dall'area visibile della modale, rendendoli parzialmente o completamente inaccessibili senza scrollare.

### Comportamento atteso

- La modale deve contenere tutti gli elementi al suo interno senza overflow visivo.
- I pulsanti di azione devono essere sempre visibili, anche con molte categorie presenti.
- Se il contenuto eccede l'altezza disponibile, lo scroll deve funzionare correttamente all'interno della modale.

### Note tecniche

- Il CSS della modale ha `max-height: 90vh` e `overflow: auto`. Verificare che il padding e il layout interno non causino un overflow che spinge i pulsanti fuori dal viewport prima che lo scroll intervenga.

---

## [BACK-003] Textarea keywords - cursore sempre in prima posizione

**Tipo:** Bug
**Priorita:** Must Have
**Stato:** Completato

### Descrizione

Nella pagina di gestione categorie, quando si clicca con il mouse all'interno della textarea dei patterns/keywords, il cursore viene posizionato sempre all'inizio del testo anziché nel punto cliccato. Questo impedisce la normale modifica del testo con il mouse e obbliga l'utente a usare le frecce cursore per spostarsi.

### Comportamento atteso

- Cliccando in un punto qualsiasi della textarea, il cursore deve posizionarsi esattamente nel punto cliccato.
- La textarea deve comportarsi come un normale campo di testo HTML.

### Note tecniche

- Il problema è probabilmente causato dal fatto che la funzione `render()` del modal viene chiamata ogni volta che si interagisce con i controlli (es. drag & drop), causando il re-render della textarea e il reset del cursore. Verificare se `persistManagerEditsToMemory()` e `render()` vengono chiamati inaspettatamente durante il focus sulla textarea, e se necessario evitare il re-render quando non strettamente necessario.

---

## [BACK-004] Multi-categoria: assegnare un notebook a più categorie contemporaneamente

**Tipo:** Funzionalità
**Priorita:** Nice to Have
**Stato:** Da implementare

### Descrizione

Attualmente ogni notebook può appartenere a una sola categoria. Si vuole permettere di assegnare la stessa keyword a più categorie e far sì che un notebook compaia in tutte le categorie corrispondenti. La tendina di selezione manuale della categoria dovrebbe supportare la selezione multipla (multi-select).

### Comportamento atteso

- Un notebook può essere associato a più categorie, sia tramite regole automatiche (keyword/regex) che tramite assegnazione manuale.
- Nella vista filtrata per una categoria, vengono mostrati tutti i notebook che appartengono a quella categoria (anche se appartengono anche ad altre).
- La UI di selezione manuale permette di scegliere più categorie contemporaneamente (es. `<select multiple>`).
- Il contatore di notebook per categoria riflette correttamente la multi-appartenenza.

### Note tecniche

- La struttura `manualAssignments` attualmente mappa `projectKey → string`. Per il multi-select servirà `projectKey → string[]`.
- La funzione `getProjectCategory()` restituisce una singola categoria; andrebbe refactorizzata in `getProjectCategories()` che restituisce un array.
- `filterProjects()` dovrà verificare se la categoria selezionata è inclusa nell'array delle categorie del notebook.
- La pill `.nlm-pill` dovrà mostrare più etichette o una lista di categorie.
- Valutare la compatibilità con l'export/import e con la normalizzazione dei dati salvati in `GM_setValue`.

### Note

Questo item è classificato come nice-to-have e può essere posticipato. Richiede un refactoring non banale della struttura dati interna e della logica di filtraggio.

---

## [BACK-005] Nascondere categoria "All" dalla maschera Manage

**Tipo:** Funzionalità
**Priorita:** Nice to Have
**Stato:** Da implementare

### Descrizione

Nella maschera "Manage Categories", la riga della categoria "All" è mostrata ma è completamente bloccata (nome, matcher e patterns non modificabili). Non ha alcuna utilità pratica nel manager e occupa spazio visivo inutilmente.

### Comportamento atteso

- La categoria "All" non deve comparire nella lista delle categorie nel manager.
- Il pulsante filtro "All" nella barra principale deve continuare a funzionare normalmente.
- La categoria "All" deve rimanere presente internamente nella configurazione (non va rimossa dal modello dati).
