/**
 * ConnectionMonitor — Monitoramento de conexões TCP (Sprint 10).
 *
 * Exibe estado, tempo, tentativas e reconexões via ConnectionManager.
 *
 * @class ConnectionMonitor
 */

const connectionManager = require('../transport/ConnectionManager');

class ConnectionMonitor {
  /**
   * @param {string|number} idOuChave
   * @returns {Object}
   */
  obterStatus(idOuChave) {
    const chave = String(idOuChave).includes(':')
      ? String(idOuChave)
      : `eq:${idOuChave}`;

    const base = connectionManager.obterStatus(idOuChave);
    const entrada = connectionManager.obter(idOuChave);

    return {
      ...base,
      chave: entrada?.chave || chave,
      conectado: base.conectado === true,
      desconectado: base.conectado !== true,
      tempo_conexao_ms: base.tempo_conexao_ms ?? 0,
      tentativas: entrada?.tentativasConexao ?? 0,
      reconexoes: entrada?.reconexoes ?? 0,
      ultimo_heartbeat: base.ultimo_heartbeat ?? null,
      ultimo_erro: base.ultimo_erro ?? null,
      comunicacao_real: true
    };
  }

  /**
   * @returns {Object[]}
   */
  listarAtivas() {
    return connectionManager.listarAtivas().map((status) => ({
      ...status,
      desconectado: status.conectado !== true,
      tentativas: this.obterStatus(status.chave || status.host).tentativas,
      reconexoes: this.obterStatus(status.chave || status.host).reconexoes
    }));
  }

  /**
   * @param {string|number} idOuChave
   * @returns {Promise<Object>}
   */
  async obterStatusTransporte(idOuChave) {
    const entrada = connectionManager.obter(idOuChave);
    if (!entrada) {
      return this.obterStatus(idOuChave);
    }

    const transportStatus = await entrada.transport.status();
    const monitor = this.obterStatus(idOuChave);

    return {
      ...monitor,
      transporte: transportStatus
    };
  }

  reiniciar() {
    connectionManager.reiniciar();
  }
}

const connectionMonitor = new ConnectionMonitor();

module.exports = connectionMonitor;
module.exports.ConnectionMonitor = ConnectionMonitor;
