(function (global) {
  'use strict';

  const LIMITE_RESULTADOS = 20;
  const DEBOUNCE_MS = 220;

  let resultados = [];
  let indiceSelecionado = -1;
  let timerBusca = null;
  let requisicaoAtual = 0;
  let dropdownAberto = false;
  /** Último resolve MIP da busca instantânea (mesmo fluxo para PLU/EAN/GTIN/interno/balança). */
  let ultimoMipBusca = null;

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

  function obterApiUrl() {
    return typeof API_URL !== 'undefined' ? API_URL : '/api';
  }

  function estoqueDisponivel(produto) {
    if (typeof global.pdvEstoqueDisponivel === 'function') {
      return global.pdvEstoqueDisponivel(produto);
    }
    return Number(produto?.estoque_atual ?? produto?.estoque_exibido ?? 0);
  }

  /**
   * Resolve produto no cache local a partir do payload MIP.
   */
  function produtoDoMip(resultado) {
    if (!resultado || !resultado.encontrado) return null;

    const id = resultado.produtoId != null
      ? Number(resultado.produtoId)
      : (resultado.produto && resultado.produto.id != null ? Number(resultado.produto.id) : null);

    if (!id) return null;

    const cache = global.produtosDisponiveis || [];
    const noCache = cache.find((p) => Number(p.id) === id);
    if (noCache) {
      return { ...noCache, match_exato: 1, _fonte: 'mip' };
    }

    const base = resultado.produto || { id };
    const normalizado = typeof global.normalizarProdutoPdvLista === 'function'
      ? global.normalizarProdutoPdvLista([base])[0]
      : base;

    return { ...normalizado, id, match_exato: 1, _fonte: 'mip' };
  }

  /**
   * Identificação oficial via MIP (mesmo endpoint do Enter / carrinho).
   */
  async function identificarViaMip(termo) {
    const codigo = String(termo || '').trim();
    if (!codigo) return null;

    const contexto = { origem: 'pdv' };
    if (global.PDV_ETIQUETA_LAYOUT) {
      contexto.layoutStrategy = String(global.PDV_ETIQUETA_LAYOUT);
    }
    if (global.PDV_BALANCA_EQUIPAMENTO_ID) {
      contexto.equipamentoId = Number(global.PDV_BALANCA_EQUIPAMENTO_ID);
    }

    const response = await fetch(`${obterApiUrl()}/produtos/identificar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({ codigo, contexto })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || (`HTTP ${response.status}`));
    }
    return body;
  }

  /**
   * Busca por nome / parcial (legado consulta) — só quando MIP não resolve.
   */
  async function buscarConsultaNome(termo) {
    const url = `${obterApiUrl()}/produtos/consulta-pdv/buscar?q=${encodeURIComponent(termo)}&modo_fiscal=${obterModoFiscal()}&limite=${LIMITE_RESULTADOS}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const dados = await response.json().catch(() => []);
    if (!response.ok) {
      throw new Error(dados?.error || 'Erro ao buscar produtos.');
    }
    return Array.isArray(dados) ? dados.slice(0, LIMITE_RESULTADOS) : [];
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
      const codigoExibicao = produto.plu
        || produto.codigo_barras
        || produto.codigo
        || produto.id;
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
    ultimoMipBusca = null;
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

  /**
   * Enter: se MIP resolveu o termo digitado, usa o termo original
   * (preserva PLU / etiqueta de balança no mesmo fluxo do carrinho).
   */
  function confirmarEntrada() {
    const input = obterInput();
    if (!input) return;

    const termo = input.value.trim();
    if (!termo) return;

    if (
      ultimoMipBusca
      && ultimoMipBusca.termo === termo
      && ultimoMipBusca.resultado
      && ultimoMipBusca.resultado.encontrado
    ) {
      if (typeof global.adicionarProdutoPorCodigo === 'function') {
        global.adicionarProdutoPorCodigo(termo);
        limparCampo();
      }
      return;
    }

    const exatoApi = resultados.find((p) => p.match_exato === 1 || p.match_exato === true);
    if (exatoApi) {
      adicionarProdutoSelecionado(exatoApi);
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

  /**
   * Busca instantânea unificada: MIP primeiro (qualquer identificador),
   * depois consulta por nome se MIP não encontrar.
   */
  function buscarProdutos(termo) {
    const lista = obterLista();
    if (!termo || termo.length < 1) {
      fecharLista();
      return;
    }

    const reqId = ++requisicaoAtual;
    if (lista) {
      lista.innerHTML = '<p class="vazio">Buscando...</p>';
      lista.classList.add('aberta');
    }

    Promise.resolve()
      .then(() => identificarViaMip(termo))
      .then((mip) => {
        if (reqId !== requisicaoAtual) return null;

        if (mip && mip.encontrado) {
          const produto = produtoDoMip(mip);
          if (produto && produto.id) {
            if (mip.meta && mip.meta.plu != null) {
              produto.plu = String(mip.meta.plu);
            }
            ultimoMipBusca = { termo, resultado: mip };
            resultados = [produto];
            indiceSelecionado = 0;
            renderizarLista();
            return { resolvidoMip: true };
          }
        }

        ultimoMipBusca = null;
        return buscarConsultaNome(termo).then((produtos) => ({ resolvidoMip: false, produtos }));
      })
      .then((out) => {
        if (!out || out.resolvidoMip || reqId !== requisicaoAtual) return;
        resultados = out.produtos || [];
        const unicoExato = resultados.length === 1
          && (resultados[0].match_exato === 1 || resultados[0].match_exato === true);
        indiceSelecionado = unicoExato ? 0 : (resultados.length === 1 ? 0 : -1);
        renderizarLista();
      })
      .catch((err) => {
        if (reqId !== requisicaoAtual) return;
        ultimoMipBusca = null;
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
      }
    }
  }

  function onListaClick(event) {
    const botao = event.target.closest('.pdv-autocomplete-item');
    if (!botao || botao.disabled) return;

    const index = Number(botao.dataset.index);
    if (!Number.isFinite(index) || !resultados[index]) return;

    const produto = resultados[index];
    const input = obterInput();
    const termo = input ? input.value.trim() : '';

    // Clique no item resolvido via MIP: usa o termo digitado (PLU/EAN/balança)
    if (
      produto._fonte === 'mip'
      && ultimoMipBusca
      && ultimoMipBusca.termo === termo
      && typeof global.adicionarProdutoPorCodigo === 'function'
    ) {
      global.adicionarProdutoPorCodigo(termo);
      limparCampo();
      return;
    }

    adicionarProdutoSelecionado(produto);
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
