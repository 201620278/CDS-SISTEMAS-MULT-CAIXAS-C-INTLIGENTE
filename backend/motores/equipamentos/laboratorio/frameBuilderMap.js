/**
 * Mapeamento declarativo Driver → FrameBuilder.
 * Laboratório não importa drivers diretamente — apenas resolve por código.
 *
 * Novos drivers: adicionar entrada com caminho relativo ao módulo FrameBuilder.
 */

const path = require('path');

/** @type {Record<string, string>} */
const FRAME_BUILDER_MAP = {
  TOLEDO_PRIX4_UNO: '../drivers/toledo/prix4/ToledoPrix4FrameBuilder'
};

/**
 * @param {string} codigoDriver
 * @returns {Object|null}
 */
function resolverFrameBuilder(codigoDriver) {
  const rel = FRAME_BUILDER_MAP[String(codigoDriver || '').toUpperCase()];
  if (!rel) return null;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(__dirname, rel));
  } catch (_) {
    return null;
  }
}

/**
 * @returns {string[]}
 */
function listarDriversComFrameBuilder() {
  return Object.keys(FRAME_BUILDER_MAP);
}

module.exports = {
  FRAME_BUILDER_MAP,
  resolverFrameBuilder,
  listarDriversComFrameBuilder
};
