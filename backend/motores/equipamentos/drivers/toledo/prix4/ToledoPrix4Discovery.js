/**
 * ToledoPrix4Discovery — Descoberta de balanças Toledo Prix 4 Uno na rede.
 *
 * Estrutura preparada para varredura Ethernet TCP.
 * Sem implementação de descoberta nesta sprint.
 *
 * @class ToledoPrix4Discovery
 */

const { PORTAS_PADRAO, TIMEOUTS } = require('./ToledoPrix4Constants');

class ToledoPrix4Discovery {
  constructor() {
    this.ultimaVarredura = null;
  }

  /**
   * Prepara parâmetros para varredura Ethernet (sem executar).
   * @param {Object} [opcoes]
   * @returns {Object}
   */
  prepararVarreduraEthernet(opcoes = {}) {
    return {
      tipo: 'ethernet',
      portas: opcoes.portas || [PORTAS_PADRAO.ethernet, PORTAS_PADRAO.alternativa],
      timeout: opcoes.timeout || TIMEOUTS.discovery,
      implementado: false,
      mensagem: 'Varredura Ethernet preparada — execução em sprint futura'
    };
  }

  /**
   * Prepara parâmetros para broadcast na rede local (sem executar).
   * @param {Object} [opcoes]
   * @returns {Object}
   */
  prepararVarreduraRede(opcoes = {}) {
    return {
      tipo: 'rede',
      subnet: opcoes.subnet || null,
      portas: opcoes.portas || [PORTAS_PADRAO.ethernet],
      timeout: opcoes.timeout || TIMEOUTS.discovery,
      implementado: false,
      mensagem: 'Varredura de rede preparada — execução em sprint futura'
    };
  }

  /**
   * Descobre equipamentos Toledo na rede/COM.
   * @param {Object} [_opcoes]
   * @returns {Promise<Object[]>}
   */
  async descobrir(_opcoes = {}) {
    // TODO: Implementar discovery Ethernet TCP Toledo
    this.ultimaVarredura = {
      timestamp: new Date().toISOString(),
      candidatos: [],
      simulado: true
    };
    return [];
  }

  /**
   * @returns {Object|null}
   */
  obterUltimaVarredura() {
    return this.ultimaVarredura;
  }
}

module.exports = ToledoPrix4Discovery;
