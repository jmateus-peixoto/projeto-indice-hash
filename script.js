/**
 * Adiciona um listener que aguarda o carregamento completo do DOM (a estrutura da página)
 * para então inicializar o script.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Mapeamento dos Elementos do DOM ---
    const buildIndexBtn = document.getElementById('buildIndexBtn');
    const searchIndexBtn = document.getElementById('searchIndexBtn');
    const tableScanBtn = document.getElementById('tableScanBtn');
    const searchKeyInput = document.getElementById('searchKey');
    const numPagesInput = document.getElementById('numPagesInput');

    // --- Variáveis de Estado Global ---
    let words = [];
    let pages = [];
    let hashTable = [];
    let config = {
        numPagesReq: 0,
        numPagesCreated: 0,
        wordsPerPage: 0,
        numBuckets: 0,
        bucketSize: 5,
        totalWords: 0,
    };
    let stats = {
        collisions: 0,
        overflows: 0,
    };

    // --- Adição dos Listeners de Eventos ---
    if (buildIndexBtn) buildIndexBtn.addEventListener('click', handleBuildIndex);
    if (searchIndexBtn) searchIndexBtn.addEventListener('click', searchWithIndex);
    if (tableScanBtn) tableScanBtn.addEventListener('click', performTableScan);

    // --- Funcionalidade: Ativar/desativar botões e "Enter" para buscar ---
    if (searchKeyInput) {
        searchKeyInput.addEventListener('input', () => {
            const hasText = searchKeyInput.value.trim() !== '';
            if (searchIndexBtn) searchIndexBtn.disabled = !hasText;
            if (tableScanBtn) tableScanBtn.disabled = !hasText;
        });

        searchKeyInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Impede o comportamento padrão do Enter
                if (searchIndexBtn && !searchIndexBtn.disabled) {
                    searchIndexBtn.click(); // Simula o clique no botão de busca
                }
            }
        });
    }


    /**
     * Função principal que orquestra a construção do índice.
     */
    async function handleBuildIndex() {
        console.log("A iniciar a construção do índice...");

        const numPagesReq = parseInt(numPagesInput.value, 10);
        if (isNaN(numPagesReq) || numPagesReq <= 0) {
            alert("Por favor, insira um número de páginas válido.");
            return;
        }
        config.numPagesReq = numPagesReq;

        resetState();

        try {
            const response = await fetch('Assets/palavras.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Certifique-se de que o ficheiro 'palavras.txt' está na pasta Assets.`);
            }
            const text = await response.text();
            words = text.split(/\r?\n/).filter(word => word.trim() !== '');
            config.totalWords = words.length;

            createPages();
            createBuckets();
            populateHashTable();
            updateStaticDisplay();
            setResultsPlaceholder(); // Adiciona a mensagem inicial

            const dataDisplay = document.getElementById('data-display');
            if (dataDisplay) dataDisplay.style.display = 'block';

            const searchSection = document.getElementById('search-section');
            if (searchSection) searchSection.style.display = 'block';

            const resultsGrid = document.getElementById('results-and-stats-grid');
            if (resultsGrid) resultsGrid.style.display = 'grid';

            console.log("Construção do índice completa.");

        } catch (error)
        {
            console.error("Falha ao carregar ou processar o ficheiro de palavras:", error);
            alert(`Erro: ${error.message}`);
        }
    }

    /**
     * Divide o array de palavras no número de páginas solicitado pelo utilizador.
     */
    function createPages() {
        pages = [];
        const totalWords = config.totalWords;
        const numPages = config.numPagesReq;

        const wordsPerPage = Math.ceil(totalWords / numPages);
        config.wordsPerPage = wordsPerPage;

        for (let i = 0; i < totalWords; i += wordsPerPage) {
            const page = words.slice(i, i + wordsPerPage);
            pages.push(page);
        }
        config.numPagesCreated = pages.length;
    }

    /**
     * Calcula o número de buckets (NB) com base na fórmula NB > NR / FR.
     */
    function createBuckets() {
        config.numBuckets = Math.ceil(config.totalWords / config.bucketSize) + 1;
        hashTable = Array.from({
            length: config.numBuckets
        }, () => []);
    }

    /**
     * Função de hash: Converte uma chave (palavra) num índice de bucket.
     */
    function hashFunction(key) {
        let hash = 5381;
        for (let i = 0; i < key.length; i++) {
            hash = (hash * 33) ^ key.charCodeAt(i);
        }
        return Math.abs(hash % config.numBuckets);
    }

    /**
     * Percorre todas as palavras, aplica a função de hash e as armazena na tabela.
     */
    function populateHashTable() {
        stats.collisions = 0;
        stats.overflows = 0;

        pages.forEach((page, pageIndex) => {
            page.forEach(word => {
                const bucketIndex = hashFunction(word);
                const bucket = hashTable[bucketIndex];

                if (bucket.length > 0) {
                    stats.collisions++;
                }
                if (bucket.length >= config.bucketSize) {
                    stats.overflows++;
                }
                bucket.push({
                    key: word,
                    page: pageIndex
                });
            });
        });
    }

    /**
     * Procura por uma chave utilizando o índice hash.
     */
    function searchWithIndex() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        const bucketIndex = hashFunction(key);
        const bucket = hashTable[bucketIndex];
        let cost = 1;
        let found = false;

        for (const item of bucket) {
            if (item.key === key) {
                cost++;
                const pageNumber = item.page;
                const endTime = performance.now();
                displaySearchResults({
                    found: true,
                    key: key,
                    page: pageNumber,
                    cost: cost,
                    time: (endTime - startTime).toFixed(4)
                });
                found = true;
                break;
            }
        }

        if (!found) {
            const endTime = performance.now();
            displaySearchResults({
                found: false,
                key: key,
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }
        const scanResults = document.getElementById('scan-results');
        if (scanResults) scanResults.innerHTML = '';
        const timeComparison = document.getElementById('time-comparison');
        if (timeComparison) timeComparison.innerHTML = '';
    }

    /**
     * Realiza uma busca sequencial por todas as páginas.
     */
    function performTableScan() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        let cost = 0;
        let found = false;

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            cost++;
            const page = pages[pageIndex];
            if (page.includes(key)) {
                const endTime = performance.now();
                displayScanResults({
                    found: true,
                    key: key,
                    page: pageIndex,
                    cost: cost,
                    time: (endTime - startTime).toFixed(4)
                });
                found = true;
                break;
            }
        }

        if (!found) {
            const endTime = performance.now();
            displayScanResults({
                found: false,
                key: key,
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }

        compareSearchTimes();
    }

    // --- Funções de Atualização da Interface Gráfica (UI) ---
    /**
     * Define um texto inicial no painel de resultados.
     */
    function setResultsPlaceholder() {
        const resultsCard = document.getElementById('results');
        if (resultsCard) resultsCard.classList.add('is-placeholder');

        const searchResultsDiv = document.getElementById('search-results');
        if (searchResultsDiv) {
            searchResultsDiv.innerHTML = `<p style="color: var(--text-secondary); font-style: italic;">Aguardando uma busca para exibir os resultados...</p>`;
        }
        // Limpar outros resultados para garantir que só o placeholder aparece
        const scanResultsDiv = document.getElementById('scan-results');
        if (scanResultsDiv) scanResultsDiv.innerHTML = '';
        const timeComparisonDiv = document.getElementById('time-comparison');
        if (timeComparisonDiv) timeComparisonDiv.innerHTML = '';
    }

    /**
     * Remove o estado de placeholder do painel de resultados.
     */
    function clearResultsPlaceholder() {
        const resultsCard = document.getElementById('results');
        if (resultsCard) resultsCard.classList.remove('is-placeholder');
    }
    
    /**
     * Limpa todos os dados e reseta a interface, verificando se os elementos existem.
     */
    function resetState() {
        words = [];
        pages = [];
        hashTable = [];
        stats = {
            collisions: 0,
            overflows: 0
        };
        ['data-display', 'search-section', 'results-and-stats-grid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const firstPagePre = document.getElementById('firstPagePre');
        if (firstPagePre) firstPagePre.textContent = '';

        const lastPagePre = document.getElementById('lastPagePre');
        if (lastPagePre) lastPagePre.textContent = '';

        ['search-results', 'scan-results', 'time-comparison'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    /**
     * Atualiza os painéis de visualização e estatísticas, verificando se os elementos existem.
     */
    function updateStaticDisplay() {
        const firstPagePre = document.getElementById('firstPagePre');
        if (firstPagePre && pages.length > 0) {
            firstPagePre.textContent = pages[0].join('\n');
        }

        const lastPagePre = document.getElementById('lastPagePre');
        if (lastPagePre && pages.length > 0) {
            lastPagePre.textContent = pages[pages.length - 1].join('\n');
        }

        const updateTextContent = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        updateTextContent('totalWords', config.totalWords);
        updateTextContent('reqPages', config.numPagesReq);
        updateTextContent('numPages', config.numPagesCreated);
        updateTextContent('wordsPerPageStat', config.wordsPerPage);
        updateTextContent('numBuckets', config.numBuckets);
        updateTextContent('bucketSize', config.bucketSize);

        const collisionPercent = ((stats.collisions / config.totalWords) * 100).toFixed(2);
        const overflowPercent = ((stats.overflows / config.totalWords) * 100).toFixed(2);

        updateTextContent('collisionRate', `${stats.collisions} (${collisionPercent}%)`);
        updateTextContent('overflowRate', `${stats.overflows} (${overflowPercent}%)`);
    }

    function displaySearchResults(result) {
        const resultsDiv = document.getElementById('search-results');
        let html = `<h3>Busca com Índice</h3>`;
        if (result.found) {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${result.page}</strong>.</p>
                <p>Custo (Acessos a Disco): <strong>${result.cost}</strong></p>
            `;
        } else {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" não encontrada.</p>
                <p>Custo (Acessos a Disco): <strong>${result.cost}</strong></p>
            `;
        }
        html += `<p>Tempo de Execução: <strong data-time-index="${result.time}">${result.time} ms</strong></p>`;
        if (resultsDiv) resultsDiv.innerHTML = html;
    }

    function displayScanResults(result) {
        // Limpa a div de resultados da busca por índice para não mostrar ambos ao mesmo tempo
        const searchResultsDiv = document.getElementById('search-results');
        if(searchResultsDiv) searchResultsDiv.innerHTML = '';

        const resultsDiv = document.getElementById('scan-results');
        let html = `<h3>Busca Sequencial (Table Scan)</h3>`;
        if (result.found) {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${result.page}</strong>.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            `;
        } else {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" não encontrada.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            `;
        }
        html += `<p>Tempo de Execução: <strong data-time-scan="${result.time}">${result.time} ms</strong></p>`;
        if (resultsDiv) resultsDiv.innerHTML = html;
    }

    function compareSearchTimes() {
        const timeIndexEl = document.querySelector('[data-time-index]');
        const timeScanEl = document.querySelector('[data-time-scan]');

        if (timeIndexEl && timeScanEl) {
            const timeIndex = parseFloat(timeIndexEl.dataset.timeIndex);
            const timeScan = parseFloat(timeScanEl.dataset.timeScan);
            const difference = Math.abs(timeScan - timeIndex).toFixed(4);
            const fasterMethod = timeIndex < timeScan ? 'Busca com Índice' : 'Busca Sequencial';

            const comparisonDiv = document.getElementById('time-comparison');
            if (comparisonDiv) {
                comparisonDiv.innerHTML = `
                    <h3>Comparação</h3>
                    <p>O método <span class="highlight">${fasterMethod}</span> foi <strong>${difference} ms</strong> mais rápido.</p>
                `;
            }
        }
    }
});

