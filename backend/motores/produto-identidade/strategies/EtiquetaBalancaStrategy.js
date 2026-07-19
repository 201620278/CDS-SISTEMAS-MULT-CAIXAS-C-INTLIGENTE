/**
 * EtiquetaBalancaStrategy — interpreta EAN-13 prefixo 2 via LayoutRegistry (Sprint 04).
 * Não altera o PDV; disponível no MIP para resolve() quando flag ON.
 */

const IdentidadeStrategyBase = require('./IdentidadeStrategyBase');
const IdentidadeResultadoDTO = require('../contracts/IdentidadeResultadoDTO');
const LayoutRegistry = require('../layouts/LayoutRegistry');
const { resolverLayoutId } = require('../config/etiquetaBalancaConfig');
const { TIPOS_IDENTIFICADOR } = require('../constants/tiposIdentificador');
const { normalizarCodigoIdentificador } = require('../normalizers/normalizarCodigoIdentificador');

function ehEtiquetaBalanca(codigo) {
  return /^2\d{12}$/.test(String(codigo || '').replace(/\D/g, ''));
}

class EtiquetaBalancaStrategy extends IdentidadeStrategyBase {
  /**
   * @param {Object} [deps]
   * @param {Object} [deps.catalogo]
   * @param {LayoutRegistry} [deps.layoutRegistry]
   * @param {Object} [deps.db]
   * @param {Function} [deps.resolverLayoutId]
   */
  constructor(deps = {}) {
    super();
    this._catalogo = deps.catalogo;
    this._layouts = deps.layoutRegistry || LayoutRegistry.criarPadrao();
    this._db = deps.db || null;
    this._resolverLayoutId = deps.resolverLayoutId || resolverLayoutId;
  }

  get nome() {
    return 'ETIQUETA_BALANCA';
  }

  get metodo() {
    return 'ETIQUETA_BALANCA';
  }

  canHandle(codigo, contexto, deteccao) {
    const digitos = deteccao?.digitos || String(codigo || '').replace(/\D/g, '');
    if (ehEtiquetaBalanca(digitos)) return true;
    const candidatos = deteccao?.candidatos || [];
    return candidatos.includes('ETIQUETA_BALANCA');
  }

  /**
   * @private
   */
  async _localizarPorPlu(plu) {
    if (!this._catalogo || !plu) return null;

    const pluNorm = normalizarCodigoIdentificador(plu, TIPOS_IDENTIFICADOR.PLU);

    const viaPlu = await this._catalogo.resolverPorIdentificador(
      TIPOS_IDENTIFICADOR.PLU,
      pluNorm
    );
    if (viaPlu?.produto) return viaPlu.produto;

    const viaInterno = await this._catalogo.resolverPorIdentificador(
      TIPOS_IDENTIFICADOR.INTERNO,
      pluNorm
    );
    if (viaInterno?.produto) return viaInterno.produto;

    const legado = await this._catalogo.buscarProdutoPorCodigoInterno(pluNorm);
    if (legado) return legado;

    // tenta com zeros à esquerda (5 dígitos) como alguns cadastros
    const padded = pluNorm.padStart(5, '0');
    if (padded !== pluNorm) {
      const legadoPad = await this._catalogo.buscarProdutoPorCodigoInterno(padded);
      if (legadoPad) return legadoPad;
    }

    return null;
  }

  async resolve(codigo, contexto = {}, deteccao = {}) {
    const limpo = (deteccao.digitos || String(codigo || '').replace(/\D/g, ''));
    if (!ehEtiquetaBalanca(limpo)) return null;

    const layoutId = await this._resolverLayoutId(contexto, { db: this._db });
    const layout = this._layouts.obterOuDefault(layoutId);
    if (!layout) return null;

    const parsed = layout.parse(limpo);
    if (!parsed) return null;

    const produto = await this._localizarPorPlu(parsed.plu);
    if (!produto) {
      return IdentidadeResultadoDTO.naoEncontrado({
        codigoOriginal: limpo,
        strategy: this.nome,
        metodo: this.metodo,
        meta: {
          plu: parsed.plu,
          pluRaw: parsed.pluRaw,
          valorTotal: parsed.valorTotal,
          peso: parsed.peso,
          tipoPayload: parsed.tipoPayload,
          layoutId: parsed.layoutId,
          produtoNaoEncontrado: true
        }
      });
    }

    // Se VALOR e tem preço, calcula peso sugerido (qtd = valor/preço)
    let pesoCalculado = parsed.peso;
    if (
      parsed.tipoPayload === 'VALOR'
      && parsed.valorTotal != null
      && Number(produto.preco_venda) > 0
    ) {
      pesoCalculado = Number(parsed.valorTotal) / Number(produto.preco_venda);
    }

    return IdentidadeResultadoDTO.encontrado({
      produtoId: produto.id,
      produto,
      metodo: this.metodo,
      strategy: this.nome,
      codigoOriginal: limpo,
      confianca: 'ALTA',
      meta: {
        plu: parsed.plu,
        pluRaw: parsed.pluRaw,
        valorTotal: parsed.valorTotal,
        peso: pesoCalculado,
        pesoEtiqueta: parsed.peso,
        tipoPayload: parsed.tipoPayload,
        layoutId: parsed.layoutId
      }
    });
  }
}

module.exports = EtiquetaBalancaStrategy;
module.exports.ehEtiquetaBalanca = ehEtiquetaBalanca;
