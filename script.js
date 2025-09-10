/**
 * PROJETO DE ÍNDICE HASH ESTÁTICO
 * * Este script implementa as funcionalidades de um índice hash estático,
 * conforme os requisitos do trabalho. Ele é carregado após a estrutura HTML
 * estar pronta, garantindo que todos os elementos da página existam antes de
 * qualquer manipulação.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- BLOCO 1: MAPEAMENTO DOS ELEMENTOS DA INTERFACE (DOM) E VARIÁVEIS GLOBAIS ---
    // Aqui, criamos variáveis para acessar os elementos HTML da nossa página.
    // Também definimos as variáveis globais que irão armazenar o estado da nossa aplicação,
    // como os dados carregados e as estruturas do índice.

    // Mapeamento dos elementos da interface gráfica
    const buildIndexBtn = document.getElementById('buildIndexBtn');
    const searchIndexBtn = document.getElementById('searchIndexBtn');
    const tableScanBtn = document.getElementById('tableScanBtn');
    const searchKeyInput = document.getElementById('searchKey');
    const numPagesInput = document.getElementById('numPagesInput');

    // Variáveis de estado para armazenar os dados e as estruturas
    let words = [];      // Armazena todas as palavras do arquivo de dados (as "tuplas" ou "registros").
    let pages = [];      // Representa a paginação, a divisão física dos dados em blocos.
    let hashTable = [];  // A estrutura principal do nosso índice hash, composta pelos buckets.
    
    // Objeto para guardar os parâmetros da execução atual, como NR (Total de Palavras),
    // NB (Número de Buckets) e FR (Tamanho do Bucket).
    let config = {
        numPagesReq: 0,
        numPagesCreated: 0,
        wordsPerPage: 0,
        numBuckets: 0,
        bucketSize: 5,      // FR, definido pela equipe como 5.
        totalWords: 0,      // NR, a cardinalidade da tabela.
    };
    
    // Objeto para armazenar as estatísticas geradas, como colisões e overflows.
    let stats = {
        collisions: 0,
        overflows: 0,
    };


    // --- BLOCO 2: EVENT LISTENERS - A INTERAÇÃO DO USUÁRIO ---
    // Esta seção cuida da interatividade da página, associando ações do usuário (cliques, digitação)
    // às funções principais do nosso sistema.

    if (buildIndexBtn) buildIndexBtn.addEventListener('click', handleBuildIndex);
    if (searchIndexBtn) searchIndexBtn.addEventListener('click', searchWithIndex);
    if (tableScanBtn) tableScanBtn.addEventListener('click', performTableScan);

    // Habilita/desabilita os botões de busca conforme o usuário digita
    if (searchKeyInput) {
        searchKeyInput.addEventListener('input', () => {
            const hasText = searchKeyInput.value.trim() !== '';
            if (searchIndexBtn) searchIndexBtn.disabled = !hasText;
            if (tableScanBtn) tableScanBtn.disabled = !hasText;
        });

        // Permite que a busca seja acionada com a tecla "Enter"
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
    // A função `handleBuildIndex` é a principal orquestradora. Ela segue os passos
    // definidos no requisito 7 do trabalho: carregar dados, dividir em páginas e construir o índice.

    async function handleBuildIndex() {
        console.log("A iniciar a construção do índice...");

        // Validação da entrada do usuário
        const numPagesReq = parseInt(numPagesInput.value, 10);
        if (isNaN(numPagesReq) || numPagesReq <= 0) {
            alert("Por favor, insira um número de páginas válido.");
            return;
        }
        config.numPagesReq = numPagesReq;
        resetState();

        try {
            // Passo 1 (Req. 7a): O arquivo de dados é carregado em memória.
            const response = await fetch('Assets/palavras.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Certifique-se de que o ficheiro 'palavras.txt' está na pasta Assets.`);
            }
            const text = await response.text();
            words = text.split(/\r?\n/).filter(word => word.trim() !== '');
            config.totalWords = words.length;

            // Sequência de construção do índice
            createPages();          // Passo 2 (Req. 7b): As linhas são divididas em páginas.
            createBuckets();        // Passo 3 (Req. 7d): Os buckets são criados.
            populateHashTable();    // Passo 4 (Req. 7e, 7f): A tabela hash é populada.
            
            // Passo 5 (Req. 7c): Exibição dos resultados e estatísticas na tela.
            updateStaticDisplay();
            setResultsPlaceholder();
            
            // Exibe os painéis da interface gráfica
            const dataDisplay = document.getElementById('data-display');
            if (dataDisplay) dataDisplay.style.display = 'block';
            const searchSection = document.getElementById('search-section');
            if (searchSection) searchSection.style.display = 'block';
            const resultsGrid = document.getElementById('results-and-stats-grid');
            if (resultsGrid) resultsGrid.style.display = 'grid';

            console.log("Construção do índice completa.");
        } catch (error) {
            console.error("Falha ao carregar ou processar o ficheiro de palavras:", error);
            alert(`Erro: ${error.message}`);
        }
    }


    // --- BLOCO 4: IMPLEMENTAÇÃO DAS ESTRUTURAS DE DADOS ---

    /**
     * Função `createPages` (Req. 3a):
     * Simula a paginação física dos dados. Divide o grande array de palavras
     * em sub-arrays menores, onde cada um representa uma "página" ou "bloco de disco".
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
     * Função `createBuckets` (Req. 3b):
     * Cria a estrutura do índice hash. A lógica aqui foi otimizada para performance.
     * O requisito do trabalho é `NB > NR / FR`. Nossa primeira abordagem usava o mínimo
     * de buckets possível, o que gerava alta colisão.
     * Adotamos a abordagem `NB = NR` para reduzir drasticamente o fator de carga e,
     * consequentemente, a taxa de colisões, criando um índice mais eficiente.
     * Essa escolha ainda satisfaz a regra do trabalho.
     * Cada bucket é um objeto preparado para lidar com overflow, conforme o requisito 5b.
     */
    function createBuckets() {
        // Otimização: NB = NR para minimizar colisões.
        config.numBuckets = config.totalWords;
        
        hashTable = Array.from({
            length: config.numBuckets
        }, () => ({
            items: [],      // Armazena registros até o limite FR.
            overflow: []    // Armazena registros excedentes (resolução de overflow).
        }));
    }

    /**
     * Função `hashFunction` (Req. 3c):
     * Esta é a função hash escolhida pela equipe, o algoritmo "djb2".
     * Sua responsabilidade é mapear uma chave (uma palavra) para um endereço de bucket
     * (um índice do array `hashTable`). O operador de módulo (%) garante que o
     * resultado esteja sempre dentro dos limites do array.
     */
    function hashFunction(key) {
        let hash = 5381;
        for (let i = 0; i < key.length; i++) {
            hash = (hash * 33) ^ key.charCodeAt(i);
        }
        return Math.abs(hash % config.numBuckets);
    }


    // --- BLOCO 5: LÓGICA DO ÍNDICE HASH E RESOLUÇÃO DE PROBLEMAS ---

    /**
     * Função `populateHashTable` (Req. 5a, 5b):
     * Percorre todas as palavras e as insere na tabela hash. É aqui que implementamos
     * a resolução de colisões e de overflow.
     * Usamos a versão minúscula da palavra para o hash para garantir consistência
     * com a busca, que também é insensível a maiúsculas/minúsculas.
     */
    function populateHashTable() {
        stats.collisions = 0;
        stats.overflows = 0;

        pages.forEach((page, pageIndex) => {
            page.forEach(word => {
                // Hash é calculado sobre a chave em minúsculas para consistência.
                const bucketIndex = hashFunction(word.toLowerCase());
                const bucket = hashTable[bucketIndex];
                // A palavra original (com seu case) é armazenada.
                const entry = { key: word, page: pageIndex };

                // Lógica de Resolução de Colisão e Overflow (Req. 5a e 5b)
                if (bucket.items.length < config.bucketSize) {
                    // Se o bucket já tem um item, a nova inserção é uma colisão.
                    if (bucket.items.length > 0) {
                        stats.collisions++;
                    }
                    bucket.items.push(entry);
                } else {
                    // Se o bucket principal está cheio, ocorre um overflow.
                    stats.overflows++;
                    bucket.overflow.push(entry);
                }
            });
        });
    }

    // --- BLOCO 6: FUNCIONALIDADES DE BUSCA ---

    /**
     * Função `searchWithIndex` (Req. 2b):
     * Demonstra a eficiência do índice. O processo é:
     * 1. Aplica o hash na chave de busca (em minúsculas) para encontrar o bucket instantaneamente.
     * 2. Procura a chave apenas dentro desse bucket (nos itens principais e de overflow).
     * 3. O custo é mínimo: 1 acesso para o bucket e +1 se a chave for encontrada.
     */
    function searchWithIndex() {
        const key = searchKeyInput.value.trim().toLowerCase();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        
        const bucketIndex = hashFunction(key);
        const bucket = hashTable[bucketIndex];
        let cost = 1;
        let found = false;
        let resultData = null;

        for (const item of bucket.items) {
            if (item.key.toLowerCase() === key) {
                resultData = { page: item.page, originalKey: item.key };
                found = true;
                break;
            }
        }

        if (!found) {
            for (const item of bucket.overflow) {
                if (item.key.toLowerCase() === key) {
                    resultData = { page: item.page, originalKey: item.key };
                    found = true;
                    break;
                }
            }
        }
        
        const endTime = performance.now();

        if (found) {
            cost++;
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

        const scanResults = document.getElementById('scan-results');
        if (scanResults) scanResults.innerHTML = '';
        const timeComparison = document.getElementById('time-comparison');
        if (timeComparison) timeComparison.innerHTML = '';
    }

    /**
     * Função `performTableScan` (Req. 2c):
     * Implementa a busca sequencial, que serve como base de comparação de performance.
     * Ela percorre cada página, uma a uma, até encontrar a chave. O custo é
     * o número de páginas lidas, demonstrando a ineficiência deste método.
     */
    function performTableScan() {
        const key = searchKeyInput.value.trim().toLowerCase();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        let cost = 0;
        let found = false;
        let originalKey = "";

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            cost++;
            const page = pages[pageIndex];
            
            const foundWord = page.find(word => word.toLowerCase() === key);

            if (foundWord) {
                originalKey = foundWord;
                const endTime = performance.now();
                displayScanResults({
                    found: true,
                    key: originalKey,
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
                key: searchKeyInput.value.trim(),
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }

        compareSearchTimes();
    }


    // --- BLOCO 7: FUNÇÕES AUXILIARES PARA A INTERFACE GRÁFICA ---
    // Este bloco contém funções que atualizam a tela com os resultados e estatísticas,
    // cumprindo os requisitos de exibição de informações do trabalho.

    function setResultsPlaceholder() { /* ... código para placeholder ... */ }
    function clearResultsPlaceholder() { /* ... código para limpar placeholder ... */ }
    function resetState() { /* ... código para resetar o estado ... */ }
    
    /**
     * Atualiza o painel de "Estatísticas" com todos os dados calculados,
     * como taxas de colisão e overflow (Req. 6a, 6b).
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

        const collisionPercent = config.totalWords > 0 ? ((stats.collisions / config.totalWords) * 100).toFixed(2) : 0;
        const overflowPercent = config.totalWords > 0 ? ((stats.overflows / config.totalWords) * 100).toFixed(2) : 0;

        updateTextContent('collisionRate', `${stats.collisions} (${collisionPercent}%)`);
        updateTextContent('overflowRate', `${stats.overflows} (${overflowPercent}%)`);
    }

    /**
     * Exibe os resultados da busca, incluindo o custo (Req. 6c) e o número da página.
     * Note o `result.page + 1` para uma exibição amigável ao usuário.
     */
    function displaySearchResults(result) {
        const resultsDiv = document.getElementById('search-results');
        let html = `<h3>Busca com Índice</h3>`;
        if (result.found) {
            const displayPage = result.page + 1;
            html += `
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${displayPage}</strong>.</p>
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
        // ... (código similar para exibir resultados do table scan)
    }

    /**
     * Compara e exibe a diferença de tempo entre as buscas, cumprindo o requisito 6e.
     */
    function compareSearchTimes() {
        // ... (código para comparar os tempos e exibir na tela)
    }

    // Minimizando funções auxiliares não críticas para a explicação principal
    function setResultsPlaceholder() { const resultsCard=document.getElementById("results"); if (resultsCard) resultsCard.classList.add("is-placeholder"); const searchResultsDiv=document.getElementById("search-results"); if (searchResultsDiv) { searchResultsDiv.innerHTML=`<p style="color: var(--text-secondary); font-style: italic;">Aguardando uma busca para exibir os resultados...</p>` } const scanResultsDiv=document.getElementById("scan-results"); if (scanResultsDiv) scanResultsDiv.innerHTML=''; const timeComparisonDiv=document.getElementById("time-comparison"); if (timeComparisonDiv) timeComparisonDiv.innerHTML='' } function clearResultsPlaceholder() { const resultsCard=document.getElementById("results"); if (resultsCard) resultsCard.classList.remove("is-placeholder") } function resetState() { words=[]; pages=[]; hashTable=[]; stats={ collisions: 0, overflows: 0 };[ "data-display", "search-section", "results-and-stats-grid" ].forEach(id => { const el=document.getElementById(id); if (el) el.style.display="none" }); const firstPagePre=document.getElementById("firstPagePre"); if (firstPagePre) firstPagePre.textContent=''; const lastPagePre=document.getElementById("lastPagePre"); if (lastPagePre) lastPagePre.textContent='';[ "search-results", "scan-results", "time-comparison" ].forEach(id => { const el=document.getElementById(id); if (el) el.innerHTML='' }) } function displayScanResults(result) { const searchResultsDiv=document.getElementById("search-results"); if (searchResultsDiv) searchResultsDiv.innerHTML=''; const resultsDiv=document.getElementById("scan-results"); let html=`<h3>Busca Sequencial (Table Scan)</h3>`; if (result.found) { const displayPage=result.page + 1; html+=`
                <p>Chave "<span class="highlight">${result.key}</span>" encontrada na <strong>Página ${displayPage}</strong>.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            ` } else { html+=`
                <p>Chave "<span class="highlight">${result.key}</span>" não encontrada.</p>
                <p>Custo (Páginas Lidas): <strong>${result.cost}</strong></p>
            ` } html+=`<p>Tempo de Execução: <strong data-time-scan="${result.time}">${result.time} ms</strong></p>`; if (resultsDiv) resultsDiv.innerHTML=html } function compareSearchTimes() { const timeIndexEl=document.querySelector("[data-time-index]"); const timeScanEl=document.querySelector("[data-time-scan]"); if (timeIndexEl && timeScanEl) { const timeIndex=parseFloat(timeIndexEl.dataset.timeIndex); const timeScan=parseFloat(timeScanEl.dataset.timeScan); const difference=Math.abs(timeScan - timeIndex).toFixed(4); const fasterMethod=timeIndex < timeScan ? "Busca com Índice" : "Busca Sequencial"; const comparisonDiv=document.getElementById("time-comparison"); if (comparisonDiv) { comparisonDiv.innerHTML=`
                <h3>Comparação</h3>
                <p>O método <span class="highlight">${fasterMethod}</span> foi <strong>${difference} ms</strong> mais rápido.</p>
            ` } } }
});