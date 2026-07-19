/**
 * ProdutoRepository — Única fonte oficial de leitura de produtos para o MIIP.
 *
 * Sprint 3.1: Engines consultam produtos exclusivamente por este repository.
 * MIP Sprint 03: `buscarPorGtin` consome o Motor de Identificação (quando flag ON),
 * com fallback legado em `produtos.codigo_barras`. Flag OFF = 100% legado.
 *
 * @class ProdutoRepository
 */

const ProdutoSnapshot = require('../core/ProdutoSnapshot');
const { resolverDb, criarDbHelpers } = require('./dbHelpers');
const produtoCache = require('../cache/ProdutoCache');

const COLUNAS_LEITURA = `
  id,
  codigo,
  codigo_barras,
  nome,
  unidade,
  ncm,
  cest,
  categoria_id,
  subcategoria_id,
  fornecedor,
  ativo
`;

class ProdutoRepository {
  /**
   * @param {Object} [deps]
   * @param {Object|null} [deps.db]
   * @param {Object} [deps.identidadeService] - ProdutoIdentidadeService (opcional / testes)
   * @param {Function} [deps.isMipEnabled] - override da feature flag
   */
  constructor(deps = {}) {
    this._db = deps.db ?? resolverDb(deps);
    this._helpers = this._db ? criarDbHelpers(this._db) : null;
    this._identidadeService = deps.identidadeService ?? null;
    this._isMipEnabled = deps.isMipEnabled ?? null;
  }

  /**
   * @private
   * @param {Object} row
   * @returns {ProdutoSnapshot|null}
   */
  _mapearSnapshot(row) {
    return ProdutoSnapshot.fromRow(row);
  }

  /**
   * @private
   * @returns {boolean}
   */
  _mipHabilitado() {
    if (typeof this._isMipEnabled === 'function') {
      return this._isMipEnabled() === true;
    }
    try {
      const { isProdutoIdentidadeEnabled } = require('../../produto-identidade/config/produtoIdentidadeFlags');
      return isProdutoIdentidadeEnabled() === true;
    } catch {
      return false;
    }
  }

  /**
   * @private
   * Resolve produtoId via MIP (GTIN/EAN13). Não lança — falha → null.
   * @param {string} gtin
   * @returns {Promise<number|null>}
   */
  async _resolverProdutoIdViaMip(gtin) {
    try {
      let service = this._identidadeService;
      if (!service) {
        const ProdutoIdentidadeService = require('../../produto-identidade/services/ProdutoIdentidadeService');
        service = new ProdutoIdentidadeService({
          db: this._db,
          isEnabled: () => true
        });
      }

      const resultado = await service.resolve({
        codigo: gtin,
        contexto: { origem: 'miip', tipoForcado: null }
      });

      if (resultado && resultado.encontrado && resultado.produtoId) {
        return Number(resultado.produtoId);
      }
    } catch (err) {
      console.warn('[MIIP←MIP] buscarPorGtin via MIP falhou, usando legado:', err.message);
    }
    return null;
  }

  /**
   * Busca produto por ID.
   * Usado pelo Motor Fornecedor (após miip_associacoes) e demais engines.
   *
   * @param {number} id
   * @returns {Promise<ProdutoSnapshot|null>}
   */
  async buscarPorId(id) {
    const produtoId = Number(id);
    if (!Number.isFinite(produtoId) || produtoId <= 0 || !this._helpers) return null;

    const emCache = produtoCache.buscarPorId(produtoId);
    if (emCache) return emCache;

    await this._helpers.whenReady();

    const row = await this._helpers.get(
      `SELECT ${COLUNAS_LEITURA} FROM produtos WHERE id = ? LIMIT 1`,
      [produtoId]
    );

    const snapshot = this._mapearSnapshot(row);
    if (snapshot) produtoCache.armazenar(snapshot);
    return snapshot;
  }

  /**
   * Busca produto por GTIN/EAN.
   *
   * Ordem (MIP Sprint 03):
   * 1. Cache
   * 2. Se flag ON → Motor de Identificação (identificadores + strategies)
   * 3. Fallback legado: `produtos.codigo_barras = ?`
   *
   * Flag OFF → apenas passo 3 (zero regressão).
   *
   * @param {string} gtin - GTIN já normalizado
   * @returns {Promise<ProdutoSnapshot|null>}
   */
  async buscarPorGtin(gtin) {
    if (!gtin || !this._helpers) return null;

    const emCache = produtoCache.buscarPorGtin(gtin);
    if (emCache) return emCache;

    await this._helpers.whenReady();

    if (this._mipHabilitado()) {
      const produtoId = await this._resolverProdutoIdViaMip(String(gtin));
      if (produtoId) {
        const viaMip = await this.buscarPorId(produtoId);
        if (viaMip) {
          // Garante chave GTIN no cache mesmo se codigo_barras do produto divergir
          produtoCache.armazenar(viaMip);
          return viaMip;
        }
      }
    }

    const row = await this._helpers.get(
      `SELECT ${COLUNAS_LEITURA} FROM produtos WHERE codigo_barras = ? LIMIT 1`,
      [gtin]
    );

    const snapshot = this._mapearSnapshot(row);
    if (snapshot) produtoCache.armazenar(snapshot);
    return snapshot;
  }
}

module.exports = new ProdutoRepository();
module.exports.ProdutoRepository = ProdutoRepository;
