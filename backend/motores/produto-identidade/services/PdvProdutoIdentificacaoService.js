/**
 * Identificação de produto para o PDV via MIP (Sprint 05).
 * Flag OFF → resposta desabilitada (PDV usa caminho legado local).
 * Flag ON → resolve exclusivo pelo Motor de Identificação.
 * @module motores/produto-identidade/services/PdvProdutoIdentificacaoService
 */

const ProdutoIdentidadeService = require('./ProdutoIdentidadeService');
const IdentidadeResultadoDTO = require('../contracts/IdentidadeResultadoDTO');
const {
  isProdutoIdentidadeEnabled,
  FLAG_CHAVE
} = require('../config/produtoIdentidadeFlags');

class PdvProdutoIdentificacaoService {
  /**
   * @param {Object} [deps]
   * @param {Object|null} [deps.db]
   * @param {ProdutoIdentidadeService} [deps.identidadeService]
   * @param {Function} [deps.isEnabled]
   */
  constructor(deps = {}) {
    this._db = deps.db ?? null;
    this._isEnabled = deps.isEnabled ?? isProdutoIdentidadeEnabled;
    this._identidade = deps.identidadeService
      ?? new ProdutoIdentidadeService({
        db: this._db,
        isEnabled: this._isEnabled
      });
  }

  /**
   * @param {string} codigo
   * @param {Object} [contexto]
   * @returns {Promise<Object>} payload JSON para o PDV
   */
  async identificar(codigo, contexto = {}) {
    const bruto = String(codigo ?? '').trim();
    const ctx = {
      origem: 'pdv',
      ...contexto
    };

    if (!this._isEnabled()) {
      const dto = IdentidadeResultadoDTO.desabilitado(bruto || null);
      return this._toPayload(dto, { modo: 'legado' });
    }

    if (!bruto) {
      return this._toPayload(
        IdentidadeResultadoDTO.naoEncontrado({ codigoOriginal: '' }),
        { modo: 'mip' }
      );
    }

    const resultado = await this._identidade.resolve(
      { codigo: bruto, contexto: ctx },
      ctx
    );

    return this._toPayload(resultado, { modo: 'mip' });
  }

  /**
   * @private
   */
  _toPayload(resultado, extras = {}) {
    const json = resultado && typeof resultado.toJSON === 'function'
      ? resultado.toJSON()
      : { ...(resultado || {}) };

    const ehBalanca = json.strategy === 'ETIQUETA_BALANCA'
      || (json.meta && (json.meta.tipoPayload === 'VALOR' || json.meta.tipoPayload === 'PESO'));

    return {
      ...json,
      flag: FLAG_CHAVE,
      modo: extras.modo || (json.habilitado === false ? 'legado' : 'mip'),
      etiquetaBalanca: ehBalanca === true
    };
  }
}

module.exports = PdvProdutoIdentificacaoService;
