/**
 * VendaApplicationService — Porta oficial de aplicação do Núcleo Transacional da Venda.
 *
 * Sprint 2.0: fachada pura de entrada.
 * Coordena o acesso ao núcleo existente sem conter regras de negócio.
 *
 * Proibido neste módulo (Sprint 2.0):
 * - if / switch de negócio
 * - cálculos, validações fiscais/financeiras
 * - estoque, pagamentos, persistência, emissão
 *
 * Fluxo oficial:
 *   Controller → VendaApplicationService → VendaPagamentoService
 *
 * @module services/vendas/VendaApplicationService
 */

const VendaPagamentoService = require('./VendaPagamentoService');

/**
 * Cria uma venda delegando integralmente ao núcleo transacional.
 * Sem alteração de parâmetros, transformação ou tratamento adicional.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {*}
 */
function criarVenda(req, res) {
  return VendaPagamentoService.criarVenda(req, res);
}

module.exports = {
  criarVenda
};
