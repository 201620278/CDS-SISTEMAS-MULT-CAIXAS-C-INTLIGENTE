let clienteAtual = null;
let modalPagamentoDuplicata = null;
let modalDetalhesRecebimento = null;
let modalHistoricoDuplicata = null;
let duplicataVendas = [];
let duplicataResumo = {};

async function carregarDuplicata(clienteId) {
  clienteAtual = clienteId;

  try {
    const response = await fetch(`/api/financeiro/receber/agrupado/${clienteId}`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const mensagem = data.error || 'Não foi possível carregar os dados do cliente.';
      exibirErroDuplicata(mensagem);
      return;
    }

    const cliente = data.cliente || {};
    duplicataResumo = data.resumo || {};
    duplicataVendas = data.vendas || [];

    renderizarHeaderDuplicata(cliente);
    renderizarParcelasDuplicata(duplicataVendas);
    renderizarDetalhesCompras(duplicataVendas);
    atualizarResumoFinanceiro(duplicataResumo);
  } catch (erro) {
    console.error('Erro ao carregar duplicata:', erro);
    exibirErroDuplicata('Erro ao carregar a duplicata. Tente novamente.');
  }
}

function abrirPagamento() {
  if (!clienteAtual) {
    alert('Nenhum cliente selecionado para pagamento.');
    return;
  }

  if (!modalPagamentoDuplicata) {
    modalPagamentoDuplicata = new bootstrap.Modal(document.getElementById('modalPagamentoDuplicata'));
    document.getElementById('formPagamentoDuplicata').addEventListener('submit', enviarPagamentoDuplicata);
  }

  document.getElementById('pagamentoValor').value = '';
  document.getElementById('pagamentoData').value = new Date().toISOString().slice(0, 10);
  document.getElementById('pagamentoForma').value = 'dinheiro';
  document.getElementById('pagamentoObservacao').value = '';
  document.getElementById('pagamentoErro').innerText = '';

  modalPagamentoDuplicata.show();
}

async function enviarPagamentoDuplicata(event) {
  event.preventDefault();

  const valorInput = document.getElementById('pagamentoValor').value.replace(',', '.').trim();
  const valor = Number(valorInput);
  const data_pagamento = document.getElementById('pagamentoData').value;
  const forma_pagamento = document.getElementById('pagamentoForma').value;
  const observacao = document.getElementById('pagamentoObservacao').value.trim();
  const erroElemento = document.getElementById('pagamentoErro');

  erroElemento.innerText = '';

  if (!valorInput || Number.isNaN(valor) || valor <= 0) {
    erroElemento.innerText = 'Informe um valor válido maior que zero.';
    return;
  }

  if (!data_pagamento) {
    erroElemento.innerText = 'Informe a data do pagamento.';
    return;
  }

  try {
    const response = await fetch(`/api/financeiro/receber/agrupado/${clienteAtual}/pagamento-parcial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({
        valor,
        data_pagamento,
        forma_pagamento,
        observacao: observacao || `Pagamento parcial realizado em ${data_pagamento}`
      })
    });

    const resultado = await response.json();

    if (!response.ok || !resultado.success) {
      const mensagem = resultado.error || 'Não foi possível processar o pagamento.';
      erroElemento.innerText = mensagem;
      return;
    }

    if (modalPagamentoDuplicata) {
      modalPagamentoDuplicata.hide();
    }

    if (typeof showNotification === 'function') {
      showNotification('Pagamento parcial realizado com sucesso.', 'success');
    } else {
      alert('Pagamento parcial realizado com sucesso.');
    }

    carregarDuplicata(clienteAtual);
  } catch (erro) {
    console.error('Erro no pagamento parcial:', erro);
    erroElemento.innerText = 'Ocorreu um erro ao processar o pagamento. Tente novamente.';
  }
}

async function abrirHistorico() {
  if (!clienteAtual) {
    alert('Nenhum cliente selecionado.');
    return;
  }

  if (!modalHistoricoDuplicata) {
    modalHistoricoDuplicata = new bootstrap.Modal(document.getElementById('modalHistoricoDuplicata'));
  }

  document.getElementById('historicoPagamentosBody').innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';
  modalHistoricoDuplicata.show();

  try {
    const response = await fetch(`/api/financeiro/receber/agrupado/${clienteAtual}/pagamentos`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      document.getElementById('historicoPagamentosBody').innerHTML = `<tr><td colspan="5" class="text-danger text-center">${data.error || 'Erro ao carregar histórico.'}</td></tr>`;
      return;
    }

    if (!data.pagamentos.length) {
      document.getElementById('historicoPagamentosBody').innerHTML = '<tr><td colspan="5" class="text-center">Nenhum pagamento registrado.</td></tr>';
      return;
    }

    document.getElementById('historicoPagamentosBody').innerHTML = data.pagamentos.map(pagamento => `
      <tr>
        <td>${formatarData(pagamento.data_pagamento)}</td>
        <td>${pagamento.venda_codigo || '-'}</td>
        <td>${pagamento.parcela || '-'}</td>
        <td>${formatarMoeda(pagamento.valor_pago)}</td>
        <td>${escapeHtml(pagamento.forma_pagamento || '-')}</td>
      </tr>
    `).join('');
  } catch (erro) {
    console.error('Erro ao carregar histórico de pagamentos:', erro);
    document.getElementById('historicoPagamentosBody').innerHTML = '<tr><td colspan="5" class="text-danger text-center">Erro ao carregar histórico.</td></tr>';
  }
}

function abrirDetalhesRecebimento(vendaId) {
  if (!modalDetalhesRecebimento) {
    modalDetalhesRecebimento = new bootstrap.Modal(document.getElementById('modalDetalhesRecebimento'));
  }

  const venda = duplicataVendas.find(item => Number(item.venda_id) === Number(vendaId));
  if (!venda) {
    alert('Detalhes da venda não encontrados.');
    return;
  }

  document.getElementById('detalhesRecebimentoBody').innerHTML = renderizarDetalhesRecebimento(venda);
  modalDetalhesRecebimento.show();
}

function renderizarDetalhesRecebimento(venda) {
  const produtos = Array.isArray(venda.produtos) ? venda.produtos : [];
  const listaProdutos = produtos.map(produto => `
    <tr>
      <td>${escapeHtml(produto.nome_produto || '-')}</td>
      <td>${produto.quantidade || 0}</td>
      <td>${formatarMoeda(produto.preco_unitario || 0)}</td>
      <td>${formatarMoeda(produto.subtotal || 0)}</td>
    </tr>
  `).join('');

  const primeiraParcela = Array.isArray(venda.parcelas) && venda.parcelas.length ? venda.parcelas[0] : null;
  const parcelaTexto = primeiraParcela ? primeiraParcela.parcela : '-';

  return `
    <div class="mb-3">
      <strong>Venda:</strong> #${venda.numero_venda || venda.venda_id}<br>
      <strong>Data da venda:</strong> ${formatarData(venda.data_venda)}<br>
      <strong>Vencimento:</strong> ${venda.data_vencimento ? formatarData(venda.data_vencimento) : '-'}<br>
      <strong>Status:</strong> <span class="status ${obterClasseStatus(venda.status)}">${venda.status || 'aberto'}</span>
    </div>

    <div class="d-flex gap-3 mb-3 flex-wrap">
      <div><strong>Total da venda:</strong> ${formatarMoeda(Number(venda.valor_total || 0))}</div>
      <div><strong>Já pago:</strong> ${formatarMoeda(Number(venda.valor_pago || 0))}</div>
      <div><strong>Saldo aberto:</strong> ${formatarMoeda(Number(venda.saldo_aberto || 0))}</div>
      <div><strong>Parcelas:</strong> ${parcelaTexto}</div>
    </div>

    <div class="mb-3">
      <h6>Produtos</h6>
      <table class="table table-sm table-striped">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtde</th>
            <th>Preço</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${listaProdutos || '<tr><td colspan="4" class="text-center">Sem produtos registrados</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="mb-3">
      <h6>Parcelas em aberto</h6>
      <table class="table table-sm table-bordered">
        <thead>
          <tr>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>Valor</th>
            <th>Saldo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${(venda.parcelas || []).map(parcela => `
            <tr>
              <td>${escapeHtml(parcela.parcela || '-')}</td>
              <td>${formatarData(parcela.vencimento)}</td>
              <td>${formatarMoeda(parcela.valor_parcela || 0)}</td>
              <td>${formatarMoeda(parcela.valor_restante || 0)}</td>
              <td><span class="status ${obterClasseStatus(parcela.status)}">${parcela.status || 'aberto'}</span></td>
            </tr>
          `).join('') || '<tr><td colspan="5" class="text-center">Sem parcelas registradas</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderizarHeaderDuplicata(cliente) {
  document.getElementById('clienteNome').innerText = cliente.nome || 'Cliente não identificado';
  document.getElementById('clienteCpf').innerText = cliente.cpf || '';
}

function atualizarResumoFinanceiro(resumo) {
  const totalDivida = Number(resumo.totalDivida || 0);
  const totalPago = Number(resumo.totalPago || 0);
  const saldoAtual = Number(resumo.saldoAtual || 0);

  document.getElementById('totalDivida').innerText = formatarMoeda(totalDivida);
  document.getElementById('totalPago').innerText = formatarMoeda(totalPago);
  document.getElementById('saldoAtual').innerText = formatarMoeda(saldoAtual);

  const statusElemento = document.getElementById('statusCliente');
  if (saldoAtual <= 0) {
    statusElemento.innerText = 'QUITADO';
    statusElemento.className = 'status verde';
  } else if (totalPago > 0) {
    statusElemento.innerText = 'PAGAMENTO PARCIAL';
    statusElemento.className = 'status amarelo';
  } else {
    statusElemento.innerText = 'EM ABERTO';
    statusElemento.className = 'status vermelho';
  }
}

function renderizarParcelasDuplicata(vendas) {
  const tbody = document.getElementById('listaParcelas');
  tbody.innerHTML = '';

  if (!vendas.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma parcela encontrada.</td></tr>';
    return;
  }

  vendas.forEach(venda => {
    const valorTotal = Number(venda.valor_total || 0);
    const valorRestante = Number(venda.saldo_aberto || 0);
    const dataVenda = formatarData(venda.data_venda);
    const statusClass = obterClasseStatus(venda.status);

    tbody.innerHTML += `
      <tr>
        <td>#${venda.numero_venda || venda.venda_id}</td>
        <td>${dataVenda}</td>
        <td>${venda.data_vencimento ? formatarData(venda.data_vencimento) : '-'}</td>
        <td>${formatarMoeda(valorTotal)}</td>
        <td>${formatarMoeda(valorRestante)}</td>
        <td><span class="status ${statusClass}">${venda.status || 'aberto'}</span></td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-info" onclick="abrirDetalhesRecebimento(${venda.venda_id})">Detalhes</button>
        </td>
      </tr>
    `;
  });
}

function renderizarDetalhesCompras(vendas) {
  const container = document.getElementById('detalhesCompras');
  container.innerHTML = '';

  if (!vendas.length) {
    container.innerHTML = '<p class="text-muted">Nenhum detalhe de compra disponível.</p>';
    return;
  }

  vendas.forEach(venda => {
    const produtos = Array.isArray(venda.produtos) ? venda.produtos : [];
    const listaProdutos = produtos.map(produto => `
      <tr>
        <td>${escapeHtml(produto.nome_produto || '-')}</td>
        <td>${produto.quantidade || 0}</td>
        <td>${formatarMoeda(produto.preco_unitario || 0)}</td>
        <td>${formatarMoeda(produto.subtotal || 0)}</td>
      </tr>
    `).join('');

    container.innerHTML += `
      <div class="duplicata-compra-card">
        <div class="duplicata-compra-header">
          <div><strong>Venda:</strong> #${venda.numero_venda || venda.venda_id}</div>
          <div><strong>Data:</strong> ${formatarData(venda.data_venda)}</div>
          <div><strong>Status:</strong> <span class="status ${obterClasseStatus(venda.status)}">${venda.status || 'aberto'}</span></div>
        </div>
        <div class="duplicata-compra-saldo">
          <span>Total: ${formatarMoeda(Number(venda.valor_total || 0))}</span>
          <span>Pago: ${formatarMoeda(Number(venda.valor_pago || 0))}</span>
          <span>Saldo: ${formatarMoeda(Number(venda.saldo_aberto || 0))}</span>
        </div>
        <table class="tabela duplicata-produtos">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtde</th>
              <th>Preço</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${listaProdutos || '<tr><td colspan="4" class="text-center">Sem produtos registrados</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });
}

function obterClasseStatus(status) {
  if (status === 'vencido') return 'vermelho';
  if (status === 'parcial') return 'amarelo';
  if (status === 'aberto') return 'vermelho';
  return 'verde';
}

function formatarData(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString('pt-BR');
}