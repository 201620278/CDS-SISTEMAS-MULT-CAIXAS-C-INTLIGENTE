/**
 * Toledo Prix 4 — transmissão de PESO
 * 2 + 6 (PLU) + 5 (peso em gramas) + DV
 * Peso kg = gramas / 1000
 *
 * Ex.: 2000067012640 → PLU 67, peso 1,264 kg
 */

const EtiquetaLayoutBase = require('./EtiquetaLayoutBase');
const { LAYOUT_IDS } = require('./layoutIds');
const { normalizarPlu } = require('../utils/normalizarPlu');

class ToledoPrix4PesoLayout extends EtiquetaLayoutBase {
  get id() {
    return LAYOUT_IDS.TOLEDO_PRIX4_PESO;
  }

  get nome() {
    return 'Toledo Prix 4 Peso (6+5 g)';
  }

  parse(codigo13) {
    const limpo = String(codigo13 || '').replace(/\D/g, '');
    if (!/^2\d{12}$/.test(limpo)) return null;

    const pluRaw = limpo.substring(1, 7);
    const gramas = Number(limpo.substring(7, 12));
    const peso = gramas / 1000;

    return {
      plu: normalizarPlu(pluRaw),
      pluRaw,
      valorTotal: null,
      peso,
      tipoPayload: 'PESO',
      codigoOriginal: limpo,
      layoutId: this.id
    };
  }
}

module.exports = ToledoPrix4PesoLayout;
