/**
 * CentralComprasBridgeService — Ponte entre Central de Entradas e Compras.
 *
 * RC1: transições via DocumentoTransitionService; reutiliza parse/MIIP persistido.
 *
 * @class CentralComprasBridgeService
 */

const { DocumentoFiscalStatus } = require('../core/DocumentoFiscalStatus');
const { validarTransicao } = require('../core/MaquinaEstadosDocumento');
const { paraDocumentoDetalheDTO } = require('../utils/centralEntradasMapper');
const CentralDocumentosRepository = require('../repositories/CentralDocumentosRepository');
const DocumentoTransitionService = require('./DocumentoTransitionService');

class CentralComprasBridgeService {
  /**
   * @param {Object} [deps]
   */
  constructor(deps = {}) {
    /** @private */
    this._documentosRepository = deps.documentosRepository
      ?? new CentralDocumentosRepository();
    /** @private */
    this._transitionService = deps.transitionService
      ?? new DocumentoTransitionService({
        documentosRepository: this._documentosRepository,
        historicoRepository: deps.historicoRepository
      });
  }

  /**
   * @private
   * @param {Object} documento
   * @returns {Object}
   */
  _obterPayloadParsePersistido(documento) {
    if (!documento.parseJson) {
      const erro = new Error(
        'Documento ainda não processado. O pipeline Parser + MIIP deve ser concluído antes de abrir Compras.'
      );
      erro.statusCode = 400;
      throw erro;
    }

    return { ...documento.parseJson };
  }

  /**
   * @param {number|string} documentoId
   * @returns {Promise<Object>}
   */
  async montarPayloadAbrirCompra(documentoId) {
    const documento = await this._documentosRepository.buscarPorId(documentoId);
    if (!documento) {
      const erro = new Error('Documento não encontrado');
      erro.statusCode = 404;
      throw erro;
    }

    const payload = this._obterPayloadParsePersistido(documento);

    return {
      sucesso: true,
      documentoId: documento.id,
      chave: documento.chave,
      status: documento.status,
      dadosCompra: payload
    };
  }

  /**
   * @param {number|string} documentoId
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async registrarAberturaCompra(documentoId, opcoes = {}) {
    const documento = await this._documentosRepository.buscarPorId(documentoId);
    if (!documento) {
      const erro = new Error('Documento não encontrado');
      erro.statusCode = 404;
      throw erro;
    }

    const statusPermitidos = [
      DocumentoFiscalStatus.PRONTA_PARA_COMPRA,
      DocumentoFiscalStatus.REVISADA,
      DocumentoFiscalStatus.EM_COMPRA
    ];

    if (!statusPermitidos.includes(documento.status)) {
      const erro = new Error(`Documento não está pronto para Compras (status: ${documento.status})`);
      erro.statusCode = 400;
      throw erro;
    }

    if (documento.status !== DocumentoFiscalStatus.EM_COMPRA) {
      await this._transitionService.transicionar(
        documentoId,
        documento.status,
        DocumentoFiscalStatus.EM_COMPRA,
        {
          detalhe: 'Compra aberta na tela de Compras',
          usuarioId: opcoes.usuarioId
        }
      );
    }

    const payload = await this.montarPayloadAbrirCompra(documentoId);
    const atualizado = await this._documentosRepository.buscarPorId(documentoId);

    return {
      ...payload,
      documento: paraDocumentoDetalheDTO(atualizado)
    };
  }

  /**
   * @param {number|string} documentoId
   * @param {Object} dados
   * @returns {Promise<Object>}
   */
  async concluirRevisao(documentoId, dados = {}) {
    const documento = await this._documentosRepository.buscarPorId(documentoId);
    if (!documento) {
      const erro = new Error('Documento não encontrado');
      erro.statusCode = 404;
      throw erro;
    }

    if (documento.status !== DocumentoFiscalStatus.AGUARDANDO_REVISAO) {
      const erro = new Error(`Revisão só pode ser concluída em AGUARDANDO_REVISAO (atual: ${documento.status})`);
      erro.statusCode = 400;
      throw erro;
    }

    const parseAtual = documento.parseJson || {};
    const itensAtualizados = Array.isArray(dados.itens) ? dados.itens : parseAtual.itens;

    const parseAtualizado = {
      ...parseAtual,
      itens: itensAtualizados
    };

    await this._documentosRepository.atualizar(documentoId, {
      parseJson: parseAtualizado,
      processadoEm: new Date().toISOString()
    });

    await this._transitionService.transicionar(
      documentoId,
      DocumentoFiscalStatus.AGUARDANDO_REVISAO,
      DocumentoFiscalStatus.REVISADA,
      {
        detalhe: 'Central de Revisão MIIP concluída',
        usuarioId: dados.usuarioId
      }
    );

    await this._transitionService.transicionar(
      documentoId,
      DocumentoFiscalStatus.REVISADA,
      DocumentoFiscalStatus.PRONTA_PARA_COMPRA,
      {
        detalhe: 'Documento liberado para Compras',
        usuarioId: dados.usuarioId
      }
    );

    const atualizado = await this._documentosRepository.buscarPorId(documentoId);

    return {
      sucesso: true,
      documento: paraDocumentoDetalheDTO(atualizado),
      parse: parseAtualizado,
      proximaAcao: 'abrir_compra'
    };
  }

  /**
   * @param {number|string} documentoId
   * @param {number|string} compraId
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async vincularCompra(documentoId, compraId, opcoes = {}) {
    const documento = await this._documentosRepository.buscarPorId(documentoId);
    if (!documento) {
      const erro = new Error('Documento não encontrado');
      erro.statusCode = 404;
      throw erro;
    }

    const statusAtual = documento.status;
    const statusDestino = DocumentoFiscalStatus.GRAVADA;

    if (statusAtual !== DocumentoFiscalStatus.EM_COMPRA && statusAtual !== DocumentoFiscalStatus.PRONTA_PARA_COMPRA) {
      const validacao = validarTransicao(statusAtual, statusDestino);
      if (!validacao.valido) {
        const erro = new Error(validacao.erro);
        erro.statusCode = 400;
        throw erro;
      }
    }

    if (statusAtual === DocumentoFiscalStatus.PRONTA_PARA_COMPRA) {
      await this._transitionService.transicionar(documentoId, statusAtual, DocumentoFiscalStatus.EM_COMPRA, {
        detalhe: 'Vínculo com compra gravada',
        usuarioId: opcoes.usuarioId
      });
    }

    await this._documentosRepository.atualizar(documentoId, {
      compraId: Number(compraId),
      processadoEm: new Date().toISOString()
    });

    await this._transitionService.transicionar(
      documentoId,
      DocumentoFiscalStatus.EM_COMPRA,
      DocumentoFiscalStatus.GRAVADA,
      {
        detalhe: `Compra #${compraId} gravada via saveCompra()`,
        usuarioId: opcoes.usuarioId
      }
    );

    const atualizado = await this._documentosRepository.buscarPorId(documentoId);

    const { emitirCompraGravada } = require('../utils/centralEventosEmitter');
    emitirCompraGravada(atualizado, compraId).catch(() => {});

    return {
      sucesso: true,
      documento: paraDocumentoDetalheDTO(atualizado),
      compraId: Number(compraId)
    };
  }
}

module.exports = CentralComprasBridgeService;
