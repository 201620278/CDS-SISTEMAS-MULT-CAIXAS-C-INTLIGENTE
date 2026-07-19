/**
 * Resolve qual layout de etiqueta usar (contexto / equipamento / default).
 * Não altera PDV — apenas infraestrutura MIP Sprint 04.
 * @module motores/produto-identidade/config/etiquetaBalancaConfig
 */

const { criarDbHelpers, resolverDb } = require('../../miip/repositories/dbHelpers');
const { CONFIG_CHAVE_STRATEGY, LAYOUT_DEFAULT, LAYOUT_IDS } = require('../layouts/layoutIds');

/**
 * @param {Object} [contexto]
 * @param {Object} [deps]
 * @returns {Promise<string>} layoutId
 */
async function resolverLayoutId(contexto = {}, deps = {}) {
  if (contexto.layoutStrategy && String(contexto.layoutStrategy).trim()) {
    return String(contexto.layoutStrategy).trim();
  }

  const equipamentoId = contexto.equipamentoId != null
    ? Number(contexto.equipamentoId)
    : null;

  if (equipamentoId && Number.isFinite(equipamentoId) && equipamentoId > 0) {
    const db = deps.db ?? resolverDb(deps);
    if (db) {
      const helpers = criarDbHelpers(db);
      await helpers.whenReady();
      try {
        const row = await helpers.get(
          `SELECT valor FROM equipamentos_configuracoes
           WHERE equipamento_id = ? AND chave = ?
           LIMIT 1`,
          [equipamentoId, CONFIG_CHAVE_STRATEGY]
        );
        if (row?.valor && String(row.valor).trim()) {
          return String(row.valor).trim();
        }
      } catch {
        // tabela pode não existir em testes mínimos — default
      }
    }
  }

  return LAYOUT_DEFAULT;
}

module.exports = {
  resolverLayoutId,
  CONFIG_CHAVE_STRATEGY,
  LAYOUT_DEFAULT,
  LAYOUT_IDS
};
