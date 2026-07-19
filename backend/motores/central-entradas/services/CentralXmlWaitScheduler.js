/**
 * CentralXmlWaitScheduler — RC7.4 / RC7.4.2
 *
 * Scheduler inteligente de recuperação automática do XML completo
 * para documentos AGUARDANDO_XML_COMPLETO + RES_NFE.
 *
 * Bloqueios 656/593 e autorização DistDFe: CentralSefazOperationalGate.
 * Não altera DistDFe, Manifestação, Parser, MIIP ou schema.
 *
 * @module motores/central-entradas/services/CentralXmlWaitScheduler
 */

const { DocumentoFiscalStatus } = require('../core/DocumentoFiscalStatus');
const { DocumentoDfeTipo } = require('../core/DocumentoDfeTipo');
const CentralDocumentosRepository = require('../repositories/CentralDocumentosRepository');
const CentralConfigRepository = require('../repositories/CentralConfigRepository');
const { logCentral, logCentralErro } = require('../utils/centralLog');
const { criarCorrelationId } = require('../utils/centralOperacaoLog');
const {
  CentralSefazOperationalGate,
  INTERVALO_BLOQUEIO_656_MS,
  COOLDOWN_656_MINUTOS,
  calcularCooldown656Ms
} = require('./CentralSefazOperationalGate');

const CHAVE_ESTADO = 'xml_wait_scheduler_state';
const BACKOFF_MINUTOS = Object.freeze([5, 10, 20, 30, 60, 120]);
const TICK_MS = 60 * 1000;
const LIMITE_SCAN = 50;
const ALERTA_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function minutosParaMs(min) {
  return Number(min) * 60 * 1000;
}

function calcularBackoffMs(tentativa) {
  const idx = Math.max(0, Math.min(BACKOFF_MINUTOS.length - 1, Number(tentativa) || 0));
  return minutosParaMs(BACKOFF_MINUTOS[idx]);
}

class CentralXmlWaitScheduler {
  constructor(deps = {}) {
    this._documentosRepository = deps.documentosRepository
      || new CentralDocumentosRepository();
    this._configRepository = deps.configRepository || new CentralConfigRepository();
    this._obterOrchestrator = deps.obterOrchestrator
      || (() => require('../CentralEntradasOrchestrator'));
    this._agora = deps.agora || (() => new Date());
    this._tickMs = deps.tickMs != null ? deps.tickMs : TICK_MS;

    /** @private @type {Map<number, Object>} */
    this._docs = new Map();
    /** @private */
    this._locks = new Set();
    /** @private */
    this._timeoutId = null;
    /** @private */
    this._ativo = false;
    /** @private */
    this._tickEmExecucao = false;
    /** @private */
    this._persistindo = false;
    /** @private */
    this._metricas = {
      documentosRecuperados: 0,
      documentosTimeout: 0,
      tentativasTotais: 0,
      temposRecuperacaoMs: [],
      iniciados: 0,
      canceladosUpload: 0,
      canceladosOutros: 0
    };
    /** @private — Gate operacional SEFAZ (RC7.4.2) */
    this._gate = deps.gate || new CentralSefazOperationalGate({
      configRepository: this._configRepository,
      agora: this._agora,
      autoPersist: false,
      onStateChange: () => {
        this._persistirEstado().catch(() => {});
      },
      obterFingerprintConfig: deps.obterFingerprintConfig
    });
  }

  /** @returns {import('./CentralSefazOperationalGate').CentralSefazOperationalGate} */
  obterGate() {
    return this._gate;
  }

  estaAtivo() {
    return this._ativo;
  }

  static get BACKOFF_MINUTOS() {
    return BACKOFF_MINUTOS;
  }

  static get INTERVALO_BLOQUEIO_656_MS() {
    return INTERVALO_BLOQUEIO_656_MS;
  }

  /**
   * Gate DistDFe — delega ao CentralSefazOperationalGate (RC7.4.2).
   */
  obterBloqueio656() {
    return this._gate.obterBloqueio656();
  }

  estaBloqueadoDistDfe() {
    return this._gate.estaBloqueado656() || this._gate.estaSuspenso593();
  }

  registrarBloqueio656(dados = {}) {
    const bloq = this._gate.registrarBloqueio656(dados);
    if (bloq?.bloqueadoAte) {
      for (const estado of this._docs.values()) {
        const atual = new Date(estado.proximaEm).getTime();
        const ate = new Date(bloq.bloqueadoAte).getTime();
        if (Number.isNaN(atual) || atual < ate) {
          estado.proximaEm = bloq.bloqueadoAte;
        }
      }
    }
    this._persistirEstado().catch(() => {});
    return bloq;
  }

  limparBloqueio656(motivo = 'limpeza') {
    const ok = this._gate.limparBloqueio656(motivo);
    if (ok) this._persistirEstado().catch(() => {});
    return ok;
  }

  limparErro593(motivo = 'limpeza') {
    const ok = this._gate.limparErro593(motivo);
    if (ok) this._persistirEstado().catch(() => {});
    return ok;
  }

  registrarConsultaEvitada656(ctx = {}) {
    return this._gate.registrarConsultaEvitada656(ctx);
  }

  /** @private */
  _log(evento, fields = {}) {
    logCentral('XML_WAIT', {
      Evento: evento,
      CorrelationId: fields.correlationId || null,
      DocumentoId: fields.documentoId != null ? fields.documentoId : null,
      NSU: fields.nsu || null,
      Chave: fields.chave || null,
      Tempo: fields.tempoMs != null ? fields.tempoMs : null,
      Tentativa: fields.tentativa != null ? fields.tentativa : null,
      'Próxima execução': fields.proximaExecucao || null,
      Motivo: fields.motivo || null,
      Resultado: fields.resultado || null
    });
  }

  async iniciar() {
    if (this._ativo) return;
    await this._carregarEstado();
    await this.recuperarPendentes({ motivo: 'boot' });
    this._ativo = true;
    this._agendarTick(1500, 'start');
    this._log('XML_WAIT_START', {
      correlationId: criarCorrelationId(),
      motivo: 'scheduler_iniciado',
      tentativa: this._docs.size
    });
  }

  parar(opcoes = {}) {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    const estava = this._ativo;
    this._ativo = false;
    this._tickEmExecucao = false;
    if (estava) {
      this._log('XML_WAIT_STOP', {
        correlationId: opcoes.correlationId || criarCorrelationId(),
        motivo: opcoes.motivo || 'parada_explicita'
      });
    }
  }

  async reiniciar() {
    this.parar({ motivo: 'reiniciar' });
    await this.iniciar();
  }

  async recuperarPendentes(opcoes = {}) {
    const lista = await this._documentosRepository.listarPorStatus(
      DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO,
      LIMITE_SCAN
    );
    const candidatos = (lista || []).filter(
      (d) => d.tipoDocumento === DocumentoDfeTipo.RES_NFE
    );

    for (const doc of candidatos) {
      this._assegurarInscricao(doc, {
        correlationId: criarCorrelationId(),
        motivo: opcoes.motivo || 'recuperacao'
      });
    }

    await this._persistirEstado();
    return { inscritos: candidatos.length };
  }

  cancelar(documentoId, motivo = 'stop', extra = {}) {
    const id = Number(documentoId);
    if (!id) return false;
    const estado = this._docs.get(id);
    if (!estado) {
      this._locks.delete(id);
      if (motivo === 'upload') {
        this._gate.limparBloqueiosPorUpload();
      }
      return false;
    }

    const evento = motivo === 'upload'
      ? 'XML_WAIT_UPLOAD'
      : (motivo === 'success' || motivo === 'proc'
        ? 'XML_WAIT_SUCCESS'
        : 'XML_WAIT_STOP');

    this._log(evento, {
      correlationId: estado.correlationId || criarCorrelationId(),
      documentoId: id,
      chave: estado.chave,
      nsu: estado.nsu,
      tentativa: estado.tentativas,
      proximaExecucao: null,
      motivo,
      ...extra
    });

    if (motivo === 'upload') {
      this._metricas.canceladosUpload += 1;
      this._gate.limparBloqueiosPorUpload();
    } else if (motivo !== 'success' && motivo !== 'proc') {
      this._metricas.canceladosOutros += 1;
    }

    this._docs.delete(id);
    this._locks.delete(id);
    this._persistirEstado().catch(() => {});
    return true;
  }

  cancelarPorChave(chave, motivo = 'upload') {
    const alvo = String(chave || '').replace(/\D/g, '');
    if (!alvo) return false;
    for (const [id, estado] of this._docs.entries()) {
      if (String(estado.chave || '').replace(/\D/g, '') === alvo) {
        return this.cancelar(id, motivo, { chave: estado.chave });
      }
    }
    return false;
  }

  obterEstadoDocumento(documentoId) {
    const estado = this._docs.get(Number(documentoId));
    const bloqueio = this.obterBloqueio656();
    const e593 = this._gate.obterEstado593();
    if (!estado && !bloqueio.ativo && !e593.ativo) return null;
    const agora = this._agora().getTime();
    const base = estado
      ? {
        aguardandoXml: true,
        tentativas: estado.tentativas,
        proximaTentativa: estado.proximaEm,
        ultimaConsulta: estado.ultimaConsultaEm,
        iniciadoEm: estado.iniciadoEm,
        tempoAguardandoMs: Math.max(0, agora - new Date(estado.iniciadoEm).getTime()),
        tempoAguardandoLabel: this._formatarDuracao(agora - new Date(estado.iniciadoEm).getTime()),
        correlationId: estado.correlationId,
        nsu: estado.nsu || null
      }
      : {
        aguardandoXml: true,
        tentativas: 0,
        proximaTentativa: bloqueio.bloqueadoAte || null,
        ultimaConsulta: bloqueio.ultimaConsulta || e593.ultimaConsulta || null,
        iniciadoEm: null,
        tempoAguardandoMs: 0,
        tempoAguardandoLabel: '—',
        correlationId: bloqueio.correlationId || e593.correlationId || null,
        nsu: bloqueio.nsu || e593.nsu || null
      };

    const consultaBloqueada = bloqueio.ativo || e593.ativo;
    return {
      ...base,
      bloqueio656: bloqueio.ativo ? bloqueio : null,
      estado593: e593.ativo ? e593 : null,
      consultaBloqueada,
      configuracaoInvalida: e593.ativo,
      proximaTentativa: bloqueio.ativo
        ? bloqueio.bloqueadoAte
        : base.proximaTentativa,
      estadoOperacional: this._gate.obterEstadoOperacional({
        documentosAguardando: this._docs.size
      })
    };
  }

  obterTelemetria() {
    const tempos = this._metricas.temposRecuperacaoMs;
    const mediaRec = tempos.length
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
      : null;
    const recuperados = this._metricas.documentosRecuperados;
    const timeouts = this._metricas.documentosTimeout;
    const base = recuperados + timeouts;
    this._gate.definirDocumentosAguardando(this._docs.size);
    const gateTel = this._gate.obterTelemetria({
      documentosAguardando: this._docs.size,
      proximaConsultaPrevista: [...this._docs.values()]
        .sort((a, b) => new Date(a.proximaEm) - new Date(b.proximaEm))[0]?.proximaEm || null,
      quantidadeTentativas: this._metricas.tentativasTotais
    });
    return {
      documentosAguardando: this._docs.size,
      documentosRecuperados: recuperados,
      tempoMedioRecuperacaoMs: mediaRec,
      numeroTentativas: this._metricas.tentativasTotais,
      taxaSucesso: base > 0 ? Number((recuperados / base).toFixed(4)) : null,
      taxaTimeout: base > 0 ? Number((timeouts / base).toFixed(4)) : null,
      canceladosUpload: this._metricas.canceladosUpload,
      schedulerAtivo: this._ativo,
      backoffMinutos: [...BACKOFF_MINUTOS],
      ...gateTel,
      painelOperacional: this._gate.obterPainelOperacional({
        documentosAguardando: this._docs.size,
        proximaConsultaPrevista: gateTel.proximaConsultaPrevista,
        quantidadeTentativas: this._metricas.tentativasTotais
      })
    };
  }

  obterStatus() {
    return {
      ativo: this._ativo,
      tickEmExecucao: this._tickEmExecucao,
      documentos: this._docs.size,
      telemetria: this.obterTelemetria()
    };
  }

  /** @private */
  _formatarDuracao(ms) {
    const seg = Math.max(0, Math.floor(Number(ms) / 1000));
    if (seg < 60) return `${seg}s`;
    if (seg < 3600) return `${Math.floor(seg / 60)} min`;
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    return `${h}h ${m}min`;
  }

  /** @private */
  _assegurarInscricao(doc, meta = {}) {
    const id = Number(doc.id);
    if (!id || this._docs.has(id)) return this._docs.get(id);

    const agora = this._agora();
    const proxima = new Date(agora.getTime() + calcularBackoffMs(0)).toISOString();
    const estado = {
      documentoId: id,
      chave: doc.chave || null,
      nsu: doc.nsu || null,
      tentativas: 0,
      iniciadoEm: agora.toISOString(),
      ultimaConsultaEm: null,
      proximaEm: proxima,
      correlationId: meta.correlationId || criarCorrelationId(),
      timeoutAlertado: false
    };
    this._docs.set(id, estado);
    this._metricas.iniciados += 1;
    this._log('XML_WAIT_START', {
      correlationId: estado.correlationId,
      documentoId: id,
      chave: estado.chave,
      nsu: estado.nsu,
      tentativa: 0,
      proximaExecucao: proxima,
      motivo: meta.motivo || 'inscricao'
    });
    return estado;
  }

  /** @private */
  _agendarTick(delayMs) {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    this._timeoutId = setTimeout(() => {
      this._executarTick().catch((error) => {
        logCentralErro('XML_WAIT', error, { Evento: 'XML_WAIT_STOP', Motivo: 'tick_falhou' });
      });
    }, Math.max(0, delayMs));
  }

  /** @private */
  async _executarTick() {
    if (!this._ativo) return;
    if (this._tickEmExecucao) {
      this._agendarTick(this._tickMs);
      return;
    }

    this._tickEmExecucao = true;
    const correlationId = criarCorrelationId();
    try {
      await this.recuperarPendentes({ motivo: 'scan_tick' });

      const agora = this._agora().getTime();
      const devidos = [...this._docs.values()]
        .filter((e) => !this._locks.has(e.documentoId))
        .filter((e) => {
          const t = new Date(e.proximaEm).getTime();
          return !Number.isNaN(t) && t <= agora;
        })
        .sort((a, b) => new Date(a.proximaEm) - new Date(b.proximaEm));

      if (devidos.length) {
        await this._processarDocumento(devidos[0], correlationId);
      }
    } finally {
      this._tickEmExecucao = false;
      if (this._ativo) {
        this._agendarTick(this._tickMs);
      }
    }
  }

  /** @private */
  async _processarDocumento(estado, correlationIdPai) {
    const id = estado.documentoId;
    if (this._locks.has(id)) return;
    this._locks.add(id);

    const correlationId = estado.correlationId || correlationIdPai || criarCorrelationId();
    const inicio = Date.now();

    try {
      const doc = await this._documentosRepository.buscarPorId(id);
      if (!doc) {
        this.cancelar(id, 'documento_inexistente');
        return;
      }

      if (doc.status === DocumentoFiscalStatus.DESCARTADA) {
        this.cancelar(id, 'cancelado');
        return;
      }

      if (
        doc.status !== DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO
        || doc.tipoDocumento !== DocumentoDfeTipo.RES_NFE
      ) {
        if (doc.status !== DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO) {
          this._registrarSucesso(estado, doc, Date.now() - new Date(estado.iniciadoEm).getTime());
        } else {
          this.cancelar(id, 'status_incompativel');
        }
        return;
      }

      estado.chave = doc.chave || estado.chave;
      estado.nsu = doc.nsu || estado.nsu;

      if (this.estaBloqueadoDistDfe()) {
        const auth = await this._gate.autorizarConsultaDistDfe({
          correlationId,
          documentoId: id,
          chave: estado.chave,
          nsu: estado.nsu,
          motivo: this._gate.estaSuspenso593()
            ? 'CONFIGURACAO_INVALIDA'
            : 'Aguardando liberação da SEFAZ'
        });
        if (!auth.permitido) {
          if (auth.codigo === 'ERRO_CONFIGURACAO_CERTIFICADO') {
            this._log('XML_WAIT_SKIPPED', {
              correlationId,
              documentoId: id,
              chave: estado.chave,
              nsu: estado.nsu,
              motivo: 'CONFIGURACAO_INVALIDA',
              resultado: 'SKIPPED_593'
            });
          }
          estado.proximaEm = auth.proximaConsultaEm || estado.proximaEm;
          await this._persistirEstado();
          return;
        }
      }

      const tempoEspera = Date.now() - new Date(estado.iniciadoEm).getTime();
      if (!estado.timeoutAlertado && tempoEspera >= ALERTA_TIMEOUT_MS) {
        estado.timeoutAlertado = true;
        this._metricas.documentosTimeout += 1;
        this._log('XML_WAIT_TIMEOUT', {
          correlationId,
          documentoId: id,
          chave: estado.chave,
          nsu: estado.nsu,
          tentativa: estado.tentativas,
          tempoMs: tempoEspera,
          proximaExecucao: estado.proximaEm,
          motivo: 'aguardando_mais_de_24h'
        });
      }

      this._log('XML_WAIT_RETRY', {
        correlationId,
        documentoId: id,
        chave: estado.chave,
        nsu: estado.nsu,
        tentativa: estado.tentativas + 1,
        motivo: 'consulta_dist_dfe'
      });

      const orch = this._obterOrchestrator();
      const resultado = await orch.processarCicloDfeDocumento(id, {
        confirmado: true,
        apenasManifestacao: false,
        forcarConsulta: true,
        correlationId,
        // Gate já autorizado neste tick; orchestrator revalida via Gate singleton em produção.
        // Em testes o mock não passa pelo Gate — processamos resposta abaixo.
        ignorarBloqueio656: false
      });

      if (
        resultado?.codigo === 'BLOQUEADO_CONSUMO_INDEVIDO_656'
        || resultado?.codigo === 'ERRO_CONFIGURACAO_CERTIFICADO'
      ) {
        estado.proximaEm = resultado.proximaConsultaEm || estado.proximaEm;
        await this._persistirEstado();
        return;
      }

      estado.tentativas += 1;
      this._metricas.tentativasTotais += 1;
      estado.ultimaConsultaEm = this._agora().toISOString();

      const decisao = resultado?.gateProcessado === true
        ? {
          acao: String(resultado?.cStat) === '656'
            ? 'bloquear'
            : (String(resultado?.cStat) === '593' ? 'suspender' : 'continuar'),
          cStat: resultado?.cStat
        }
        : await this._gate.processarRespostaSefaz(resultado, {
          correlationId,
          documentoId: id,
          chave: estado.chave,
          nsu: estado.nsu
        });

      if (decisao.acao === 'bloquear') {
        if (resultado?.gateProcessado === true && !this._gate.estaBloqueado656()) {
          this.registrarBloqueio656({
            correlationId,
            documentoId: id,
            chave: estado.chave,
            nsu: estado.nsu
          });
        } else if (resultado?.gateProcessado !== true) {
          // já registrado em processarRespostaSefaz
        } else {
          const bloq = this.obterBloqueio656();
          if (bloq?.bloqueadoAte) {
            for (const e of this._docs.values()) {
              const atual = new Date(e.proximaEm).getTime();
              const ate = new Date(bloq.bloqueadoAte).getTime();
              if (Number.isNaN(atual) || atual < ate) e.proximaEm = bloq.bloqueadoAte;
            }
          }
        }
        const bloq = this.obterBloqueio656();
        estado.proximaEm = bloq.bloqueadoAte || estado.proximaEm;
        await this._persistirEstado();
        return;
      }

      if (decisao.acao === 'suspender') {
        this._log('XML_WAIT_CONFIGURATION_ERROR', {
          correlationId,
          documentoId: id,
          chave: estado.chave,
          nsu: estado.nsu,
          motivo: 'CONFIGURACAO_INVALIDA',
          resultado: '593'
        });
        await this._persistirEstado();
        return;
      }

      const atualizado = await this._documentosRepository.buscarPorId(id);
      const xmlCompleto = resultado?.xmlCompleto === true
        || (
          atualizado
          && atualizado.status !== DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO
          && [DocumentoDfeTipo.PROC_NFE, DocumentoDfeTipo.NFE].includes(atualizado.tipoDocumento)
        );

      if (xmlCompleto) {
        this._log('XML_WAIT_PROC', {
          correlationId,
          documentoId: id,
          chave: estado.chave,
          nsu: atualizado?.nsu || estado.nsu,
          tentativa: estado.tentativas,
          tempoMs: Date.now() - inicio,
          motivo: 'proc_recebido'
        });
        this._registrarSucesso(
          estado,
          atualizado || doc,
          Date.now() - new Date(estado.iniciadoEm).getTime()
        );
        return;
      }

      const backoffMs = calcularBackoffMs(estado.tentativas);
      estado.proximaEm = new Date(this._agora().getTime() + backoffMs).toISOString();
      this._log('XML_WAIT_RETRY', {
        correlationId,
        documentoId: id,
        chave: estado.chave,
        nsu: estado.nsu,
        tentativa: estado.tentativas,
        tempoMs: Date.now() - inicio,
        proximaExecucao: estado.proximaEm,
        motivo: String(resultado?.cStat) === '137'
          ? 'cstat_137_sem_documentos'
          : (resultado?.mensagem || 'ainda_aguardando_proc'),
        resultado: resultado?.cStat || resultado?.mensagem || 'AGUARDANDO'
      });
      await this._persistirEstado();
    } catch (error) {
      estado.tentativas += 1;
      this._metricas.tentativasTotais += 1;
      estado.ultimaConsultaEm = this._agora().toISOString();
      const backoffMs = calcularBackoffMs(estado.tentativas);
      estado.proximaEm = new Date(this._agora().getTime() + backoffMs).toISOString();
      logCentralErro('XML_WAIT', error, {
        Evento: 'XML_WAIT_RETRY',
        CorrelationId: correlationId,
        DocumentoId: id,
        Chave: estado.chave,
        Tentativa: estado.tentativas,
        Motivo: 'erro_soap_ou_ciclo',
        'Próxima execução': estado.proximaEm
      });
      await this._persistirEstado();
    } finally {
      this._locks.delete(id);
    }
  }

  /** @private */
  _registrarSucesso(estado, doc, tempoTotalMs) {
    this._metricas.documentosRecuperados += 1;
    this._metricas.temposRecuperacaoMs.push(tempoTotalMs);
    if (this._metricas.temposRecuperacaoMs.length > 200) {
      this._metricas.temposRecuperacaoMs.shift();
    }
    this._log('XML_WAIT_SUCCESS', {
      correlationId: estado.correlationId,
      documentoId: estado.documentoId,
      chave: doc?.chave || estado.chave,
      nsu: doc?.nsu || estado.nsu,
      tentativa: estado.tentativas,
      tempoMs: tempoTotalMs,
      motivo: 'xml_completo_recuperado'
    });
    this._docs.delete(estado.documentoId);
    this._locks.delete(estado.documentoId);
    this._persistirEstado().catch(() => {});
  }

  /** @private */
  async _carregarEstado() {
    try {
      const row = await this._configRepository.buscarPorChave(CHAVE_ESTADO);
      if (!row) return;
      const parsed = this._configRepository.parseValor({ ...row, tipo: 'json' });
      if (!parsed || typeof parsed !== 'object') return;

      if (parsed.metricas) {
        this._metricas = {
          documentosRecuperados: parsed.metricas.documentosRecuperados || 0,
          documentosTimeout: parsed.metricas.documentosTimeout || 0,
          tentativasTotais: parsed.metricas.tentativasTotais || 0,
          temposRecuperacaoMs: Array.isArray(parsed.metricas.temposRecuperacaoMs)
            ? parsed.metricas.temposRecuperacaoMs
            : [],
          iniciados: parsed.metricas.iniciados || 0,
          canceladosUpload: parsed.metricas.canceladosUpload || 0,
          canceladosOutros: parsed.metricas.canceladosOutros || 0
        };
      }

      // RC7.4.2 — Gate recupera bloqueio656 + estado593 + telemetria.
      // Compat: métricas antigas de 656 migradas para gateMetricas.
      const legadoGate = {};
      if (!parsed.gateMetricas && parsed.metricas) {
        legadoGate.gateMetricas = {
          bloqueios656: parsed.metricas.bloqueios656 || 0,
          consultasEvitadas: parsed.metricas.consultasEvitadas656 || 0,
          temposBloqueioMs: Array.isArray(parsed.metricas.temposBloqueioMs)
            ? parsed.metricas.temposBloqueioMs
            : [],
          ultimoDesbloqueio: parsed.metricas.ultimoDesbloqueioEm || null
        };
      }
      this._gate.hidratar({ ...parsed, ...legadoGate });

      const docs = parsed.documentos || {};
      this._docs.clear();
      Object.values(docs).forEach((item) => {
        if (!item?.documentoId) return;
        this._docs.set(Number(item.documentoId), {
          documentoId: Number(item.documentoId),
          chave: item.chave || null,
          nsu: item.nsu || null,
          tentativas: Number(item.tentativas) || 0,
          iniciadoEm: item.iniciadoEm || this._agora().toISOString(),
          ultimaConsultaEm: item.ultimaConsultaEm || null,
          proximaEm: item.proximaEm || this._agora().toISOString(),
          correlationId: item.correlationId || criarCorrelationId(),
          timeoutAlertado: Boolean(item.timeoutAlertado)
        });
      });
      this._gate.definirDocumentosAguardando(this._docs.size);
    } catch (error) {
      logCentralErro('XML_WAIT', error, { Motivo: 'falha_carregar_estado' });
    }
  }

  /** @private */
  async _persistirEstado() {
    if (this._persistindo) return;
    this._persistindo = true;
    try {
      const documentos = {};
      for (const [id, estado] of this._docs.entries()) {
        documentos[id] = { ...estado };
      }
      this._gate.definirDocumentosAguardando(this._docs.size);
      const gateState = this._gate.serializar();
      await this._configRepository.salvar(CHAVE_ESTADO, {
        atualizadoEm: this._agora().toISOString(),
        documentos,
        ...gateState,
        metricas: {
          documentosRecuperados: this._metricas.documentosRecuperados,
          documentosTimeout: this._metricas.documentosTimeout,
          tentativasTotais: this._metricas.tentativasTotais,
          temposRecuperacaoMs: this._metricas.temposRecuperacaoMs.slice(-50),
          iniciados: this._metricas.iniciados,
          canceladosUpload: this._metricas.canceladosUpload,
          canceladosOutros: this._metricas.canceladosOutros,
          // aliases legados RC7.4.1
          bloqueios656: gateState.gateMetricas?.bloqueios656 || 0,
          consultasEvitadas656: gateState.gateMetricas?.consultasEvitadas || 0,
          temposBloqueioMs: gateState.gateMetricas?.temposBloqueioMs || [],
          ultimoDesbloqueioEm: gateState.gateMetricas?.ultimoDesbloqueio || null
        }
      }, 'json');
    } catch (error) {
      logCentralErro('XML_WAIT', error, { Motivo: 'falha_persistir_estado' });
    } finally {
      this._persistindo = false;
    }
  }
}

const instancia = new CentralXmlWaitScheduler({
  gate: require('./CentralSefazOperationalGate')
});
try {
  require('./CentralSefazOperationalGate').vincularPersistencia(() => {
    instancia._persistirEstado().catch(() => {});
  });
} catch { /* ignore */ }
module.exports = instancia;
module.exports.CentralXmlWaitScheduler = CentralXmlWaitScheduler;
module.exports.BACKOFF_MINUTOS = BACKOFF_MINUTOS;
module.exports.INTERVALO_BLOQUEIO_656_MS = INTERVALO_BLOQUEIO_656_MS;
module.exports.COOLDOWN_656_MINUTOS = COOLDOWN_656_MINUTOS;
module.exports.calcularCooldown656Ms = calcularCooldown656Ms;
module.exports.CHAVE_ESTADO = CHAVE_ESTADO;
module.exports.calcularBackoffMs = calcularBackoffMs;
