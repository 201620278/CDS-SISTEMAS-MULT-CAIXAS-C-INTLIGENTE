/**
 * Toledo Prix 4 Uno — transmissão de VALOR
 * 2 + 6 (PLU) + 5 (valor centavos) + DV
 *
 * Casos reais (cliente):
 * 2000067012631 → PLU 67, R$ 12,63
 * 2000052018945 → PLU 52, R$ 18,94
 */

const EtiquetaLayoutBase = require('./EtiquetaLayoutBase');
const { LAYOUT_IDS } = require('./layoutIds');
const { normalizarPlu } = require('../utils/normalizarPlu');

class ToledoPrix4Valor55Layout extends EtiquetaLayoutBase {
  get id() {
    return LAYOUT_IDS.TOLEDO_PRIX4_VALOR_65;
  }

  get nome() {
    return 'Toledo Prix 4 Valor (6+5)';
  }

  parse(codigo13) {
    const limpo = String(codigo13 || '').replace(/\D/g, '');
    if (!/^2\d{12}$/.test(limpo)) return null;

    const pluRaw = limpo.substring(1, 7);
    const valorTotal = Number(limpo.substring(7, 12)) / 100;

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

module.exports = ToledoPrix4Valor55Layout;
