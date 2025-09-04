/**
 * Adiciona um listener que aguarda o carregamento completo do DOM (a estrutura da página)
 * para então inicializar o script.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Mapeamento dos Elementos do DOM ---
    // Cria variáveis para aceder facilmente aos elementos da página.
    const buildIndexBtn = document.getElementById('buildIndexBtn');
    const searchIndexBtn = document.getElementById('searchIndexBtn');
    const tableScanBtn = document.getElementById('tableScanBtn');
    const searchKeyInput = document.getElementById('searchKey');
    const numPagesInput = document.getElementById('numPagesInput');

    // --- Variáveis de Estado Global ---
    // Armazenam os dados enquanto a aplicação está a ser utilizada.
    let words = [];       // Array para guardar todas as palavras do ficheiro.
    let pages = [];       // Array de arrays, onde cada array interno é uma página.
    let hashTable = [];   // Array que representa os buckets da tabela hash.
    
    // Objeto para guardar os parâmetros da execução atual.
    let config = {
        numPagesReq: 0,   // Número de páginas requisitadas pelo utilizador.
        numPagesCreated: 0, // Número de páginas efetivamente criadas.
        wordsPerPage: 0,  // Média de palavras por página (calculado).
        numBuckets: 0,    // Número de buckets (calculado).
        bucketSize: 5,    // FR: Tamanho do bucket (definido pela equipa).
        totalWords: 0,    // NR: Total de palavras carregadas.
    };

    // Objeto para guardar as estatísticas da construção do índice.
    let stats = {
        collisions: 0,
        overflows: 0,
    };

    // --- Adição dos Listeners de Eventos ---
    // Define o que acontece quando o utilizador interage com a página.
    buildIndexBtn.addEventListener('click', handleBuildIndex);
    searchIndexBtn.addEventListener('click', searchWithIndex);
    tableScanBtn.addEventListener('click', performTableScan);

    // Ativa o botão de busca sequencial assim que o utilizador digita algo.
    searchKeyInput.addEventListener('keyup', () => {
        tableScanBtn.disabled = searchKeyInput.value.trim() === '';
    });

    /**
     * Função principal que orquestra a construção do índice.
     * É chamada quando o utilizador clica em "Construir Índice".
     */
    async function handleBuildIndex() {
        console.log("A iniciar a construção do índice...");

        const numPagesReq = parseInt(numPagesInput.value, 10);
        if (isNaN(numPagesReq) || numPagesReq <= 0) {
            alert("Por favor, insira um número de páginas válido.");
            return;
        }
        config.numPagesReq = numPagesReq;
        
        resetState(); // Limpa os dados de uma execução anterior.

        try {
            // 1. Carrega os dados do ficheiro local 'palavras.txt' a partir do caminho relativo correto.
            const response = await fetch('Assets/palavras.txt');
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}. Certifique-se que a pasta 'Assets' com o ficheiro 'palavras.txt' está no mesmo local que o index.html.`);
            }
            const text = await response.text();
            words = text.split(/\r?\n/).filter(word => word.trim() !== ''); // Divide o texto em linhas/palavras.
            config.totalWords = words.length;

            // 2. Divide as palavras em páginas.
            createPages();

            // 3. Calcula o número de buckets e inicializa a tabela hash.
            createBuckets();

            // 4. Preenche a tabela hash com as palavras e as suas localizações.
            populateHashTable();

            // 5. Atualiza a interface gráfica com os resultados e estatísticas.
            updateStaticDisplay();
            document.getElementById('data-display').style.display = 'block';
            document.getElementById('search-section').style.display = 'block';
            document.getElementById('results-and-stats-grid').style.display = 'grid';

            console.log("Construção do índice completa.");

        } catch (error) {
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
        
        // Calcula quantas palavras devem ir para cada página.
        const wordsPerPage = Math.ceil(totalWords / numPages);
        config.wordsPerPage = wordsPerPage;

        for (let i = 0; i < totalWords; i += wordsPerPage) {
            const page = words.slice(i, i + wordsPerPage);
            pages.push(page);
        }
        config.numPagesCreated = pages.length;
    }

    /**
     * Calcula o número de buckets (NB) com base na fórmula NB > NR / FR
     * e inicializa a tabela hash como um array de buckets vazios.
     */
    function createBuckets() {
        // Garante que a condição NB > NR / FR seja sempre satisfeita.
        config.numBuckets = Math.ceil(config.totalWords / config.bucketSize) + 1;
        hashTable = Array.from({ length: config.numBuckets }, () => []);
    }
    
    /**
     * Função de hash: Converte uma chave (palavra) num índice de bucket.
     * Esta é uma implementação comum e simples (djb2).
     * @param {string} key - A palavra a ser "hasheada".
     * @returns {number} O índice do bucket para esta chave.
     */
    function hashFunction(key) {
        let hash = 5381;
        for (let i = 0; i < key.length; i++) {
            hash = (hash * 33) ^ key.charCodeAt(i);
        }
        // Garante que o resultado seja positivo e dentro dos limites do array de buckets.
        return Math.abs(hash % config.numBuckets);
    }
    
    /**
     * Percorre todas as palavras em todas as páginas, aplica a função de hash
     * e armazena a palavra e a sua localização na tabela hash.
     * Também calcula colisões e overflows.
     */
    function populateHashTable() {
        stats.collisions = 0;
        stats.overflows = 0;

        pages.forEach((page, pageIndex) => {
            page.forEach(word => {
                const bucketIndex = hashFunction(word);
                const bucket = hashTable[bucketIndex];

                // Se o bucket já tiver um ou mais itens, é uma colisão.
                if (bucket.length > 0) {
                    stats.collisions++;
                }
                
                // Se o bucket já estiver cheio, é um overflow.
                if (bucket.length >= config.bucketSize) {
                    stats.overflows++;
                }
                
                // Adiciona a palavra e o número da sua página ao bucket.
                bucket.push({ key: word, page: pageIndex });
            });
        });
    }

    /**
     * Procura por uma chave utilizando o índice hash.
     */
    function searchWithIndex() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        const startTime = performance.now();
        const bucketIndex = hashFunction(key);
        const bucket = hashTable[bucketIndex];
        let cost = 1; // 1 acesso a disco para ler o bucket.
        let found = false;

        // Procura a chave apenas dentro do bucket correto.
        for (const item of bucket) {
            if (item.key === key) {
                cost++; // +1 acesso para ler a página de dados.
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
                break; // Para a busca assim que encontra.
            }
        }

        if (!found) {
            const endTime = performance.now();
            displaySearchResults({
                found: false,
                key: key,
                cost: cost, // O custo é 1 mesmo se não encontrar, pois o bucket foi lido.
                time: (endTime - startTime).toFixed(4)
            });
        }
        
        // Limpa resultados de buscas anteriores.
        document.getElementById('scan-results').innerHTML = '';
        document.getElementById('time-comparison').innerHTML = '';
    }

    /**
     * Realiza uma busca sequencial por todas as páginas.
     */
    function performTableScan() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        const startTime = performance.now();
        let cost = 0;
        let found = false;

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            cost++; // Custo incrementa para cada página lida.
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
                break; // Para a busca assim que encontra.
            }
        }

        if (!found) {
            const endTime = performance.now();
            displayScanResults({ found: false, key: key, cost: cost, time: (endTime - startTime).toFixed(4) });
        }
        
        compareSearchTimes(); // Compara os tempos após a busca sequencial.
    }

    // --- Funções de Atualização da Interface Gráfica (UI) ---
    
    /**
     * Limpa todos os dados e reseta a interface para o estado inicial.
     */
    function resetState() {
        words = [];
        pages = [];
        hashTable = [];
        stats = { collisions: 0, overflows: 0 };
        // Esconde as secções de resultados
        ['data-display', 'search-section', 'results-and-stats-grid'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        // Limpa os textos dos resultados
        document.getElementById('firstPage').querySelector('pre').textContent = '';
        document.getElementById('lastPage').querySelector('pre').textContent = '';
        ['search-results', 'scan-results', 'time-comparison'].forEach(id => {
             document.getElementById(id).innerHTML = '';
        });
    }

    /**
     * Atualiza os painéis de visualização de páginas e estatísticas.
     */
    function updateStaticDisplay() {
        // Mostra o conteúdo da primeira e da última página.
        document.getElementById('firstPage').querySelector('pre').textContent = `Página 0:\n\n${pages[0].join('\n')}`;
        document.getElementById('lastPage').querySelector('pre').textContent = `Página ${pages.length - 1}:\n\n${pages[pages.length - 1].join('\n')}`;

        // Preenche a tabela de estatísticas.
        document.getElementById('totalWords').textContent = config.totalWords;
        document.getElementById('reqPages').textContent = config.numPagesReq;
        document.getElementById('numPages').textContent = config.numPagesCreated;
        document.getElementById('wordsPerPageStat').textContent = config.wordsPerPage;
        document.getElementById('numBuckets').textContent = config.numBuckets;
        document.getElementById('bucketSize').textContent = config.bucketSize;
        const collisionPercent = ((stats.collisions / config.totalWords) * 100).toFixed(2);
        const overflowPercent = ((stats.overflows / config.totalWords) * 100).toFixed(2);
        document.getElementById('collisionRate').textContent = `${stats.collisions} (${collisionPercent}%)`;
        document.getElementById('overflowRate').textContent = `${stats.overflows} (${overflowPercent}%)`;
    }

    /**
     * Mostra os resultados da busca por índice na interface.
     */
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
        resultsDiv.innerHTML = html;
    }

    /**
     * Mostra os resultados da busca sequencial na interface.
     */
    function displayScanResults(result) {
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
        resultsDiv.innerHTML = html;
    }
    
    /**
     * Compara os tempos de execução das duas buscas e mostra na interface.
     */
    function compareSearchTimes() {
        const timeIndexEl = document.querySelector('[data-time-index]');
        const timeScanEl = document.querySelector('[data-time-scan]');
        
        if (timeIndexEl && timeScanEl) {
            const timeIndex = parseFloat(timeIndexEl.dataset.timeIndex);
            const timeScan = parseFloat(timeScanEl.dataset.timeScan);
            const difference = Math.abs(timeScan - timeIndex).toFixed(4);
            const fasterMethod = timeIndex < timeScan ? 'Busca com Índice' : 'Busca Sequencial';
            
            document.getElementById('time-comparison').innerHTML = `
                <h3>Comparação</h3>
                <p>O método <span class="highlight">${fasterMethod}</span> foi <strong>${difference} ms</strong> mais rápido.</p>
            `;
        }
    }
});

