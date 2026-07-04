/**
 * Motor de Equipamentos — Fachada pública
 *
 * Ponto de entrada único do módulo, espelhando o padrão de `backend/services/tef/index.js`.
 * Todas as operações externas devem delegar ao EquipamentosManager.
 *
 * Responsabilidade:
 * - Expor API estável para rotas, workers e outros módulos do CDS
 * - Ocultar detalhes internos de drivers, fila e persistência
 *
 * @module motores/equipamentos
 */

const equipamentosManager = require('./core/EquipamentosManager');
const contracts = require('./contracts');

// Contratos oficiais exportados via contracts/ (Sprint 7)
// TODO: Exportar métodos de alto nível: conectar, sincronizarProdutos, obterPeso, diagnosticar
// TODO: Integrar com rotas REST /api/equipamentos (sprint futura)

/**
 * Inicializa o motor de equipamentos.
 * @param {Object} [opcoes] - Opções de bootstrap
 * @returns {Promise<void>}
 */
async function inicializar(opcoes = {}) {
  // TODO: Delegar ao EquipamentosManager.inicializar(opcoes)
  return equipamentosManager.inicializar(opcoes);
}

/**
 * Encerra o motor de equipamentos e libera recursos.
 * @returns {Promise<void>}
 */
async function encerrar() {
  // TODO: Delegar ao EquipamentosManager.encerrar()
  return equipamentosManager.encerrar();
}

module.exports = {
  inicializar,
  encerrar,
  equipamentosManager,
  contracts
};
