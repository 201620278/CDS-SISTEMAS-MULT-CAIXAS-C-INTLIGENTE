/**
 * FiscalProvider — indicadores fiscais e não fiscais de vendas/entradas.
 * Consulta somente leitura no banco. Não altera Plataforma Fiscal nem Central.
 */

const db = require('../../database');
const {
  FILTRO_VENDA_VALIDA,
  getExprValorVendaFiscal,
  getExprValorVendaNaoFiscal
} = require('../../services/reportFiscalHelpers');
const { criarMonitoringResult } = require('../MonitoringResult');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || {})));
  });
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dataHojeBrasil() {
  const agora = new Date();
  const dataBrasil = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
  const ano = dataBrasil.getFullYear();
  const mes = String(dataBrasil.getMonth() + 1).padStart(2, '0');
  const dia = String(dataBrasil.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function periodoMes(hoje) {
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
}

function periodoAno(hoje) {
  return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje };
}

async function agregarVendas(exprValor, inicio, fim) {
  const row = await dbGet(
    `SELECT
       COALESCE(SUM(${exprValor}), 0) AS valor,
       COUNT(CASE WHEN COALESCE(${exprValor}, 0) > 0 THEN 1 END) AS quantidade
     FROM vendas v
     WHERE date(v.data_venda) BETWEEN date(?) AND date(?)
       AND ${FILTRO_VENDA_VALIDA}`,
    [inicio, fim]
  );
  return { valor: num(row.valor), quantidade: num(row.quantidade) };
}

async function agregarEntradasFiscais(inicio, fim) {
  const row = await dbGet(
    `SELECT
       COALESCE(SUM(valor_total), 0) AS valor,
       COUNT(*) AS quantidade
     FROM central_entradas_documentos
     WHERE date(COALESCE(data_entrada, data_emissao, created_at)) BETWEEN date(?) AND date(?)`,
    [inicio, fim]
  );
  return { valor: num(row.valor), quantidade: num(row.quantidade) };
}

async function ultimaEntradaFiscal() {
  const row = await dbGet(
    `SELECT numero, chave, fornecedor, valor_total, data_emissao, data_entrada, created_at
     FROM central_entradas_documentos
     ORDER BY datetime(COALESCE(data_entrada, data_emissao, created_at)) DESC, id DESC
     LIMIT 1`
  );
  if (!row || (!row.chave && !row.numero)) {
    return { ultimaNf: null, fornecedor: null };
  }
  return {
    ultimaNf: {
      numero: row.numero || null,
      chave: row.chave || null,
      valor: num(row.valor_total),
      data: row.data_entrada || row.data_emissao || row.created_at || null
    },
    fornecedor: row.fornecedor || null
  };
}

/** Entradas não fiscais = compras manuais (sem chave de acesso NF-e). */
async function agregarEntradasNaoFiscais(inicio, fim) {
  const row = await dbGet(
    `SELECT
       COALESCE(SUM(COALESCE(NULLIF(valor_total_nota, 0), total, 0)), 0) AS valor,
       COUNT(*) AS quantidade
     FROM compras
     WHERE date(COALESCE(data_entrada, data_compra, created_at)) BETWEEN date(?) AND date(?)
       AND (chave_acesso IS NULL OR TRIM(chave_acesso) = '')`,
    [inicio, fim]
  );
  return { valor: num(row.valor), quantidade: num(row.quantidade) };
}

async function ultimaEntradaNaoFiscal() {
  const row = await dbGet(
    `SELECT numero_nf, fornecedor, COALESCE(NULLIF(valor_total_nota, 0), total, 0) AS valor_total,
            data_entrada, data_compra, created_at
     FROM compras
     WHERE chave_acesso IS NULL OR TRIM(chave_acesso) = ''
     ORDER BY datetime(COALESCE(data_entrada, data_compra, created_at)) DESC, id DESC
     LIMIT 1`
  );
  if (!row || (!row.numero_nf && !row.fornecedor && !num(row.valor_total))) {
    return { ultimaNf: null, fornecedor: null };
  }
  return {
    ultimaNf: {
      numero: row.numero_nf || null,
      chave: null,
      valor: num(row.valor_total),
      data: row.data_entrada || row.data_compra || row.created_at || null
    },
    fornecedor: row.fornecedor || null
  };
}

function montarBlocoPeriodo(hoje, mes, ano) {
  return {
    valor: hoje.valor,
    quantidade: hoje.quantidade,
    hoje,
    mes,
    ano
  };
}

const FiscalProvider = {
  id: 'fiscal',

  async collect(/* context */) {
    const inicio = Date.now();
    const warnings = [];
    const errors = [];

    try {
      const hojeStr = dataHojeBrasil();
      const mes = periodoMes(hojeStr);
      const ano = periodoAno(hojeStr);
      const exprFiscal = getExprValorVendaFiscal();
      const exprNaoFiscal = getExprValorVendaNaoFiscal();

      const [
        vendasFiscalHoje,
        vendasFiscalMes,
        vendasFiscalAno,
        vendasNaoFiscalHoje,
        vendasNaoFiscalMes,
        vendasNaoFiscalAno,
        entradasFiscalHoje,
        entradasFiscalMes,
        entradasFiscalAno,
        ultimaFiscal,
        entradasNaoFiscalHoje,
        entradasNaoFiscalMes,
        entradasNaoFiscalAno,
        ultimaNaoFiscal
      ] = await Promise.all([
        agregarVendas(exprFiscal, hojeStr, hojeStr),
        agregarVendas(exprFiscal, mes.inicio, mes.fim),
        agregarVendas(exprFiscal, ano.inicio, ano.fim),
        agregarVendas(exprNaoFiscal, hojeStr, hojeStr),
        agregarVendas(exprNaoFiscal, mes.inicio, mes.fim),
        agregarVendas(exprNaoFiscal, ano.inicio, ano.fim),
        agregarEntradasFiscais(hojeStr, hojeStr),
        agregarEntradasFiscais(mes.inicio, mes.fim),
        agregarEntradasFiscais(ano.inicio, ano.fim),
        ultimaEntradaFiscal(),
        agregarEntradasNaoFiscais(hojeStr, hojeStr),
        agregarEntradasNaoFiscais(mes.inicio, mes.fim),
        agregarEntradasNaoFiscais(ano.inicio, ano.fim),
        ultimaEntradaNaoFiscal()
      ]);

      const data = {
        vendas: montarBlocoPeriodo(vendasFiscalHoje, vendasFiscalMes, vendasFiscalAno),
        entradas: {
          ...montarBlocoPeriodo(entradasFiscalHoje, entradasFiscalMes, entradasFiscalAno),
          ultimaNf: ultimaFiscal.ultimaNf,
          fornecedor: ultimaFiscal.fornecedor
        },
        naoFiscal: {
          vendas: montarBlocoPeriodo(vendasNaoFiscalHoje, vendasNaoFiscalMes, vendasNaoFiscalAno),
          entradas: {
            ...montarBlocoPeriodo(entradasNaoFiscalHoje, entradasNaoFiscalMes, entradasNaoFiscalAno),
            ultimaNf: ultimaNaoFiscal.ultimaNf,
            fornecedor: ultimaNaoFiscal.fornecedor
          }
        }
      };

      return criarMonitoringResult({
        success: true,
        source: 'FiscalProvider',
        metrics: { tempoConsultaMs: Date.now() - inicio },
        data,
        warnings,
        errors
      });
    } catch (err) {
      errors.push(err.message || String(err));
      return criarMonitoringResult({
        success: false,
        source: 'FiscalProvider',
        metrics: { tempoConsultaMs: Date.now() - inicio },
        data: {
          vendas: montarBlocoPeriodo({ valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }),
          entradas: {
            ...montarBlocoPeriodo({ valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }),
            ultimaNf: null,
            fornecedor: null
          },
          naoFiscal: {
            vendas: montarBlocoPeriodo({ valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }),
            entradas: {
              ...montarBlocoPeriodo({ valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }, { valor: 0, quantidade: 0 }),
              ultimaNf: null,
              fornecedor: null
            }
          }
        },
        warnings,
        errors
      });
    }
  }
};

module.exports = FiscalProvider;
