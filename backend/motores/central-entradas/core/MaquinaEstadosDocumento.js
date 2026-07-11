/**
 * MaquinaEstadosDocumento — Validação de transições de estado do documento fiscal.
 *
 * RC3: transições alinhadas aos fluxos reais (persistência → processamento → compras).
 * RC6.2: AGUARDANDO_XML_COMPLETO para resumos DF-e (resNFe).
 *
 * Notas de consolidação:
 * - RECEBIDA: reservado (default de inserir); fluxo normal persiste como SINCRONIZADA/DUPLICADA/AGUARDANDO_XML_COMPLETO.
 * - EM_PROCESSAMENTO → REVISADA: removido (nunca usado pelo pipeline; usa AGUARDANDO_REVISAO).
 * - REVISADA → EM_COMPRA: permitido para alinhar com registrarAberturaCompra.
 * - AGUARDANDO_XML_COMPLETO: não entra no pipeline Parser/MIIP até haver XML completo (→ SINCRONIZADA).
 *
 * @module motores/central-entradas/core/MaquinaEstadosDocumento
 */

const { DocumentoFiscalStatus, isTerminal } = require('./DocumentoFiscalStatus');

const TRANSICOES_PERMITIDAS = Object.freeze({
  [DocumentoFiscalStatus.RECEBIDA]: [
    DocumentoFiscalStatus.SINCRONIZADA,
    DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO,
    DocumentoFiscalStatus.DUPLICADA,
    DocumentoFiscalStatus.ERRO
  ],
  [DocumentoFiscalStatus.SINCRONIZADA]: [
    DocumentoFiscalStatus.EM_PROCESSAMENTO,
    DocumentoFiscalStatus.DESCARTADA,
    DocumentoFiscalStatus.DUPLICADA,
    DocumentoFiscalStatus.ERRO
  ],
  [DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO]: [
    DocumentoFiscalStatus.SINCRONIZADA,
    DocumentoFiscalStatus.DESCARTADA
  ],
  [DocumentoFiscalStatus.EM_PROCESSAMENTO]: [
    DocumentoFiscalStatus.AGUARDANDO_REVISAO,
    DocumentoFiscalStatus.PRONTA_PARA_COMPRA,
    DocumentoFiscalStatus.ERRO
  ],
  [DocumentoFiscalStatus.AGUARDANDO_REVISAO]: [
    DocumentoFiscalStatus.REVISADA,
    DocumentoFiscalStatus.DESCARTADA,
    DocumentoFiscalStatus.ERRO
  ],
  [DocumentoFiscalStatus.REVISADA]: [
    DocumentoFiscalStatus.PRONTA_PARA_COMPRA,
    DocumentoFiscalStatus.EM_COMPRA,
    DocumentoFiscalStatus.DESCARTADA
  ],
  [DocumentoFiscalStatus.PRONTA_PARA_COMPRA]: [
    DocumentoFiscalStatus.EM_COMPRA,
    DocumentoFiscalStatus.DESCARTADA
  ],
  [DocumentoFiscalStatus.EM_COMPRA]: [
    DocumentoFiscalStatus.GRAVADA,
    DocumentoFiscalStatus.PRONTA_PARA_COMPRA
  ],
  [DocumentoFiscalStatus.ERRO]: [
    DocumentoFiscalStatus.SINCRONIZADA
  ],
  [DocumentoFiscalStatus.GRAVADA]: [],
  [DocumentoFiscalStatus.DESCARTADA]: [],
  [DocumentoFiscalStatus.DUPLICADA]: []
});

/**
 * @param {string} statusAtual
 * @param {string} statusNovo
 * @returns {boolean}
 */
function podeTransicionar(statusAtual, statusNovo) {
  if (!statusAtual || !statusNovo) return false;
  if (statusAtual === statusNovo) return true;
  if (isTerminal(statusAtual)) return false;

  const permitidos = TRANSICOES_PERMITIDAS[statusAtual] || [];
  return permitidos.includes(statusNovo);
}

/**
 * @param {string} statusAtual
 * @param {string} statusNovo
 * @returns {{ valido: boolean, erro?: string }}
 */
function validarTransicao(statusAtual, statusNovo) {
  if (!statusAtual || !statusNovo) {
    return { valido: false, erro: 'Status atual e novo são obrigatórios' };
  }

  if (statusAtual === statusNovo) {
    return { valido: true };
  }

  if (isTerminal(statusAtual)) {
    return { valido: false, erro: `Status terminal não permite transição: ${statusAtual}` };
  }

  if (!podeTransicionar(statusAtual, statusNovo)) {
    return {
      valido: false,
      erro: `Transição inválida: ${statusAtual} → ${statusNovo}`
    };
  }

  return { valido: true };
}

module.exports = {
  TRANSICOES_PERMITIDAS,
  podeTransicionar,
  validarTransicao
};
