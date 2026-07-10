/**
 * CentralSyncBackgroundService — Sincronização automática em background.
 *
 * RC1: delega ao CentralEntradasOrchestrator.
 *
 * @class CentralSyncBackgroundService
 */

const centralEntradasFlags = require('../config/centralEntradasFlags');
const CentralConfiguracaoService = require('./CentralConfiguracaoService');
const { ORIGENS } = require('../config/centralEventosTipos');
const { logCentral } = require('../utils/centralLog');

function obterOrchestrator() {
  return require('../CentralEntradasOrchestrator');
}

class CentralSyncBackgroundService {
  constructor(deps = {}) {
    /** @private — provider oficial RC5 */
    this._config = deps.configuracaoService
      ?? deps.configService
      ?? new CentralConfiguracaoService();
    /** @private */
    this._orchestrator = deps.orchestrator ?? null;
    /** @private */
    this._flags = deps.flags ?? centralEntradasFlags;
    /** @private */
    this._timeoutId = null;
    /** @private */
    this._ativo = false;
  }

  /** @private */
  _orch() {
    return this._orchestrator ?? obterOrchestrator();
  }

  estaAtivo() {
    return this._ativo;
  }

  async iniciar() {
    await this._config.hidratarFlags();
    this.parar();

    if (!this._flags.estaHabilitado() || !this._flags.syncAutomaticaHabilitada()) {
      this._ativo = false;
      return;
    }

    this._ativo = true;
    this._agendarCiclo(3000);
    logCentral('SYNC', { fase: 'background_iniciada' });
  }

  parar() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    this._ativo = false;
    this._orch().definirProximaExecucaoSync(null);
  }

  async reiniciar() {
    this.parar();
    await this.iniciar();
  }

  /** @private */
  _agendarCiclo(delayMs) {
    if (this._timeoutId) clearTimeout(this._timeoutId);

    this._timeoutId = setTimeout(async () => {
      if (!this._ativo) return;

      if (!this._flags.syncAutomaticaHabilitada()) {
        this.parar();
        return;
      }

      const intervalo = await this._config.obterIntervaloMs();
      this._orch().definirProximaExecucaoSync(new Date(Date.now() + intervalo).toISOString());

      await this._orch().executarSincronizacao({
        origem: ORIGENS.BACKGROUND,
        ignorarHorario: false
      });

      if (this._ativo) {
        this._agendarCiclo(intervalo);
      }
    }, delayMs);
  }

  obterStatus() {
    const estado = this._orch().obterEstadoSyncExecucao();
    return {
      servicoAtivo: this._ativo,
      syncAutomaticaHabilitada: this._flags.syncAutomaticaHabilitada(),
      executando: estado.executando,
      ultimaExecucao: estado.ultimaExecucao,
      proximaExecucao: estado.proximaExecucao,
      ultimoResultado: estado.ultimoResultado
        ? {
          sucesso: estado.ultimoResultado.sucesso,
          notasNovas: estado.ultimoResultado.notasNovas,
          duracaoMs: estado.ultimoResultado.duracaoMs,
          mensagem: estado.ultimoResultado.mensagem
        }
        : null
    };
  }
}

module.exports = new CentralSyncBackgroundService();
