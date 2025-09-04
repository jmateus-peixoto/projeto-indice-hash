/**
 * Adiciona um "ouvinte" que espera que toda a estrutura HTML da página (o DOM)
 * seja completamente carregada antes de executar qualquer código JavaScript.
 * Isto previne erros que poderiam acontecer se o script tentasse manipular
 * elementos que ainda não existem na página.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Mapeamento dos Elementos do DOM ---
    // Aqui, criamos variáveis constantes para guardar referências aos elementos HTML
    // com os quais vamos interagir. Isto torna o código mais rápido e legível,
    // pois não precisamos de procurar o mesmo elemento várias vezes na página.
    const buildIndexBtn = document.getElementById('buildIndexBtn');       // O botão "Construir Índice".
    const searchIndexBtn = document.getElementById('searchIndexBtn');      // O botão "Buscar com Índice".
    const tableScanBtn = document.getElementById('tableScanBtn');        // O botão "Busca Sequencial".
    const searchKeyInput = document.getElementById('searchKey');         // O campo para digitar a palavra a ser buscada.
    const numPagesInput = document.getElementById('numPagesInput');        // O campo para digitar a quantidade de páginas.

    // --- Variáveis de Estado Global ---
    // Estas variáveis guardam os dados principais da aplicação enquanto ela está a ser executada.
    let words = [];       // Um array (lista) que irá armazenar todas as palavras carregadas do ficheiro `palavras.txt`.
    let pages = [];       // Um array de arrays. Cada array interno representará uma página, contendo um subconjunto das palavras.
    let hashTable = [];   // O array principal que representará a nossa tabela hash. Cada posição neste array é um "bucket".
    
    // Um objeto para guardar os parâmetros e configurações da execução atual.
    let config = {
        numPagesReq: 0,        // Guarda o número de páginas que o utilizador pediu.
        numPagesCreated: 0,    // Guarda o número de páginas que foram realmente criadas (pode ser diferente se o ficheiro for pequeno).
        wordsPerPage: 0,       // Guarda a média de palavras por página, que é calculada pelo programa.
        numBuckets: 0,         // Guarda o número total de buckets na tabela hash, calculado pela fórmula.
        bucketSize: 5,         // FR (Fator de Registos): Define o tamanho máximo de cada bucket. Foi um valor definido pela equipa.
        totalWords: 0,         // NR (Número de Registos): Guarda o número total de palavras carregadas.
    };
    
    // Um objeto para guardar as estatísticas geradas durante a construção do índice.
    let stats = {
        collisions: 0,         // Contador para o número de colisões.
        overflows: 0,          // Contador para o número de overflows.
    };

    // --- Adição dos Listeners de Eventos ---
    // Aqui, conectamos as ações do utilizador (como cliques) às funções JavaScript correspondentes.
    // A verificação `if (buildIndexBtn)` garante que o código não falhe se, por algum motivo, o elemento não for encontrado.
    if (buildIndexBtn) buildIndexBtn.addEventListener('click', handleBuildIndex);
    if (searchIndexBtn) searchIndexBtn.addEventListener('click', searchWithIndex);
    if (tableScanBtn) tableScanBtn.addEventListener('click', performTableScan);

    // --- Funcionalidade: Ativar/desativar botões e "Enter" para buscar ---
    if (searchKeyInput) {
        // Este evento é acionado sempre que o utilizador digita ou apaga algo no campo de busca.
        searchKeyInput.addEventListener('input', () => {
            // Verifica se o campo de texto, sem espaços em branco, tem algum conteúdo.
            const hasText = searchKeyInput.value.trim() !== '';
            // Ativa ou desativa os botões de busca com base na verificação acima.
            if (searchIndexBtn) searchIndexBtn.disabled = !hasText;
            if (tableScanBtn) tableScanBtn.disabled = !hasText;
        });

        // Este evento é acionado quando o utilizador pressiona uma tecla dentro do campo de busca.
        searchKeyInput.addEventListener('keydown', (event) => {
            // Verifica se a tecla pressionada foi "Enter".
            if (event.key === 'Enter') {
                event.preventDefault(); // Impede o comportamento padrão do Enter (como submeter um formulário).
                // Se o botão de busca por índice estiver ativo, simula um clique nele.
                if (searchIndexBtn && !searchIndexBtn.disabled) {
                    searchIndexBtn.click();
                }
            }
        });
    }


    /**
     * Função principal que orquestra todo o processo de construção do índice.
     * É chamada quando o utilizador clica no botão "Construir Índice".
     * A palavra `async` indica que esta função pode realizar operações demoradas (como carregar um ficheiro) sem bloquear a página.
     */
    async function handleBuildIndex() {
        console.log("A iniciar a construção do índice...");

        // Lê o valor do campo de entrada e converte-o para um número inteiro.
        const numPagesReq = parseInt(numPagesInput.value, 10);
        // Valida se o valor inserido é um número válido e maior que zero.
        if (isNaN(numPagesReq) || numPagesReq <= 0) {
            alert("Por favor, insira um número de páginas válido.");
            return; // Interrompe a execução da função se a entrada for inválida.
        }
        config.numPagesReq = numPagesReq; // Armazena o valor no objeto de configuração.

        resetState(); // Limpa os dados e a interface de qualquer execução anterior.

        // O bloco `try...catch` é usado para lidar com possíveis erros durante o carregamento do ficheiro.
        try {
            // `fetch` é a função moderna para fazer requisições de rede ou ler ficheiros locais.
            // `await` pausa a execução da função até que o ficheiro seja carregado, sem congelar a interface.
            const response = await fetch('Assets/palavras.txt');
            // Verifica se o ficheiro foi carregado com sucesso.
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. Certifique-se de que o ficheiro 'palavras.txt' está na pasta Assets.`);
            }
            // Lê o conteúdo do ficheiro como texto.
            const text = await response.text();
            // Converte o texto numa lista (array) de palavras.
            // `.split(/\r?\n/)` divide o texto em cada quebra de linha.
            // `.filter(...)` remove quaisquer linhas que estejam vazias.
            words = text.split(/\r?\n/).filter(word => word.trim() !== '');
            config.totalWords = words.length; // Atualiza a contagem total de palavras.

            // Chama as funções auxiliares na ordem correta para construir o índice.
            createPages();          // 1. Divide as palavras em páginas.
            createBuckets();        // 2. Cria os buckets vazios.
            populateHashTable();    // 3. Preenche os buckets com as palavras.
            updateStaticDisplay();  // 4. Mostra os resultados na tela.
            setResultsPlaceholder(); // Adiciona a mensagem "Aguardando busca..."

            // Torna as secções de resultados visíveis na página.
            const dataDisplay = document.getElementById('data-display');
            if (dataDisplay) dataDisplay.style.display = 'block';

            const searchSection = document.getElementById('search-section');
            if (searchSection) searchSection.style.display = 'block';

            const resultsGrid = document.getElementById('results-and-stats-grid');
            if (resultsGrid) resultsGrid.style.display = 'grid';

            console.log("Construção do índice completa.");

        } catch (error) // Se qualquer erro ocorrer no bloco `try`, o código aqui é executado.
        {
            console.error("Falha ao carregar ou processar o ficheiro de palavras:", error);
            alert(`Erro: ${error.message}`); // Mostra uma mensagem de erro para o utilizador.
        }
    }

    /**
     * Divide o array principal de palavras no número de páginas solicitado pelo utilizador.
     */
    function createPages() {
        pages = []; // Esvazia o array de páginas.
        const totalWords = config.totalWords;
        const numPages = config.numPagesReq;

        // Calcula quantas palavras, em média, devem ir para cada página.
        // `Math.ceil` arredonda para cima para garantir que todas as palavras sejam incluídas.
        const wordsPerPage = Math.ceil(totalWords / numPages);
        config.wordsPerPage = wordsPerPage;

        // Itera sobre o array de palavras em "saltos" do tamanho de uma página.
        for (let i = 0; i < totalWords; i += wordsPerPage) {
            // O método `.slice(início, fim)` "corta" um pedaço do array de palavras.
            const page = words.slice(i, i + wordsPerPage);
            pages.push(page); // Adiciona a nova página ao array de páginas.
        }
        config.numPagesCreated = pages.length; // Guarda o número de páginas que foram realmente criadas.
    }

    /**
     * Calcula o número de buckets (NB) com base na fórmula NB > NR / FR
     * e inicializa a tabela hash como um array de buckets (arrays) vazios.
     */
    function createBuckets() {
        // `Math.ceil(config.totalWords / config.bucketSize)` calcula o mínimo de buckets necessários.
        // O `+ 1` é uma forma simples de garantir que a condição `NB > NR / FR` seja sempre verdadeira.
        config.numBuckets = Math.ceil(config.totalWords / config.bucketSize) + 1;
        // `Array.from` cria um novo array com o tamanho calculado.
        // O segundo argumento `() => []` é uma função que é executada para cada posição,
        // preenchendo-a com um novo array vazio (um bucket).
        hashTable = Array.from({
            length: config.numBuckets
        }, () => []);
    }

    /**
     * Função de hash: Converte uma chave (palavra) num índice de bucket.
     * Esta é uma implementação comum e simples conhecida como "djb2".
     * @param {string} key - A palavra a ser transformada num número (hash).
     * @returns {number} O índice do bucket onde esta chave deve ser guardada.
     */
    function hashFunction(key) {
        let hash = 5381; // Um número inicial arbitrário (número mágico).
        // Itera sobre cada caracter da palavra.
        for (let i = 0; i < key.length; i++) {
            // Realiza operações matemáticas bit a bit para misturar o hash atual com o código do novo caracter.
            hash = (hash * 33) ^ key.charCodeAt(i);
        }
        // O operador `%` (módulo) garante que o resultado final seja um índice válido dentro do `hashTable`.
        // `Math.abs` garante que o número seja sempre positivo.
        return Math.abs(hash % config.numBuckets);
    }

    /**
     * Percorre todas as palavras, aplica a função de hash a cada uma e as armazena
     * no bucket correspondente da tabela. Também calcula colisões e overflows.
     */
    function populateHashTable() {
        stats.collisions = 0; // Zera os contadores.
        stats.overflows = 0;

        // Itera sobre cada página...
        pages.forEach((page, pageIndex) => {
            // ...e sobre cada palavra dentro da página.
            page.forEach(word => {
                // Calcula em qual bucket a palavra deve ir.
                const bucketIndex = hashFunction(word);
                const bucket = hashTable[bucketIndex]; // Acede ao bucket correto.

                // Se o bucket já tem um ou mais itens, significa que outra palavra já caiu aqui antes. Isto é uma colisão.
                if (bucket.length > 0) {
                    stats.collisions++;
                }
                // Se o bucket já atingiu o seu tamanho máximo, qualquer nova adição causa um overflow.
                if (bucket.length >= config.bucketSize) {
                    stats.overflows++;
                }
                
                // Adiciona um objeto ao bucket contendo a palavra e o número da página onde ela se encontra.
                bucket.push({
                    key: word,
                    page: pageIndex
                });
            });
        });
    }

    /**
     * Procura por uma chave utilizando o índice hash (método rápido).
     */
    function searchWithIndex() {
        const key = searchKeyInput.value.trim(); // Pega a palavra digitada e remove espaços em branco.
        if (!key) return; // Se não houver nada, interrompe.

        clearResultsPlaceholder(); // Remove a mensagem "Aguardando busca...".
        const startTime = performance.now(); // Marca o tempo de início.
        
        // Calcula o hash da chave para encontrar o bucket diretamente.
        const bucketIndex = hashFunction(key);
        const bucket = hashTable[bucketIndex];
        let cost = 1; // Simula 1 acesso a disco para ler o bucket.
        let found = false;

        // Itera APENAS sobre os poucos itens dentro do bucket correto.
        for (const item of bucket) {
            if (item.key === key) {
                cost++; // Simula +1 acesso para ler a página de dados.
                const pageNumber = item.page;
                const endTime = performance.now(); // Marca o tempo de fim.
                // Mostra os resultados na tela.
                displaySearchResults({
                    found: true,
                    key: key,
                    page: pageNumber,
                    cost: cost,
                    time: (endTime - startTime).toFixed(4)
                });
                found = true; // Marca que encontrou.
                break; // Interrompe o loop, pois já achou o que procurava.
            }
        }

        // Se o loop terminar e não tiver encontrado a palavra...
        if (!found) {
            const endTime = performance.now();
            displaySearchResults({
                found: false,
                key: key,
                cost: cost,
                time: (endTime - startTime).toFixed(4)
            });
        }
        // Limpa os resultados de outras buscas para não poluir a interface.
        const scanResults = document.getElementById('scan-results');
        if (scanResults) scanResults.innerHTML = '';
        const timeComparison = document.getElementById('time-comparison');
        if (timeComparison) timeComparison.innerHTML = '';
    }

    /**
     * Realiza uma busca sequencial (lenta) por todas as páginas.
     */
    function performTableScan() {
        const key = searchKeyInput.value.trim();
        if (!key) return;

        clearResultsPlaceholder();
        const startTime = performance.now();
        let cost = 0; // O custo começa em zero.
        let found = false;

        // Itera sobre TODAS as páginas, uma por uma, desde o início.
        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
            cost++; // O custo aumenta a cada página lida.
            const page = pages[pageIndex];
            // O método `.includes()` verifica se a palavra existe na página atual.
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
                break; // Interrompe assim que encontra.
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

        compareSearchTimes(); // Chama a função para comparar os tempos.
    }

    // --- Funções de Atualização da Interface Gráfica (UI) ---
    
    /**
     * Adiciona a mensagem "Aguardando uma busca..." no painel de resultados.
     */
    function setResultsPlaceholder() {
        const resultsCard = document.getElementById('results');
        // Adiciona uma classe CSS para permitir a estilização (centralização).
        if (resultsCard) resultsCard.classList.add('is-placeholder');

        const searchResultsDiv = document.getElementById('search-results');
        if (searchResultsDiv) {
            // Insere o HTML da mensagem.
            searchResultsDiv.innerHTML = `<p style="color: var(--text-secondary); font-style: italic;">Aguardando uma busca para exibir os resultados...</p>`;
        }
        // Limpa as outras divs de resultados para garantir que só o placeholder apareça.
        const scanResultsDiv = document.getElementById('scan-results');
        if (scanResultsDiv) scanResultsDiv.innerHTML = '';
        const timeComparisonDiv = document.getElementById('time-comparison');
        if (timeComparisonDiv) timeComparisonDiv.innerHTML = '';
    }

    /**
     * Remove a classe de placeholder do painel de resultados, fazendo com que
     * o conteúdo volte a ser alinhado ao topo.
     */
    function clearResultsPlaceholder() {
        const resultsCard = document.getElementById('results');
        if (resultsCard) resultsCard.classList.remove('is-placeholder');
    }
    
    /**
     * Limpa todos os dados e reseta a interface para o estado inicial,
     * escondendo os painéis de resultados.
     */
    function resetState() {
        words = [];
        pages = [];
        hashTable = [];
        stats = {
            collisions: 0,
            overflows: 0
        };
        // Esconde todos os painéis que só devem aparecer após a construção do índice.
        ['data-display', 'search-section', 'results-and-stats-grid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Limpa o conteúdo das caixas de texto da primeira e última página.
        const firstPagePre = document.getElementById('firstPagePre');
        if (firstPagePre) firstPagePre.textContent = '';

        const lastPagePre = document.getElementById('lastPagePre');
        if (lastPagePre) lastPagePre.textContent = '';

        // Limpa o conteúdo das divs de resultado.
        ['search-results', 'scan-results', 'time-comparison'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    /**
     * Atualiza os painéis de visualização das páginas e as estatísticas com os novos dados.
     */
    function updateStaticDisplay() {
        // Acede à caixa de texto da primeira página.
        const firstPagePre = document.getElementById('firstPagePre');
        // Se a caixa existir e houver páginas, preenche-a com as palavras da primeira página.
        // `.join('\n')` junta todas as palavras da página numa única string, separadas por quebras de linha.
        if (firstPagePre && pages.length > 0) {
            firstPagePre.textContent = pages[0].join('\n');
        }

        // Faz o mesmo para a última página.
        const lastPagePre = document.getElementById('lastPagePre');
        if (lastPagePre && pages.length > 0) {
            lastPagePre.textContent = pages[pages.length - 1].join('\n');
        }

        // Função auxiliar para evitar repetição de código ao atualizar os textos das estatísticas.
        const updateTextContent = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        // Atualiza cada item da lista de estatísticas.
        updateTextContent('totalWords', config.totalWords);
        updateTextContent('reqPages', config.numPagesReq);
        updateTextContent('numPages', config.numPagesCreated);
        updateTextContent('wordsPerPageStat', config.wordsPerPage);
        updateTextContent('numBuckets', config.numBuckets);
        updateTextContent('bucketSize', config.bucketSize);

        // Calcula as percentagens de colisão e overflow.
        const collisionPercent = ((stats.collisions / config.totalWords) * 100).toFixed(2);
        const overflowPercent = ((stats.overflows / config.totalWords) * 100).toFixed(2);

        // Atualiza as taxas com os valores calculados.
        updateTextContent('collisionRate', `${stats.collisions} (${collisionPercent}%)`);
        updateTextContent('overflowRate', `${stats.overflows} (${overflowPercent}%)`);
    }

    /**
     * Constrói e insere o HTML para os resultados da busca com índice.
     */
    function displaySearchResults(result) {
        const resultsDiv = document.getElementById('search-results');
        let html = `<h3>Busca com Índice</h3>`; // Título da secção.
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
        // `data-time-index` é um atributo personalizado para guardar o tempo e recuperá-lo mais tarde.
        html += `<p>Tempo de Execução: <strong data-time-index="${result.time}">${result.time} ms</strong></p>`;
        if (resultsDiv) resultsDiv.innerHTML = html; // Insere o HTML construído na página.
    }

    /**
     * Constrói e insere o HTML para os resultados da busca sequencial.
     */
    function displayScanResults(result) {
        // Limpa os resultados da busca por índice para não mostrar os dois ao mesmo tempo.
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

    /**
     * Compara os tempos de execução guardados e exibe qual método foi mais rápido.
     */
    function compareSearchTimes() {
        // `document.querySelector` seleciona os elementos que têm os atributos de dados que guardámos.
        const timeIndexEl = document.querySelector('[data-time-index]');
        const timeScanEl = document.querySelector('[data-time-scan]');

        // Se ambos os tempos foram registados...
        if (timeIndexEl && timeScanEl) {
            // ...lê os valores guardados.
            const timeIndex = parseFloat(timeIndexEl.dataset.timeIndex);
            const timeScan = parseFloat(timeScanEl.dataset.timeScan);
            // Calcula a diferença.
            const difference = Math.abs(timeScan - timeIndex).toFixed(4);
            // Determina qual método foi mais rápido.
            const fasterMethod = timeIndex < timeScan ? 'Busca com Índice' : 'Busca Sequencial';

            const comparisonDiv = document.getElementById('time-comparison');
            if (comparisonDiv) {
                // Insere a mensagem de comparação na página.
                comparisonDiv.innerHTML = `
                    <h3>Comparação</h3>
                    <p>O método <span class="highlight">${fasterMethod}</span> foi <strong>${difference} ms</strong> mais rápido.</p>
                `;
            }
        }
    }
});

