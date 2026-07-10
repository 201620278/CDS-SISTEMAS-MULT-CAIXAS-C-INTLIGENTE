/**
 * CentralSyncExecucaoService — Execução de sincronização com mutex e telemetria.
 *
 * RC3: eventos via centralEventosEmitter (contrato único).
 *
 * @class CentralSyncExecucaoService
 */

const CentralSincronizacaoService = require('./CentralSincronizacaoService');
const CentralConfiguracaoService = require('./CentralConfiguracaoService');
const CentralNotificacoesService = require('./CentralNotificacoesService');
const { TIPOS_EVENTO, ORIGENS } = require('../config/centralEventosTipos');
const { emitirEvento } = require('../utils/centralEventosEmitter');
const { logCentral, logCentralErro } = require('../utils/centralLog');
const SincronizacaoResultadoDTO = require('../contracts/SincronizacaoResultadoDTO');

class CentralSyncExecucaoService {
  constructor(deps = {}) {
    /** @private */
    this._sincronizacao = deps.sincronizacaoService ?? new CentralSincronizacaoService();
    /** @private — provider oficial RC5 */
    this._config = deps.configuracaoService
      ?? deps.configService
      ?? new CentralConfiguracaoService();
    /** @private */
    this._notificacoes = deps.notificacoesService ?? new CentralNotificacoesService();
    /** @private */
    this._emitirEvento = deps.emitirEvento || emitirEvento;
    /** @private */
    this._executando = false;
    /** @private */
    this._ultimaExecucao = null;
    /** @private */
    this._proximaExecucao = null;
    /** @private */
    this._ultimoResultado = null;
  }

  estaExecutando() {
    return this._executando;
  }

  definirProximaExecucao(data) {
    this._proximaExecucao = data;
  }

  obterEstado() {
    return {
      executando: this._executando,
      ultimaExecucao: this._ultimaExecucao,
      proximaExecucao: this._proximaExecucao,
      ultimoResultado: this._ultimoResultado
    };
  }

  /**
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async executar(opcoes = {}) {
    const origem = opcoes.origem || ORIGENS.MANUAL;
    const ignorarHorario = Boolean(opcoes.ignorarHorario);
    const forcar = Boolean(opcoes.forcar);
    const usuarioId = opcoes.usuarioId ?? null;

    if (this._executando && !forcar) {
      return {
        sucesso: false,
        ignorado: true,
        mensagem: 'Sincronização já em andamento',
        erros: ['Sincronização já em andamento']
      };
    }

    if (!ignorarHorario && origem === ORIGENS.BACKGROUND) {
      const horario = await this._config.verificarHorarioPermitido();
      if (!horario.permitido) {
        return {
          sucesso: false,
          ignorado: true,
          mensagem: horario.motivo,
          erros: [horario.motivo]
        };
      }
    }

    this._executando = true;
    const inicio = Date.now();
    this._ultimaExecucao = new Date().toISOString();

    logCentral('SYNC', { fase: 'inicio', origem, usuarioId });

    await this._emitirEvento({
      tipo: TIPOS_EVENTO.SYNC_INICIADA,
      origem,
      descricao: 'Sincronização SEFAZ iniciada',
      resultado: 'em_andamento',
      sucesso: null,
      usuarioId
    });

    try {
      const cfg = await this._config.obterResumo();
      const maxIteracoes = Math.max(1, Math.min(200, opcoes.maxIteracoes ?? cfg.syncMaxDocumentos ?? 50));

      const resultado = await this._sincronizacao.sincronizar({ maxIteracoes });

      const duracaoMs = Date.now() - inicio;
      this._ultimoResultado = resultado;

      await this._emitirEvento({
        tipo: resultado.sucesso ? TIPOS_EVENTO.SYNC_CONCLUIDA : TIPOS_EVENTO.SYNC_ERRO,
        origem,
        descricao: resultado.mensagem || (resultado.sucesso ? 'Sincronização concluída' : 'Falha na sincronização'),
        resultado: resultado.sucesso ? 'sucesso' : 'erro',
        sucesso: resultado.sucesso,
        notasNovas: resultado.notasNovas || 0,
        notasDuplicadas: resultado.notasDuplicadas || 0,
        duracaoMs,
        usuarioId,
        detalhe: {
          notasNovas: resultado.notasNovas || 0,
          notasDuplicadas: resultado.notasDuplicadas || 0
        }
      });

      const cfgNotif = await this._config.obterResumo();
      await this._notificacoes.notificarSyncConcluida({
        notasNovas: resultado.notasNovas || 0,
        sucesso: resultado.sucesso,
        mensagem: resultado.mensagem,
        origem,
        notificarNovas: cfgNotif.notificarNovasNotas
      });

      logCentral('SYNC', {
        fase: 'fim',
        origem,
        sucesso: resultado.sucesso,
        notasNovas: resultado.notasNovas || 0,
        duracaoMs
      });

      return { ...resultado, duracaoMs, origem };
    } catch (error) {
      const duracaoMs = Date.now() - inicio;
      const falha = SincronizacaoResultadoDTO.create({
        sucesso: false,
        erros: [error.message]
      }).toJSON();

      this._ultimoResultado = falha;
      logCentralErro('SYNC', error, { origem, duracaoMs });

      await this._emitirEvento({
        tipo: TIPOS_EVENTO.SYNC_ERRO,
        origem,
        descricao: error.message,
        resultado: 'erro',
        sucesso: false,
        duracaoMs,
        usuarioId,
        detalhe: { erro: error.message }
      });

      await this._notificacoes.notificarSyncConcluida({
        sucesso: false,
        mensagem: error.message,
        origem,
        notasNovas: 0
      });

      return { ...falha, duracaoMs, origem };
    } finally {
      this._executando = false;
    }
  }
}

module.exports = new CentralSyncExecucaoService();
module.exports.CentralSyncExecucaoService = CentralSyncExecucaoService;
