(function (global) {
  'use strict';

  const LIMITE_RESULTADOS = 20;
  const DEBOUNCE_MS = 220;

  let resultados = [];
  let indiceSelecionado = -1;
  let timerBusca = null;
  let requisicaoAtual = 0;
  let dropdownAberto = false;

  function obterInput() {
    return document.getElementById('buscaProdutoPdv');
  }

  function obterLista() {
    return document.getElementById('listaProdutosPdv');
  }

  function notificar(mensagem, tipo) {
    if (typeof global.showNotification === 'function') {
      global.showNotification(mensagem, tipo);
    }
  }

  function formatarPrecoProduto(produto) {
    const temPromocao = produto?.tem_promocao === 1 || produto?.tem_promocao === true;
    const precoPromo = Number(produto?.preco_promocional || 0);
    const preco = Number(produto?.preco_venda || 0);
    const precoFinal = temPromocao && precoPromo > 0 ? precoPromo : preco;
    if (typeof global.formatCurrency === 'function') {
      return global.formatCurrency(precoFinal);
    }
    return `R$ ${precoFinal.toFixed(2)}`;
  }

  function obterModoFiscal() {
    if (typeof global.modoFiscalQueryParam === 'function') {
      return global.modoFiscalQueryParam();
    }
    return '0';
  }

  function normalizarTermo(texto) {
    if (typeof global.normalizarTexto === 'function') {
      return global.normalizarTexto(texto);
    }
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normalizarCodigoNumerico(codigo) {
    if (typeof global.normalizarCodigoProduto === 'function') {
      return global.normalizarCodigoProduto(codigo);
    }
    return String(codigo || '').replace(/\D/g, '').replace(/^0+/, '') || String(codigo || '').trim();
  }

  function produtoMatchExato(produto, termo) {
    const busca = normalizarTermo(termo);
    const buscaNum = normalizarCodigoNumerico(termo);
    const codigo = normalizarTermo(produto?.codigo);
    const barras = normalizarTermo(produto?.codigo_barras);
    const codigoNum = normalizarCodigoNumerico(produto?.codigo);
    const barrasNum = normalizarCodigoNumerico(produto?.codigo_barras);

    return (
      (codigo && codigo === busca) ||
      (barras && barras === busca) ||
      (codigoNum && codigoNum === buscaNum) ||
      (barrasNum && barrasNum === buscaNum) ||
      String(produto?.id) === buscaNum
    );
  }

  function ehEntradaLeitorOuCodigoExato(termo) {
    const limpo = String(termo || '').trim();
    if (!limpo) return false;

    if (typeof global.codigoEhBalanca === 'function' && global.codigoEhBalanca(limpo)) {
      return true;
    }

    const apenasDigitos = limpo.replace(/\D/g, '');
    if (apenasDigitos.length >= 8 && apenasDigitos.length === limpo.replace(/\s/g, '').length) {
      return true;
    }

    const lista = global.produtosDisponiveis || [];
    if (lista.some((p) => produtoMatchExato(p, limpo))) {
      return true;
    }

    if (resultados.some((p) => p.match_exato === 1 || p.match_exato === true)) {
      return true;
    }

    return false;
  }

  function estoqueDisponivel(produto) {
    if (typeof global.pdvEstoqueDisponivel === 'function') {
      return global.pdvEstoqueDisponivel(produto);
    }
    return Number(produto?.estoque_atual ?? produto?.estoque_exibido ?? 0);
  }

  function renderizarLista() {
    const lista = obterLista();
    if (!lista) return;

    if (!resultados.length) {
      dropdownAberto = false;
      lista.innerHTML = '<p class="vazio">Nenhum produto encontrado.</p>';
      lista.classList.remove('aberta');
      return;
    }

    dropdownAberto = true;
    lista.classList.add('aberta');

    lista.innerHTML = resultados.map((produto, index) => {
      const ativo = index === indiceSelecionado ? ' ativo' : '';
      const semEstoque = typeof global.pdvValidarEstoqueVenda === 'function'
        ? !global.pdvValidarEstoqueVenda(produto, 1).sucesso
        : estoqueDisponivel(produto) <= 0;
      const promocao = produto.tem_promocao === 1 || produto.tem_promocao === true;
      const codigoExibicao = produto.codigo_barras || produto.codigo || produto.id;
      const nome = typeof global.escapeHtml === 'function'
        ? global.escapeHtml(produto.nome || '-')
        : String(produto.nome || '-');

      return `
        <button
          type="button"
          class="pdv-autocomplete-item${ativo}${semEstoque ? ' sem-estoque' : ''}"
          data-index="${index}"
          data-produto-id="${produto.id}"
          ${semEstoque ? 'disabled' : ''}
        >
          <span class="pdv-autocomplete-nome">${nome}${promocao ? ' <small class="pdv-autocomplete-promo">PROMO</small>' : ''}</span>
          <span class="pdv-autocomplete-meta">
            <span class="pdv-autocomplete-codigo">${codigoExibicao}</span>
            <strong class="pdv-autocomplete-preco">${formatarPrecoProduto(produto)}</strong>
          </span>
        </button>
      `;
    }).join('');
  }

  function fecharLista(mensagem) {
    resultados = [];
    indiceSelecionado = -1;
    dropdownAberto = false;
    const lista = obterLista();
    if (lista) {
      lista.classList.remove('aberta');
      lista.innerHTML = `<p class="vazio">${mensagem || 'Digite para buscar por código ou nome...'}</p>`;
    }
  }

  function limparCampo() {
    const input = obterInput();
    if (input) input.value = '';
    fecharLista();
    if (typeof global.focarCampoCodigo === 'function') {
      global.focarCampoCodigo();
    }
  }

  function adicionarProdutoSelecionado(produto) {
    if (!produto) return;

    let cache = global.produtosDisponiveis || [];
    const existe = cache.find((p) => Number(p.id) === Number(produto.id));
    if (!existe) {
      const normalizado = typeof global.normalizarProdutoPdvLista === 'function'
        ? global.normalizarProdutoPdvLista([produto])[0]
        : produto;
      cache = cache.concat([normalizado]);
      global.produtosDisponiveis = cache;
    }

    if (typeof global.adicionarProdutoConsultaPDV === 'function') {
      global.adicionarProdutoConsultaPDV(produto.id);
      limparCampo();
      return;
    }

    if (typeof global.adicionarProdutoPorCodigo === 'function') {
      const codigo = produto.codigo_barras || produto.codigo || String(produto.id);
      global.adicionarProdutoPorCodigo(codigo);
      limparCampo();
    }
  }

  function confirmarEntrada() {
    const input = obterInput();
    if (!input) return;

    const termo = input.value.trim();
    if (!termo) return;

    const exatoApi = resultados.find((p) => p.match_exato === 1 || p.match_exato === true);
    if (exatoApi) {
      adicionarProdutoSelecionado(exatoApi);
      return;
    }

    if (ehEntradaLeitorOuCodigoExato(termo)) {
      if (typeof global.adicionarProdutoPorCodigo === 'function') {
        global.adicionarProdutoPorCodigo(termo);
        limparCampo();
      }
      return;
    }

    if (dropdownAberto && indiceSelecionado >= 0 && resultados[indiceSelecionado]) {
      adicionarProdutoSelecionado(resultados[indiceSelecionado]);
      return;
    }

    if (resultados.length > 0 && indiceSelecionado < 0) {
      notificar('Selecione o produto na lista (setas + Enter ou clique).', 'warning');
      return;
    }

    if (typeof global.adicionarProdutoPorCodigo === 'function') {
      global.adicionarProdutoPorCodigo(termo);
      limparCampo();
    }
  }

  function buscarProdutos(termo) {
    const lista = obterLista();
    if (!termo || termo.length < 1) {
      fecharLista();
      return;
    }

    if (ehEntradaLeitorOuCodigoExato(termo)) {
      fecharLista('Código detectado — pressione Enter para adicionar.');
      return;
    }

    const reqId = ++requisicaoAtual;
    if (lista) {
      lista.innerHTML = '<p class="vazio">Buscando...</p>';
      lista.classList.add('aberta');
    }

    const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '/api';
    const url = `${apiUrl}/produtos/consulta-pdv/buscar?q=${encodeURIComponent(termo)}&modo_fiscal=${obterModoFiscal()}&limite=${LIMITE_RESULTADOS}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    })
      .then(async (response) => {
        const dados = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(dados?.error || 'Erro ao buscar produtos.');
        }
        return dados;
      })
      .then((produtos) => {
        if (reqId !== requisicaoAtual) return;
        resultados = Array.isArray(produtos) ? produtos.slice(0, LIMITE_RESULTADOS) : [];
        const unicoExato = resultados.length === 1
          && (resultados[0].match_exato === 1 || resultados[0].match_exato === true);
        indiceSelecionado = unicoExato ? 0 : -1;
        renderizarLista();
      })
      .catch((err) => {
        if (reqId !== requisicaoAtual) return;
        fecharLista('Erro ao buscar produtos.');
        notificar(err.message, 'danger');
      });
  }

  function onInput() {
    const input = obterInput();
    if (!input) return;

    const termo = input.value.trim();
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => buscarProdutos(termo), DEBOUNCE_MS);
  }

  function onKeyDown(event) {
    const input = obterInput();
    if (!input || event.target !== input) return;

    if (event.key === 'ArrowDown') {
      if (!resultados.length) return;
      event.preventDefault();
      event.stopPropagation();
      indiceSelecionado = Math.min(indiceSelecionado + 1, resultados.length - 1);
      renderizarLista();
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!resultados.length) return;
      event.preventDefault();
      event.stopPropagation();
      indiceSelecionado = Math.max(indiceSelecionado - 1, 0);
      renderizarLista();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      confirmarEntrada();
      return;
    }

    if (event.key === 'Escape') {
      if (dropdownAberto) {
        event.preventDefault();
        event.stopPropagation();
        fecharLista();
        return;
      }
    }
  }

  function onListaClick(event) {
    const botao = event.target.closest('.pdv-autocomplete-item');
    if (!botao || botao.disabled) return;

    const index = Number(botao.dataset.index);
    if (!Number.isFinite(index) || !resultados[index]) return;

    adicionarProdutoSelecionado(resultados[index]);
  }

  function inicializar() {
    const input = obterInput();
    const lista = obterLista();
    if (!input || !lista) return;

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown);
    lista.addEventListener('click', onListaClick);

    const btnBuscar = document.getElementById('btnBuscarProdutoPdv');
    if (btnBuscar) {
      btnBuscar.addEventListener('click', () => confirmarEntrada());
    }

    fecharLista();
  }

  global.PdvBuscaProduto = {
    inicializar,
    estaAberto: () => dropdownAberto,
    fechar: fecharLista,
    confirmarEntrada
  };
})(typeof window !== 'undefined' ? window : global);
