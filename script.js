/**
 * PROJETO DE ÍNDICE HASH ESTÁTICO
 * * Este script implementa as funcionalidades de um índice hash estático,
 * adaptado da lógica original desenvolvida em Python. Ele é carregado após a
 * estrutura HTML estar pronta, garantindo que todos os elementos da página
 * existam antes de qualquer manipulação.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- BLOCO 1: MAPEAMENTO DOS ELEMENTOS DA INTERFACE (DOM) E VARIÁVEIS GLOBAIS ---
    const buildIndexBtn = document.getElementById('buildIndexBtn');
    const searchIndexBtn = document.getElementById('searchIndexBtn');
    const tableScanBtn = document.getElementById('tableScanBtn');
    const searchKeyInput = document.getElementById('searchKey');
    const pageSizeInput = document.getElementById('pageSizeInput');

    // Variáveis de estado para armazenar os dados e as estruturas
    let words = [];      // Armazena todas as palavras do arquivo de dados (as "tuplas" ou "registros").
    let pages = [];      // Representa a paginação, a divisão física dos dados em blocos.
    let hashTable = [];  // A estrutura principal do nosso índice hash, composta pelos buckets.
    
    // Objeto para guardar os parâmetros da execução atual
    let config = {
        pageSize: 0,          // Tamanho da página definido pelo usuário.
        numPagesCreated: 0,   // Total de páginas realmente criadas.
        numBuckets: 0,        // NB, Número de Buckets.
        bucketSize: 5,        // FR, Fator de bloco do índice, definido pela equipe como 5.
        totalWords: 0,        // NR, a cardinalidade da tabela.
    };
    
    // Objeto para armazenar as estatísticas geradas
    let stats = {
        overflowBucketsCreated: 0, // Conta quantos buckets primários precisaram de uma cadeia de overflow.
        entriesInOverflow: 0,      // Conta o total de entradas armazenadas em buckets de overflow.
    };


    // --- BLOCO 2: EVENT LISTENERS - A INTERAÇÃO DO USUÁRIO ---
    if (buildIndexBtn) buildIndexBtn.addEventListener('click', handleBuildIndex);
    if (searchIndexBtn) searchIndexBtn.addEventListener('click', searchWithIndex);
    if (tableScanBtn) tableScanBtn.addEventListener('click', performTableScan);

    if (searchKeyInput) {
        searchKeyInput.addEventListener('input', () => {
            const hasText = searchKeyInput.value.trim() !== '';
            if (searchIndexBtn) searchIndexBtn.disabled = !hasText;
            if (tableScanBtn) tableScanBtn.disabled = !hasText;
        });
        searchKeyInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (searchIndexBtn && !searchIndexBtn.disabled) {
                    searchIndexBtn.click();
                }
            }
        });
    }

    // --- BLOCO 3: CONSTRUÇÃO DO ÍNDICE - O CORAÇÃO DO PROJETO ---
    async function handleBuildIndex() {
        console.log("A iniciar a construção do índice...");

        const pageSize = parseInt(pageSizeInput.value, 10);
        if (isNaN(pageSize) || pageSize <= 0) {
            alert("Por favor, insira um tamanho de página válido.");
            return;
        }
        config.pageSize = pageSize;
        resetState();

        try {
            const response = await fetch('Assets/palavras.txt');
            if (!response.ok) {
                throw new Error(HTTP error! status: ${response.status}. Certifique-se de que o ficheiro 'palavras.txt' está na pasta Assets.);
            }
            const text = await response.text();
            words = text.split(/\r?\n/).filter(word => word.trim() !== '');
            config.totalWords = words.length;

            createPages();
            createBuckets();
            populateHashTable();
            
            updateStaticDisplay();
            setResultsPlaceholder();
            
            const resultsGrid = document.getElementById('results-and-stats-grid');
            if (resultsGrid) resultsGrid.style.display = 'grid';

            console.log("Construção do índice completa.");
        } catch (error) {
            console.error("Falha ao carregar ou processar o ficheiro de palavras:", error);
            alert(Erro: ${error.message});
        }
    }

    // --- BLOCO 4: IMPLEMENTAÇÃO DAS ESTRUTURAS DE DADOS (LÓGICA PYTHON ADAPTADA) ---

    /**
     * Função createPages:
     * Adapta a lógica de carregar_dados_em_paginas do Python.
     * Divide o array de palavras em páginas de tamanho fixo (pageSize).
     */
    function createPages() {
        pages = [];
        let pageIdCounter = 0;
        for (let i = 0; i < config.totalWords; i += config.pageSize) {
            const pageContent = words.slice(i, i + config.pageSize);
            // Cada página é um objeto para se assemelhar à classe Pagina do Python
            pages.push({
                id: pageIdCounter++,
                records: pageContent
            });
        }
        config.numPagesCreated = pages.length;
    }

    /**
     * Função createBucketObject:
     * Função auxiliar que cria um objeto bucket, simulando a classe Bucket do Python.
     */
    const createBucketObject = () => ({
        capacity: config.bucketSize,
        entries: [],
        overflowBucket: null // Ponteiro para o próximo bucket na cadeia de overflow
    });

    /**
     * Função createBuckets:
     * Adapta a lógica de construir_indice_hash (parte 1) do Python.
     * Calcula o número de buckets (NB) com base em NR e FR.
     * Inicializa a tabela hash com buckets vazios.
     */
    function createBuckets() {
        // Lógica de cálculo do NB igual à do Python: NB = CEIL(NR / FR)
        config.numBuckets = Math.ceil(config.totalWords / config.bucketSize);
        hashTable = Array.from({ length: config.numBuckets }, createBucketObject);
    }
    
    /**
     * Função hashFunction (funcao_hash_melhorada):
     * Implementação exata da função de hash polinomial do script Python.
     * Usa letras maiúsculas (A-Z) para o cálculo.
     */
    function hashFunction(key) {
        const p = 31;
        const m = 1e9 + 9;
        let hashValue = 0;
        let powerOfP = 1;
        const upperKey = key.toUpperCase();

        for (let i = 0; i < upperKey.length; i++) {
            const char = upperKey[i];
            if (char >= 'A' && char <= 'Z') {
                const charValue = char.charCodeAt(0) - 'A'.charCodeAt(0) + 1; // A=1, B=2, ...
                hashValue = (hashValue + charValue * powerOfP) % m;
                powerOfP = (powerOfP * p) % m;
            }
        }
        return Math.abs(hashValue % config.numBuckets);
    }

    // --- BLOCO 5: LÓGICA DO ÍNDICE HASH E RESOLUÇÃO DE OVERFLOW (LÓGICA PYTHON ADAPTADA) ---
    
    /**
     * Função populateHashTable:
     * Adapta a lógica de construir_indice_hash (parte 2) do Python.
     * Percorre todas as palavras e as insere na tabela hash.
     * Implementa a resolução de overflow via encadeamento de buckets.
     */
    function populateHashTable() {
        stats.overflowBucketsCreated = 0;
        stats.entriesInOverflow = 0;

        pages.forEach(page => {
            page.records.forEach(word => {
                const bucketIndex = hashFunction(word);
                const primaryBucket = hashTable[bucketIndex];
                const entry = { key: word, pageId: page.id };

                let currentBucket = primaryBucket;
                // Navega pela cadeia de overflow até encontrar um bucket com espaço ou o final da cadeia
                while (currentBucket.entries.length >= currentBucket.capacity && currentBucket.overflowBucket !== null) {
                    currentBucket = currentBucket.overflowBucket;
                }

                if (currentBucket.entries.length >= currentBucket.capacity) {
                    // Se o bucket atual (o último da cadeia) está cheio, cria um novo
                    
                    // Estatística: Se o bucket primário ainda não tinha overflow, contamos como uma nova "colisão"
                    if (primaryBucket.overflowBucket === null) {
                        stats.overflowBucketsCreated++;
                    }
                    stats.entriesInOverflow++;
                    
                    const newOverflowBucket = createBucketObject();
                    newOverflowBucket.entries.push(entry);
                    currentBucket.overflowBucket = newOverflowBucket;
                } else {
                    // Se encontrou espaço no bucket atual, apenas insere
                    currentBucket.entries.push(entry);
                }
            });
        });
    }

    // --- BLOCO 6: FUNCIONALIDADES DE BUSCA (LÓGICA PYTHON ADAPTADA) ---

    /**
     * Função searchWithIndex:
     * Adapta a busca_com_indice do Python.
     * 1. Aplica o hash na chave de busca para encontrar o bucket primário.
     * 2. Procura a chave no bucket primário e, se não encontrar, segue a cadeia de overflow.
     * 3. O custo é o número de buckets (primário + de overflow) acessados.
     */
    function searchWithIndex() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        
        const bucketIndex = hashFunction(key);
        let currentBucket = hashTable[bucketIndex];
        let cost = 1; // Custo inicial de acesso ao bucket primário
        let found = false;
        let resultData = null;

        while (currentBucket) {
            const foundEntry = currentBucket.entries.find(entry => entry.key === key);
            if (foundEntry) {
                resultData = { page: foundEntry.pageId, originalKey: foundEntry.key };
                found = true;
                break;
            }
            // Move para o próximo bucket na cadeia de overflow
            currentBucket = currentBucket.overflowBucket;
            if (currentBucket) {
                cost++; // Incrementa o custo para cada acesso a um bucket de overflow
            }
        }
        
        const endTime = performance.now();

        if (found) {
            cost++; // Custo final para ler a página onde o dado foi encontrado
            displaySearchResults({
                found: true,
                key: resultData.originalKey,
                page: resultData.page,
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        } else {
            displaySearchResults({
                found: false,
                key: searchKeyInput.value.trim(),
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }
        
        document.getElementById('scan-results').innerHTML = '';
        document.getElementById('time-comparison').innerHTML = '';
    }

    /**
     * Função performTableScan:
     * Implementa a busca sequencial, que serve como base de comparação de performance.
     * Ela percorre cada página, uma a uma, até encontrar a chave.
     */
    function performTableScan() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        let cost = 0;
        let found = false;
        let originalKey = "";
        let foundPageId = -1;

        for (const page of pages) {
            cost++;
            const foundWord = page.records.find(word => word === key);
            if (foundWord) {
                originalKey = foundWord;
                foundPageId = page.id;
                found = true;
                break;
            }
        }

        const endTime = performance.now();
        
        if (found) {
            displayScanResults({
                found: true,
                key: originalKey,
                page: foundPageId,
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        } else {
            displayScanResults({
                found: false,
                key: searchKeyInput.value.trim(),
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }
        compareSearchTimes();
    }


    // --- BLOCO 7: FUNÇÕES AUXILIARES PARA A INTERFACE GRÁFICA ---
    
    function updateStaticDisplay() {
        if (pages.length > 0) {
            document.getElementById('firstPagePre').textContent = pages[0].records.join('\n');
            document.getElementById('lastPagePre').textContent = pages[pages.length - 1].records.join('\n');
        }

        const updateText = (id, value) => { document.getElementById(id).textContent = value; };

        updateText('totalWords', config.totalWords);
        updateText('pageSizeStat', config.pageSize);
        updateText('numPages', config.numPagesCreated);
        updateText('numBuckets', config.numBuckets);
        updateText('bucketSize', config.bucketSize);

        // Novas métricas de estatísticas, conforme lógica Python
        const collisionPercent = config.numBuckets > 0 ? ((stats.overflowBucketsCreated / config.numBuckets) * 100).toFixed(2) : 0;
        const overflowPercent = config.totalWords > 0 ? ((stats.entriesInOverflow / config.totalWords) * 100).toFixed(2) : 0;

        updateText('collisionRate', ${stats.overflowBucketsCreated} (${collisionPercent}%));
        updateText('overflowRate', ${stats.entriesInOverflow} (${overflowPercent}%));
    }
    
    function displaySearchResults(result) {
        const resultsDiv = document.getElementById('search-results');
        let html = <h3>Busca com Índice</h3>;
        if (result.found) {
            const displayPage = result.page + 1; // +1 para exibição (Página 1 em vez de 0)
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${displayPage} (ID: ${result.page})</strong>.</p>
                <p>Custo (Acessos a Disco): <strong>${result.cost}</strong></p>
            `;
        } else {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" não encontrada.</p>
                <p>Custo (Acessos a Disco): <strong>${result.cost}</strong></p>
            `;
        }
        html += <p>Tempo de Execução: <strong data-time-index="${result.time}">${result.time} ms</strong></p>;
        resultsDiv.innerHTML = html;
    }
    
    function displayScanResults(result) {
        const resultsDiv = document.getElementById('scan-results');
        let html = <h3>Busca Sequencial (Table Scan)</h3>;
        if (result.found) {
            const displayPage = result.page + 1;
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${displayPage} (ID: ${result.page})</strong>.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            `;
        } else {
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" não encontrada.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            `;
        }
        html += <p>Tempo de Execução: <strong data-time-scan="${result.time}">${result.time} ms</strong></p>;
        resultsDiv.innerHTML = html;
        document.getElementById('search-results').innerHTML = '';
    }

    function compareSearchTimes() {
        const timeIndexEl = document.querySelector("[data-time-index]");
        const timeScanEl = document.querySelector("[data-time-scan]");
        if (timeIndexEl && timeScanEl) {
            const timeIndex = parseFloat(timeIndexEl.dataset.timeIndex);
            const timeScan = parseFloat(timeScanEl.dataset.timeScan);
            const difference = Math.abs(timeScan - timeIndex).toFixed(4);
            const fasterMethod = timeIndex < timeScan ? "Busca com Índice" : "Busca Sequencial";
            const comparisonDiv = document.getElementById("time-comparison");
            if (comparisonDiv) {
                comparisonDiv.innerHTML = `
                    <h3>Comparação</h3>
                    <p>O método <span class="highlight">${fasterMethod}</span> foi <strong>${difference} ms</strong> mais rápido.</p>
                `;
            }
        }
    }

    function resetState() {
        words = [];
        pages = [];
        hashTable = [];
        stats = { overflowBucketsCreated: 0, entriesInOverflow: 0 };
        document.getElementById('results-and-stats-grid').style.display = "none";
        document.getElementById('firstPagePre').textContent = '';
        document.getElementById('lastPagePre').textContent = '';
        ['search-results', 'scan-results', 'time-comparison'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    function setResultsPlaceholder() {
        const resultsCard = document.getElementById("results");
        if (!resultsCard) return;
        resultsCard.classList.add("is-placeholder");
        const searchResultsDiv = document.getElementById("search-results");
        if (searchResultsDiv) {
            searchResultsDiv.innerHTML = <p style="color: var(--text-secondary); font-style: italic;">Aguardando uma busca para exibir os resultados...</p>;
        }
        document.getElementById("scan-results").innerHTML = '';
        document.getElementById("time-comparison").innerHTML = '';
    }

    function clearResultsPlaceholder() {
        document.getElementById("results")?.classList.remove("is-placeholder");
    }
});