/**
 * Normalização de PLU extraído de etiqueta (Sprint 08 — hardening).
 * @module motores/produto-identidade/utils/normalizarPlu
 */

/**
 * @param {string|number|null|undefined} pluRaw
 * @returns {string}
 */
function normalizarPlu(pluRaw) {
  const digits = String(pluRaw || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || '0';
}

module.exports = { normalizarPlu };
