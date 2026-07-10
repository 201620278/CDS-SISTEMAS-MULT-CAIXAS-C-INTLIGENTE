/**
 * CentralSincronizacaoService — Orquestração da sincronização DF-e na Central.
 *
 * RC4: obtém contexto via CentralConfiguracaoService (sem leitura fiscal direta).
 *
 * @class CentralSincronizacaoService
 */

const SincronizacaoResultadoDTO = require('../contracts/SincronizacaoResultadoDTO');
const CentralDocumentosRepository = require('../repositories/CentralDocumentosRepository');
const CentralConfiguracaoService = require('./CentralConfiguracaoService');
const {
  sincronizarDistribuicaoDFe,
  consultarNotaPorChave
} = require('../../../services/fiscal/distribuicaoDFe');
const { paraInboxDTO } = require('../utils/centralEntradasMapper');

class CentralSincronizacaoService {
  /**
   * @param {Object} [deps]
   */
  constructor(deps = {}) {
    /** @private */
    this._documentosRepository = deps.documentosRepository ?? new CentralDocumentosRepository();
    /** @private */
    this._configuracao = deps.configuracaoService ?? new CentralConfiguracaoService();
  }

  /**
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async sincronizar(opcoes = {}) {
    try {
      const ctxResult = await this._configuracao.obterContextoOperacional();
      if (!ctxResult.ok) {
        return SincronizacaoResultadoDTO.create({
          sucesso: false,
          notasNovas: 0,
          notasDuplicadas: 0,
          erros: [ctxResult.mensagem],
          mensagem: ctxResult.mensagem,
          mensagemAmigavel: ctxResult.mensagem,
          codigoErro: ctxResult.codigoErro
        }).toJSON();
      }

      const resultado = await sincronizarDistribuicaoDFe({
        maxIteracoes: opcoes.maxIteracoes ?? ctxResult.contexto.syncMaxDocumentos,
        contextoCentral: ctxResult.contexto
      });

      return SincronizacaoResultadoDTO.create({
        sucesso: true,
        notasNovas: resultado.notasNovas,
        notasDuplicadas: resultado.notasDuplicadas,
        ignorados: resultado.ignorados,
        ultNsu: resultado.ultNsu,
        maxNsu: resultado.maxNsu,
        iteracoes: resultado.iteracoes,
        cStat: resultado.cStat,
        mensagem: resultado.mensagem,
        ultimaSincronizacao: resultado.ultimaSincronizacao,
        erros: []
      }).toJSON();
    } catch (error) {
      const mensagem = error.message || String(error);
      const codigoErro = /certificado/i.test(mensagem)
        ? 'CERTIFICADO'
        : /cnpj/i.test(mensagem)
          ? 'CNPJ'
          : /timeout|ECONN/i.test(mensagem)
            ? 'SEFAZ'
            : 'SEFAZ';
      return SincronizacaoResultadoDTO.create({
        sucesso: false,
        notasNovas: 0,
        notasDuplicadas: 0,
        erros: [mensagem],
        mensagem,
        mensagemAmigavel: mensagem,
        codigoErro
      }).toJSON();
    }
  }

  /**
   * @param {string} chave
   * @returns {Promise<Object>}
   */
  async buscarPorChave(chave) {
    const ctxResult = await this._configuracao.obterContextoOperacional();
    if (!ctxResult.ok) {
      const erro = new Error(ctxResult.mensagem);
      erro.statusCode = 422;
      erro.codigoErro = ctxResult.codigoErro;
      throw erro;
    }

    const chaveLimpa = String(chave || '').replace(/\D/g, '');
    const resultado = await consultarNotaPorChave(chaveLimpa, {
      contextoCentral: ctxResult.contexto
    });
    const documento = await this._documentosRepository.buscarPorChave(chaveLimpa);

    return {
      ...resultado,
      novo: resultado.notasNovas > 0,
      documento: documento ? paraInboxDTO(documento).toJSON() : null
    };
  }
}

module.exports = CentralSincronizacaoService;
