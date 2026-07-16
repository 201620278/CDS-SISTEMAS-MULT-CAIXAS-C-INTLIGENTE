/**
 * centralEntradasMapper — Mapeamento entre entidades e DTOs da Central de Entradas.
 *
 * @module motores/central-entradas/utils/centralEntradasMapper
 */

const DocumentoFiscalInboxDTO = require('../contracts/DocumentoFiscalInboxDTO');
const DocumentoFiscalDetalheDTO = require('../contracts/DocumentoFiscalDetalheDTO');
const CentralHistoricoEntryDTO = require('../contracts/CentralHistoricoEntryDTO');
const { obterLabel } = require('../core/DocumentoFiscalStatus');
const CentralScoreDocumentoService = require('../services/CentralScoreDocumentoService');

/** @type {CentralScoreDocumentoService} */
const scoreService = new CentralScoreDocumentoService();

function obterLabelDocumento(documento) {
  const tipo = documento?.tipoDocumento ?? documento?.tipo_documento;
  if (
    documento?.status === 'SINCRONIZADA'
    && ['PROC_NFE', 'NFE'].includes(tipo)
  ) {
    return 'XML Completo Recebido';
  }
  return obterLabel(documento?.status);
}

/**
 * @param {Object|null} documento
 * @returns {DocumentoFiscalInboxDTO}
 */
function paraInboxDTO(documento) {
  return DocumentoFiscalInboxDTO.create(documento || {});
}

/**
 * @param {Object[]} documentos
 * @returns {Object[]}
 */
function paraListaInboxDTO(documentos) {
  return (documentos || []).map((doc) => {
    const dto = paraInboxDTO(doc).toJSON();
    dto.statusLabel = obterLabelDocumento(doc);
    dto.parseDisponivel = Boolean(doc.parseJson);
    dto.miipDisponivel = Boolean(doc.miipResumoJson || doc.miipSessaoId);
    const score = scoreService.calcular(doc);
    dto.scoreGeral = score.scoreGeral;
    dto.scoreCor = score.cor;
    return dto;
  });
}

/**
 * @param {Object|null} documento
 * @returns {Object}
 */
function paraDocumentoDetalheDTO(documento) {
  if (!documento) return null;

  const {
    xml,
    parseJson,
    miipResumoJson,
    ...restante
  } = documento;

  return {
    ...restante,
    statusLabel: obterLabelDocumento(documento),
    xmlDisponivel: Boolean(xml),
    parseDisponivel: Boolean(parseJson),
    miipDisponivel: Boolean(miipResumoJson || documento.miipSessaoId),
    compraVinculada: Boolean(documento.compraId)
  };
}

/**
 * @param {Object|null} documento
 * @param {Object[]} [historico]
 * @returns {Object}
 */
function paraDetalheCompletoDTO(documento, historico = []) {
  return DocumentoFiscalDetalheDTO.create({
    documento: paraDocumentoDetalheDTO(documento),
    historico: (historico || []).map((entrada) => {
      const dto = paraHistoricoDTO(entrada).toJSON();
      dto.statusAnteriorLabel = dto.statusAnterior ? obterLabel(dto.statusAnterior) : null;
      dto.statusNovoLabel = obterLabel(dto.statusNovo);
      return dto;
    })
  }).toJSON();
}

/**
 * @param {Object|null} entrada
 * @returns {CentralHistoricoEntryDTO}
 */
function paraHistoricoDTO(entrada) {
  return CentralHistoricoEntryDTO.create(entrada || {});
}

module.exports = {
  paraInboxDTO,
  paraListaInboxDTO,
  paraDocumentoDetalheDTO,
  paraDetalheCompletoDTO,
  paraHistoricoDTO
};
