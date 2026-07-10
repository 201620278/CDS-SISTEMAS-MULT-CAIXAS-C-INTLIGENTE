/**
 * CentralEntradasService — Fachada HTTP da Central Inteligente de Entradas.
 *
 * RC1: delega exclusivamente ao CentralEntradasOrchestrator.
 *
 * @class CentralEntradasService
 */

const orchestrator = require('./CentralEntradasOrchestrator');

class CentralEntradasService {
  /**
   * @param {Object} [deps]
   * @param {import('./CentralEntradasOrchestrator').CentralEntradasOrchestrator} [deps.orchestrator]
   */
  constructor(deps = {}) {
    /** @private */
    this._orchestrator = deps.orchestrator ?? orchestrator;
  }

  estaHabilitado() {
    return this._orchestrator.estaHabilitado();
  }

  obterHealth() {
    return this._orchestrator.obterHealth();
  }

  obterMetadados() {
    return this._orchestrator.obterMetadados();
  }

  listarDocumentos(filtros = {}) {
    return this._orchestrator.listarDocumentos(filtros);
  }

  obterDocumento(id) {
    return this._orchestrator.obterDocumento(id);
  }

  obterDocumentoDetalhe(id) {
    return this._orchestrator.obterDocumentoDetalhe(id);
  }

  obterHistorico(documentoId) {
    return this._orchestrator.obterHistorico(documentoId);
  }

  obterDashboard() {
    return this._orchestrator.obterDashboard();
  }

  alterarStatus(id, novoStatus, opcoes = {}) {
    return this._orchestrator.alterarStatusManual(id, novoStatus, opcoes);
  }

  sincronizar(opcoes = {}) {
    return this._orchestrator.sincronizar(opcoes);
  }

  sincronizarAoAbrir() {
    return this._orchestrator.sincronizarAoAbrir();
  }

  uploadDocumentos(arquivos = [], opcoes = {}) {
    return this._orchestrator.uploadDocumentos(arquivos, opcoes);
  }

  buscarPorChave(chave) {
    return this._orchestrator.buscarPorChave(chave);
  }

  obterXmlDocumento(id) {
    return this._orchestrator.obterXmlDocumento(id);
  }

  obterParseDocumento(id) {
    return this._orchestrator.obterParseDocumento(id);
  }

  processarDocumento(id, opcoes = {}) {
    return this._orchestrator.processarDocumento(id, opcoes);
  }

  concluirRevisao(id, dados = {}) {
    return this._orchestrator.concluirRevisao(id, dados);
  }

  obterPayloadCompra(id) {
    return this._orchestrator.obterPayloadCompra(id);
  }

  abrirCompra(id, opcoes = {}) {
    return this._orchestrator.abrirCompra(id, opcoes);
  }

  vincularCompra(documentoId, compraId, opcoes = {}) {
    return this._orchestrator.vincularCompra(documentoId, compraId, opcoes);
  }

  listarAlertas() {
    return this._orchestrator.listarAlertas();
  }

  obterPendencias(opcoes = {}) {
    return this._orchestrator.obterPendencias(opcoes);
  }

  obterOperacional() {
    return this._orchestrator.obterOperacional();
  }

  obterItensAtencao(opcoes = {}) {
    return this._orchestrator.obterItensAtencao(opcoes);
  }

  obterInteligenciaOperacional(opcoes = {}) {
    return this._orchestrator.obterInteligenciaOperacional(opcoes);
  }

  obterScoreDocumento(id) {
    return this._orchestrator.obterScoreDocumento(id);
  }

  obterEstatisticasFornecedor(cnpj, opcoes = {}) {
    return this._orchestrator.obterEstatisticasFornecedor(cnpj, opcoes);
  }

  obterConfiguracoes() {
    return this._orchestrator.obterConfiguracoes();
  }

  obterConfiguracaoEnterprise() {
    return this._orchestrator.obterConfiguracaoEnterprise();
  }

  atualizarConfiguracoes(alteracoes) {
    return this._orchestrator.atualizarConfiguracoes(alteracoes);
  }

  restaurarConfiguracaoPadrao(opcoes = {}) {
    return this._orchestrator.restaurarConfiguracaoPadrao(opcoes);
  }

  listarEventos(filtros = {}) {
    return this._orchestrator.listarEventos(filtros);
  }

  obterStatusServico() {
    return this._orchestrator.obterStatusServico();
  }

  listarNotificacoes(filtros = {}) {
    return this._orchestrator.listarNotificacoes(filtros);
  }

  marcarNotificacaoLida(id) {
    return this._orchestrator.marcarNotificacaoLida(id);
  }

  marcarTodasNotificacoesLidas() {
    return this._orchestrator.marcarTodasNotificacoesLidas();
  }

  obterDiagnostico(opcoes = {}) {
    return this._orchestrator.obterDiagnostico(opcoes);
  }

  executarHealthCheckDiagnostico() {
    return this._orchestrator.executarHealthCheckDiagnostico();
  }

  testarCertificadoDiagnostico() {
    return this._orchestrator.testarCertificadoDiagnostico();
  }

  testarSefazDiagnostico() {
    return this._orchestrator.testarSefazDiagnostico();
  }

  limparCacheDiagnostico() {
    return this._orchestrator.limparCacheDiagnostico();
  }

  processarDocumentosPendentes(opcoes = {}) {
    return this._orchestrator.processarDocumentosPendentes(opcoes);
  }
}

module.exports = CentralEntradasService;
