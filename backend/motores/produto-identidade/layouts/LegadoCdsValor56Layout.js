/**
 * Legado CDS — 2 + 5 (código) + 6 (valor centavos) + DV
 * Compatível com frontend/pdv/js/pdv.js interpretarCodigoBalanca
 * Ex.: 2000010014890 → produto 00001, valor R$ 14,89
 */

const EtiquetaLayoutBase = require('./EtiquetaLayoutBase');
const { LAYOUT_IDS } = require('./layoutIds');
const { normalizarPlu } = require('../utils/normalizarPlu');

class LegadoCdsValor56Layout extends EtiquetaLayoutBase {
  get id() {
    return LAYOUT_IDS.LEGADO_CDS_VALOR_56;
  }

  get nome() {
    return 'Legado CDS Valor (5+6)';
  }

  parse(codigo13) {
    const limpo = String(codigo13 || '').replace(/\D/g, '');
    if (!/^2\d{12}$/.test(limpo)) return null;

    const pluRaw = limpo.substring(1, 6);
    const valorTotal = Number(limpo.substring(6, 12)) / 100;

    return {
      plu: normalizarPlu(pluRaw),
      pluRaw,
      valorTotal,
      peso: null,
      tipoPayload: 'VALOR',
      codigoOriginal: limpo,
      layoutId: this.id
    };
  }
}

module.exports = LegadoCdsValor56Layout;
