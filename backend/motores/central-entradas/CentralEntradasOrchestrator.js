/**
 * CentralEntradasOrchestrator — Orquestrador oficial da Central Inteligente de Entradas.
 *
 * RC1: único ponto de coordenação dos fluxos de negócio.
 * Padrão equivalente ao MiipOrchestrator.
 *
 * @class CentralEntradasOrchestrator
 */

const centralEntradasFlags = require('./config/centralEntradasFlags');
const { ORIGENS } = require('./config/centralEventosTipos');
const { isValido } = require('./core/DocumentoFiscalStatus');
const { listarPresets } = require('./utils/filtrosRapidosCentral');
const { paraDetalheCompletoDTO } = require('./utils/centralEntradasMapper');
const { gravarAuditoria } = require('../../services/auditoria');

const CentralDocumentosRepository = require('./repositories/CentralDocumentosRepository');
const CentralHistoricoRepository = require('./repositories/CentralHistoricoRepository');
const CentralNsuRepository = require('./repositories/CentralNsuRepository');

const DocumentoTransitionService = require('./services/DocumentoTransitionService');
const CentralDocumentoService = require('./services/CentralDocumentoService');
const CentralHistoricoService = require('./services/CentralHistoricoService');
const CentralDashboardService = require('./services/CentralDashboardService');
const CentralSincronizacaoService = require('./services/CentralSincronizacaoService');
const CentralProcessamentoService = require('./services/CentralProcessamentoService');
const CentralComprasBridgeService = require('./services/CentralComprasBridgeService');
const CentralScoreDocumentoService = require('./services/CentralScoreDocumentoService');
const CentralAlertasService = require('./services/CentralAlertasService');
const CentralScoreFornecedorService = require('./services/CentralScoreFornecedorService');
const CentralPendenciasService = require('./services/CentralPendenciasService');
const CentralOperacionalDashboardService = require('./services/CentralOperacionalDashboardService');
const CentralAtencaoService = require('./services/CentralAtencaoService');
const CentralConfiguracaoService = require('./services/CentralConfiguracaoService');
const CentralEventosService = require('./services/CentralEventosService');
const CentralNotificacoesService = require('./services/CentralNotificacoesService');
const CentralUploadService = require('./services/CentralUploadService');
const CentralSyncExecucaoService = require('./services/CentralSyncExecucaoService');
const CentralDiagnosticoService = require('./services/CentralDiagnosticoService');

const VERSAO_MODULO = '1.0.0-rc4';

class CentralEntradasOrchestrator {
  /**
   * @param {Object} [deps]
   */
  constructor(deps = {}) {
    const repoDeps = { db: deps.db ?? null };
    const documentosRepository = deps.documentosRepository
      ?? new CentralDocumentosRepository(repoDeps);
    const historicoRepository = deps.historicoRepository
      ?? new CentralHistoricoRepository(repoDeps);
    const nsuRepository = deps.nsuRepository ?? new CentralNsuRepository(repoDeps);

    /** @private */
    this._flags = deps.flags ?? centralEntradasFlags;
    /** @private */
    this._documentosRepository = documentosRepository;
    /** @private */
    this._nsuRepository = nsuRepository;

    /** @private */
    this._transitionService = deps.transitionService ?? new DocumentoTransitionService({
      documentosRepository,
      historicoRepository
    });

    /** @private */
    this._historicoService = deps.historicoService
      ?? new CentralHistoricoService({ historicoRepository });

    /** @private */
    this._documentoService = deps.documentoService
      ?? new CentralDocumentoService({ documentosRepository });

    /** @private */
    this._dashboardService = deps.dashboardService
      ?? new CentralDashboardService({ documentosRepository, nsuRepository });

    /** @private */
    this._sincronizacaoService = deps.sincronizacaoService
      ?? new CentralSincronizacaoService({ documentosRepository });

    /** @private */
    this._processamentoService = deps.processamentoService
      ?? new CentralProcessamentoService({
        documentosRepository,
        historicoRepository,
        transitionService: this._transitionService
      });

    /** @private */
    this._comprasBridgeService = deps.comprasBridgeService
      ?? new CentralComprasBridgeService({
        documentosRepository,
        historicoRepository,
        transitionService: this._transitionService
      });

    /** @private */
    this._scoreDocumentoService = deps.scoreDocumentoService
      ?? new CentralScoreDocumentoService();

    /** @private */
    this._alertasService = deps.alertasService
      ?? new CentralAlertasService({ documentosRepository, nsuRepository });

    /** @private */
    this._scoreFornecedorService = deps.scoreFornecedorService
      ?? new CentralScoreFornecedorService({
        documentosRepository,
        scoreService: this._scoreDocumentoService
      });

    /** @private */
    this._pendenciasService = deps.pendenciasService
      ?? new CentralPendenciasService({
        documentosRepository,
        nsuRepository,
        alertasService: this._alertasService
      });

    /** @private */
    this._operacionalService = deps.operacionalService
      ?? new CentralOperacionalDashboardService({
        documentosRepository,
        nsuRepository,
        alertasService: this._alertasService
      });

    /** @private */
    this._atencaoService = deps.atencaoService
      ?? new CentralAtencaoService({
        documentosRepository,
        nsuRepository,
        alertasService: this._alertasService,
        pendenciasService: this._pendenciasService
      });

    /** @private */
    this._configuracaoService = deps.configuracaoService ?? new CentralConfiguracaoService({
      configuracaoRepository: deps.configuracaoRepository
    });
    /** @private @deprecated RC5 — use _configuracaoService; mantido só se injetado em testes legados */
    this._configService = deps.configService ?? this._configuracaoService;
    /** @private */
    this._eventosService = deps.eventosService ?? new CentralEventosService();
    /** @private */
    this._notificacoesService = deps.notificacoesService ?? new CentralNotificacoesService();
    /** @private */
    this._uploadService = deps.uploadService ?? new CentralUploadService({
      processamentoService: this._processamentoService
    });

    /** @private */
    this._syncExecucao = deps.syncExecucao ?? CentralSyncExecucaoService;

    /** @private */
    this._diagnosticoService = deps.diagnosticoService ?? new CentralDiagnosticoService({
      documentosRepository,
      nsuRepository
    });
  }

  /** @private */
  _obterSyncBackground() {
    return require('./services/CentralSyncBackgroundService');
  }

  /**
   * @returns {boolean}
   */
  estaHabilitado() {
    return this._flags.estaHabilitado();
  }

  /**
   * @returns {Promise<Object>}
   */
  async obterHealth() {
    const [
      ultimoNsu,
      ultimoErro,
      ultimaSync,
      tempoMedioMs,
      statusServico
    ] = await Promise.all([
      this._nsuRepository.obterUltimaSincronizacao(),
      this._eventosService.obterUltimoErroSync(),
      this._eventosService.obterUltimaSyncConcluida(),
      this._eventosService.obterTempoMedioSyncMs(),
      Promise.resolve(this._obterSyncBackground().obterStatus())
    ]);

    return {
      modulo: 'central-entradas',
      versao: VERSAO_MODULO,
      habilitado: this.estaHabilitado(),
      status: statusServico.servicoAtivo ? 'ok' : 'ok',
      sprint: 'RC4',
      servicoAtivo: statusServico.servicoAtivo,
      syncAutomaticaHabilitada: statusServico.syncAutomaticaHabilitada,
      executandoSync: statusServico.executando,
      ultimaSincronizacao: ultimoNsu?.dataSincronizacao || ultimoNsu?.updatedAt || null,
      ultimoErro: ultimoErro
        ? { mensagem: ultimoErro.descricao, em: ultimoErro.createdAt }
        : null,
      tempoMedioSyncMs: tempoMedioMs,
      proximaExecucao: statusServico.proximaExecucao,
      ultimaExecucaoAutomatica: statusServico.ultimaExecucao,
      ultimaSyncEvento: ultimaSync
        ? {
          notasNovas: ultimaSync.notasNovas,
          duracaoMs: ultimaSync.duracaoMs,
          em: ultimaSync.createdAt
        }
        : null
    };
  }

  /**
   * @returns {Object}
   */
  obterMetadados() {
    const { TODOS: STATUS_TODOS, LABELS_UI } = require('./core/DocumentoFiscalStatus');
    return {
      modulo: 'Central Inteligente de Entradas',
      versao: VERSAO_MODULO,
      descricao: 'Caixa de Entrada Fiscal (Inbox) — sincroniza, armazena, organiza, monitora e disponibiliza documentos',
      estados: STATUS_TODOS.map((status) => ({
        codigo: status,
        label: LABELS_UI[status] || status
      })),
      filtrosRapidos: listarPresets()
    };
  }

  async listarDocumentos(filtros = {}) {
    return this._documentoService.listar(filtros);
  }

  async obterDocumento(id) {
    return this._documentoService.obterPorId(id);
  }

  async obterDocumentoDetalhe(id) {
    const documento = await this._documentoService.obterBrutoPorId(id);
    if (!documento) return null;

    const historico = await this._historicoService.listarPorDocumento(id);
    return paraDetalheCompletoDTO(documento, historico);
  }

  async obterHistorico(documentoId) {
    return this._historicoService.listarPorDocumento(documentoId);
  }

  async obterDashboard() {
    return this._dashboardService.obterResumo();
  }

  /**
   * Processa documentos SINCRONIZADA sem parse (pipeline único Parser + MIIP).
   *
   * @param {Object} [opcoes]
   * @returns {Promise<Object[]>}
   */
  async processarDocumentosPendentes(opcoes = {}) {
    const limite = Math.min(Number(opcoes.limite) || 100, 200);
    const pendentes = await this._documentosRepository.listarPendentesProcessamento(limite);
    const resultados = [];

    for (const doc of pendentes) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await this._processamentoService.processar(doc.id, {
        usuarioId: opcoes.usuarioId
      });
      resultados.push({
        documentoId: doc.id,
        chave: doc.chave,
        ...resultado
      });
    }

    return resultados;
  }

  /**
   * Sincronização DF-e + auto-processamento pós-sync (fluxo unificado com Upload).
   *
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async executarSincronizacao(opcoes = {}) {
    const resultado = await this._syncExecucao.executar({
      origem: opcoes.origem || ORIGENS.MANUAL,
      ignorarHorario: opcoes.ignorarHorario ?? true,
      forcar: opcoes.forcar,
      maxIteracoes: opcoes.maxIteracoes
    });

    if (resultado.sucesso && !resultado.ignorado) {
      const processamentos = await this.processarDocumentosPendentes({
        usuarioId: opcoes.usuarioId,
        limite: opcoes.limiteProcessamento
      });
      resultado.processamentosAutomaticos = processamentos;
      resultado.documentosProcessados = processamentos.filter((p) => p.sucesso).length;
    }

    return resultado;
  }

  async sincronizar(opcoes = {}) {
    return this.executarSincronizacao({
      origem: opcoes.origem || ORIGENS.MANUAL,
      ignorarHorario: true,
      usuarioId: opcoes.usuarioId
    });
  }

  async sincronizarAoAbrir() {
    const cfg = await this._configuracaoService.obterResumoSync();
    if (!cfg.syncAoAbrir) return null;
    return this.executarSincronizacao({ origem: ORIGENS.ABRIR_CENTRAL });
  }

  async uploadDocumentos(arquivos = [], opcoes = {}) {
    return this._uploadService.processarUpload(arquivos, opcoes);
  }

  async buscarPorChave(chave) {
    const resultado = await this._sincronizacaoService.buscarPorChave(chave);

    if (resultado.novo && resultado.documento?.id) {
      const processamentos = await this.processarDocumentosPendentes({ limite: 5 });
      resultado.processamentosAutomaticos = processamentos;
    }

    return resultado;
  }

  async obterXmlDocumento(id) {
    const documento = await this._documentosRepository.buscarPorId(id);
    if (!documento || !documento.xml) return null;

    return {
      id: documento.id,
      chave: documento.chave,
      xml: documento.xml
    };
  }

  async obterParseDocumento(id) {
    const documento = await this._documentosRepository.buscarPorId(id);
    if (!documento) return null;

    return {
      id: documento.id,
      chave: documento.chave,
      parseDisponivel: Boolean(documento.parseJson),
      parse: documento.parseJson || null,
      miipResumo: documento.miipResumoJson || null,
      processadoEm: documento.processadoEm || null
    };
  }

  async processarDocumento(id, opcoes = {}) {
    return this._processamentoService.processar(id, opcoes);
  }

  async concluirRevisao(id, dados = {}) {
    return this._comprasBridgeService.concluirRevisao(id, dados);
  }

  async obterPayloadCompra(id) {
    return this._comprasBridgeService.montarPayloadAbrirCompra(id);
  }

  async abrirCompra(id, opcoes = {}) {
    return this._comprasBridgeService.registrarAberturaCompra(id, opcoes);
  }

  async vincularCompra(documentoId, compraId, opcoes = {}) {
    return this._comprasBridgeService.vincularCompra(documentoId, compraId, opcoes);
  }

  async listarAlertas() {
    return this._alertasService.listarAlertas();
  }

  async obterPendencias(opcoes = {}) {
    const alertasResultado = opcoes.alertasResultado
      ?? await this._alertasService.listarAlertas();
    return this._pendenciasService.obterPendencias({
      ...opcoes,
      alertasResultado
    });
  }

  async obterOperacional() {
    const alertasResultado = await this._alertasService.listarAlertas();
    return this._operacionalService.obterIndicadores({ alertasResultado });
  }

  async obterItensAtencao(opcoes = {}) {
    const alertasResultado = opcoes.alertasResultado
      ?? await this._alertasService.listarAlertas();
    const pendenciasResultado = opcoes.pendenciasResultado
      ?? await this._pendenciasService.obterPendencias({
        limite: opcoes.limitePendencias ?? 5,
        alertasResultado
      });
    return this._atencaoService.obterItensAtencao({
      alertasResultado,
      pendenciasResultado
    });
  }

  /**
   * Painel de inteligência com um único cálculo de alertas (RC3).
   * Evita recalcular as mesmas consultas em /operacional + /alertas + /pendencias + /atencao.
   *
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async obterInteligenciaOperacional(opcoes = {}) {
    const alertas = await this._alertasService.listarAlertas();
    const pendencias = await this._pendenciasService.obterPendencias({
      limite: opcoes.limitePendencias ?? 20,
      alertasResultado: alertas
    });
    const [operacional, atencao] = await Promise.all([
      this._operacionalService.obterIndicadores({ alertasResultado: alertas }),
      this._atencaoService.obterItensAtencao({
        alertasResultado: alertas,
        pendenciasResultado: pendencias
      })
    ]);

    return {
      alertas,
      operacional,
      pendencias,
      atencao,
      geradoEm: new Date().toISOString()
    };
  }

  async obterScoreDocumento(id) {
    const documento = await this._documentosRepository.buscarPorId(id);
    if (!documento) return null;

    const score = this._scoreDocumentoService.calcular(documento);
    return {
      documentoId: documento.id,
      chave: documento.chave,
      parseDisponivel: Boolean(documento.parseJson),
      miipDisponivel: Boolean(documento.miipResumoJson || documento.miipSessaoId),
      scoreGeral: score.scoreGeral,
      scoreCor: score.cor,
      fatores: score.fatores,
      detalhes: score.detalhes,
      resumo: documento.miipResumoJson?.resumo || null,
      processadoEm: documento.processadoEm || null
    };
  }

  async obterEstatisticasFornecedor(cnpj, opcoes = {}) {
    return this._scoreFornecedorService.obterEstatisticas(cnpj, opcoes);
  }

  async obterConfiguracoes() {
    return this._configuracaoService.obterResumoSync();
  }

  async obterConfiguracaoEnterprise() {
    return this._configuracaoService.obterPainelCompleto();
  }

  async atualizarConfiguracoes(alteracoes) {
    const { emitirEvento, TIPOS_EVENTO } = require('./utils/centralEventosEmitter');
    const resultado = await this._configuracaoService.atualizar(alteracoes);
    await emitirEvento({
      tipo: TIPOS_EVENTO.CONFIG_ALTERADA,
      origem: 'api',
      descricao: 'Configurações da Central atualizadas',
      resultado: 'sucesso',
      sucesso: true,
      detalhe: alteracoes
    });
    await this._obterSyncBackground().reiniciar();
    // Compat sprint8: endpoints /config esperam resumo de sync
    if (resultado && resultado.sincronizacao) {
      return {
        ...resultado.sincronizacao,
        reprocessamentoAutomatico: resultado.sincronizacao.reprocessamentoAutomatico
      };
    }
    return this._configuracaoService.obterResumoSync();
  }

  async restaurarConfiguracaoPadrao(opcoes = {}) {
    const painel = await this._configuracaoService.restaurarPadrao(opcoes);
    await this._obterSyncBackground().reiniciar();
    return painel;
  }

  async listarEventos(filtros = {}) {
    return this._eventosService.listarLog(filtros);
  }

  obterStatusServico() {
    return this._obterSyncBackground().obterStatus();
  }

  definirProximaExecucaoSync(data) {
    this._syncExecucao.definirProximaExecucao(data);
  }

  obterEstadoSyncExecucao() {
    return this._syncExecucao.obterEstado();
  }

  async listarNotificacoes(filtros = {}) {
    const [notificacoes, naoLidas] = await Promise.all([
      this._notificacoesService.listar(filtros),
      this._notificacoesService.contarNaoLidas()
    ]);
    return { notificacoes, naoLidas };
  }

  async marcarNotificacaoLida(id) {
    return this._notificacoesService.marcarLida(id);
  }

  async marcarTodasNotificacoesLidas() {
    return this._notificacoesService.marcarTodasLidas();
  }

  /**
   * Alteração manual de status — apenas administradores, com auditoria.
   *
   * @param {number|string} id
   * @param {string} novoStatus
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async alterarStatusManual(id, novoStatus, opcoes = {}) {
    const perfil = String(opcoes.perfilUsuario || '').toUpperCase();
    const role = opcoes.roleUsuario;
    const isAdmin = role === 'admin' || perfil === 'ADMIN' || perfil === 'SUPER_ADMIN';

    if (!isAdmin) {
      const erro = new Error('Apenas administradores podem alterar status manualmente.');
      erro.statusCode = 403;
      throw erro;
    }

    if (!isValido(novoStatus)) {
      const erro = new Error(`Status inválido: ${novoStatus}`);
      erro.statusCode = 400;
      throw erro;
    }

    const documento = await this._documentosRepository.buscarPorId(id);
    if (!documento) {
      const erro = new Error('Documento não encontrado');
      erro.statusCode = 404;
      throw erro;
    }

    await this._transitionService.transicionar(id, documento.status, novoStatus, {
      detalhe: opcoes.detalhe ?? `Alteração manual: ${documento.status} → ${novoStatus}`,
      usuarioId: opcoes.usuarioId ?? null,
      origem: 'manual_admin'
    });

    await gravarAuditoria({
      usuario_id: opcoes.usuarioId ?? null,
      usuario_nome: opcoes.usuarioNome ?? null,
      modulo: 'central-entradas',
      acao: 'alterar_status_manual',
      referencia_tipo: 'documento_fiscal',
      referencia_id: id,
      detalhes: {
        statusAnterior: documento.status,
        statusNovo: novoStatus,
        detalhe: opcoes.detalhe ?? null
      },
      ip_requisicao: opcoes.ipRequisicao ?? null
    });

    return this._documentoService.obterPorId(id);
  }

  obterDiagnostico(opcoes = {}) {
    return this._diagnosticoService.obterPainelCompleto(opcoes);
  }

  executarHealthCheckDiagnostico() {
    return this._diagnosticoService.executarHealthCheck();
  }

  testarCertificadoDiagnostico() {
    return this._diagnosticoService.testarCertificado();
  }

  testarSefazDiagnostico() {
    return this._diagnosticoService.testarConexaoSefaz();
  }

  limparCacheDiagnostico() {
    return this._diagnosticoService.limparCache();
  }
}

const instanciaPadrao = new CentralEntradasOrchestrator();

module.exports = instanciaPadrao;
module.exports.CentralEntradasOrchestrator = CentralEntradasOrchestrator;
module.exports.VERSAO_MODULO = VERSAO_MODULO;
