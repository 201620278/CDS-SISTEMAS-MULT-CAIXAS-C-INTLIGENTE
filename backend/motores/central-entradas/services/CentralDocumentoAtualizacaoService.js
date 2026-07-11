/**
 * CentralDocumentoAtualizacaoService — Atualiza documento existente com XML completo (RC6.3).
 *
 * Responsabilidade única: aplicar XML completo + metadados + status SINCRONIZADA
 * sobre um registro AGUARDANDO_XML_COMPLETO. Não executa Parser, MIIP, Compras nem SOAP.
 *
 * @module motores/central-entradas/services/CentralDocumentoAtualizacaoService
 */

const { DocumentoFiscalStatus } = require('../core/DocumentoFiscalStatus');
const DocumentoTransitionService = require('./DocumentoTransitionService');
const CentralDocumentosRepository = require('../repositories/CentralDocumentosRepository');
const CentralHistoricoRepository = require('../repositories/CentralHistoricoRepository');
const { logCentral } = require('../utils/centralLog');

const DETALHE_XML_COMPLETO = 'XML completo recebido.';
const DETALHE_DOCUMENTO_ATUALIZADO = 'Documento atualizado.';

class CentralDocumentoAtualizacaoService {
  /**
   * @param {Object} [deps]
   */
  constructor(deps = {}) {
    /** @private */
    this._documentosRepository = deps.documentosRepository
      ?? new CentralDocumentosRepository({ db: deps.db ?? null });
    /** @private */
    this._historicoRepository = deps.historicoRepository
      ?? new CentralHistoricoRepository({ db: deps.db ?? null });
    /** @private */
    this._transitionService = deps.transitionService
      ?? new DocumentoTransitionService({
        documentosRepository: this._documentosRepository,
        historicoRepository: this._historicoRepository
      });
  }

  /**
   * Atualiza documento AGUARDANDO_XML_COMPLETO com XML completo (PROC_NFE/NFE).
   * Preserva id, histórico anterior, created_at e vínculos.
   *
   * @param {Object} params
   * @param {Object} params.documento Documento existente
   * @param {string} params.xml XML completo
   * @param {Object} params.metadados Metadados extraídos do XML
   * @param {string} params.tipoDfe DocumentoDfeTipo
   * @param {string} [params.nsu]
   * @param {string} [params.origem]
   * @returns {Promise<{ documento: Object, atualizado: boolean }>}
   */
  async atualizarComXmlCompleto(params = {}) {
    const documento = params.documento;
    if (!documento?.id) {
      const erro = new Error('Documento existente é obrigatório para atualização.');
      erro.statusCode = 400;
      throw erro;
    }

    if (documento.status !== DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO) {
      const erro = new Error(
        `Atualização com XML completo só é permitida em AGUARDANDO_XML_COMPLETO (atual: ${documento.status})`
      );
      erro.statusCode = 400;
      throw erro;
    }

    const xml = params.xml;
    if (!xml) {
      const erro = new Error('XML completo é obrigatório.');
      erro.statusCode = 400;
      throw erro;
    }

    const metadados = params.metadados || {};
    const tipoDfe = params.tipoDfe || null;

    // 1) Conteúdo + metadados (preserva id / created_at / compra_id)
    await this._documentosRepository.atualizar(documento.id, {
      xml,
      nsu: params.nsu != null ? params.nsu : documento.nsu,
      numero: metadados.numero ?? documento.numero,
      serie: metadados.serie ?? documento.serie,
      modelo: metadados.modelo ?? documento.modelo,
      fornecedor: metadados.fornecedor ?? documento.fornecedor,
      cnpjFornecedor: metadados.cnpjFornecedor ?? documento.cnpjFornecedor,
      dataEmissao: metadados.dataEmissao ?? documento.dataEmissao,
      dataEntrada: metadados.dataEntrada ?? documento.dataEntrada,
      valorTotal: metadados.valorTotal ?? documento.valorTotal,
      tipoDocumento: tipoDfe,
      // limpa processamento anterior (resumo não tinha parse)
      parseJson: null,
      miipSessaoId: null,
      miipResumoJson: null,
      processadoEm: null,
      statusDetalhe: DETALHE_XML_COMPLETO
    });

    // 2) Status → SINCRONIZADA (histórico: XML completo recebido.)
    await this._transitionService.transicionar(
      documento.id,
      DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO,
      DocumentoFiscalStatus.SINCRONIZADA,
      {
        detalhe: DETALHE_XML_COMPLETO,
        origem: params.origem || null
      }
    );

    // 3) Timeline: Documento atualizado.
    await this._historicoRepository.inserir({
      documentoId: documento.id,
      statusAnterior: DocumentoFiscalStatus.SINCRONIZADA,
      statusNovo: DocumentoFiscalStatus.SINCRONIZADA,
      detalhe: DETALHE_DOCUMENTO_ATUALIZADO
    });

    const atualizado = await this._documentosRepository.buscarPorId(documento.id);

    logCentral('DFE', {
      mensagem: 'Documento atualizado com XML completo',
      documentoId: documento.id,
      Tipo: tipoDfe,
      Status: DocumentoFiscalStatus.SINCRONIZADA
    });

    try {
      const { emitirDocumentoAtualizado } = require('../utils/centralEventosEmitter');
      await emitirDocumentoAtualizado(atualizado, {
        origem: params.origem || 'dfe',
        tipoDfe
      });
    } catch { /* ignore */ }

    return {
      documento: atualizado,
      atualizado: true
    };
  }
}

CentralDocumentoAtualizacaoService.DETALHE_XML_COMPLETO = DETALHE_XML_COMPLETO;
CentralDocumentoAtualizacaoService.DETALHE_DOCUMENTO_ATUALIZADO = DETALHE_DOCUMENTO_ATUALIZADO;

module.exports = CentralDocumentoAtualizacaoService;
