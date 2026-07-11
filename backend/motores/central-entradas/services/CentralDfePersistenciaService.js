/**
 * CentralDfePersistenciaService — Persistência de documentos DF-e na Central de Entradas.
 *
 * Sprint 4: inbox only — sem compras, estoque, financeiro ou MIIP.
 * RC6.1: classifica o tipo DF-e (log).
 * RC6.2: RES_NFE → AGUARDANDO_XML_COMPLETO (sem Parser/MIIP/ERRO).
 * RC6.3: PROC_NFE/NFE sobre RES_NFE → atualiza o mesmo registro → SINCRONIZADA.
 *
 * @class CentralDfePersistenciaService
 */

const { DocumentoFiscalStatus } = require('../core/DocumentoFiscalStatus');
const { DocumentoDfeTipo } = require('../core/DocumentoDfeTipo');
const CentralDocumentosRepository = require('../repositories/CentralDocumentosRepository');
const CentralHistoricoRepository = require('../repositories/CentralHistoricoRepository');
const { resolverDb, criarDbHelpers } = require('../repositories/dbHelpers');
const { extrairMetadadosNota } = require('../../../services/fiscal/dfeXmlMetadados');
const DocumentoDfeClassifier = require('./DocumentoDfeClassifier');
const CentralDocumentoAtualizacaoService = require('./CentralDocumentoAtualizacaoService');
const { logCentral } = require('../utils/centralLog');

const DETALHE_RES_NFE = 'Resumo DF-e recebido. Aguardando XML completo.';

const TIPOS_XML_COMPLETO = Object.freeze([
  DocumentoDfeTipo.PROC_NFE,
  DocumentoDfeTipo.NFE
]);

class CentralDfePersistenciaService {
  /**
   * @param {Object} [deps]
   * @param {Object|null} [deps.db]
   * @param {import('../repositories/CentralDocumentosRepository')} [deps.documentosRepository]
   * @param {import('../repositories/CentralHistoricoRepository')} [deps.historicoRepository]
   * @param {import('./CentralDocumentoAtualizacaoService')} [deps.atualizacaoService]
   */
  constructor(deps = {}) {
    /** @private */
    this._db = deps.db ?? null;
    /** @private */
    this._documentosRepository = deps.documentosRepository
      ?? new CentralDocumentosRepository({ db: this._db });
    /** @private */
    this._historicoRepository = deps.historicoRepository
      ?? new CentralHistoricoRepository({ db: this._db });
    /** @private */
    this._atualizacaoService = deps.atualizacaoService
      ?? new CentralDocumentoAtualizacaoService({
        db: this._db,
        documentosRepository: this._documentosRepository,
        historicoRepository: this._historicoRepository,
        transitionService: deps.transitionService
      });
  }

  /** @private */
  _obterSql() {
    return criarDbHelpers(resolverDb(this._db));
  }

  /**
   * @param {string} chave
   * @returns {Promise<boolean>}
   */
  async existeCompraComChave(chave) {
    if (!chave) return false;

    const sql = this._obterSql();
    await sql.whenReady();

    const row = await sql.get(
      'SELECT id FROM compras WHERE chave_acesso = ? LIMIT 1',
      [chave]
    );

    return Boolean(row);
  }

  /**
   * @param {Object} dados
   * @param {string} dados.xml
   * @param {string} [dados.nsu]
   * @param {string} dados.origem
   * @returns {Promise<{ novo: boolean, duplicado: boolean, ignorado: boolean, atualizado?: boolean, documento: Object|null, motivo?: string, tipoDfe?: string }>}
   */
  async persistirDocumentoDfe(dados) {
    const tipoDfe = DocumentoDfeClassifier.classificar(dados.xml);
    logCentral('DFE', {
      mensagem: 'Documento DF-e classificado',
      Tipo: tipoDfe
    });

    const metadados = extrairMetadadosNota(dados.xml);
    const chave = metadados.chave;

    if (!chave) {
      return {
        novo: false,
        duplicado: false,
        ignorado: true,
        documento: null,
        motivo: 'XML sem chave de acesso identificável',
        tipoDfe
      };
    }

    const existente = await this._documentosRepository.buscarPorChave(chave);
    if (existente) {
      // RC6.3 — XML completo para resumo pendente: atualiza o mesmo registro
      const ehXmlCompleto = TIPOS_XML_COMPLETO.includes(tipoDfe);
      const aguardandoXml = existente.status === DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO;

      if (aguardandoXml && ehXmlCompleto) {
        const { documento } = await this._atualizacaoService.atualizarComXmlCompleto({
          documento: existente,
          xml: dados.xml,
          metadados,
          tipoDfe,
          nsu: dados.nsu,
          origem: dados.origem
        });

        return {
          novo: false,
          atualizado: true,
          duplicado: false,
          ignorado: false,
          documento,
          tipoDfe,
          motivo: 'XML completo aplicado ao documento existente'
        };
      }

      return {
        novo: false,
        duplicado: true,
        ignorado: false,
        documento: existente,
        motivo: 'Documento já existente na Central',
        tipoDfe
      };
    }

    const jaComprada = await this.existeCompraComChave(chave);
    const ehResumoDfe = tipoDfe === DocumentoDfeTipo.RES_NFE;

    let status;
    let statusDetalhe = null;
    let detalheHistorico;

    if (jaComprada) {
      status = DocumentoFiscalStatus.DUPLICADA;
      statusDetalhe = 'NF-e já registrada em compras';
      detalheHistorico = dados.origem === 'consulta_chave'
        ? 'Documento recebido via consulta por chave DF-e'
        : dados.origem === 'upload_manual'
          ? 'Documento recebido via upload manual de XML'
          : 'Documento recebido via Distribuição DF-e';
    } else if (ehResumoDfe) {
      status = DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO;
      statusDetalhe = DETALHE_RES_NFE;
      detalheHistorico = DETALHE_RES_NFE;
    } else {
      status = DocumentoFiscalStatus.SINCRONIZADA;
      detalheHistorico = dados.origem === 'consulta_chave'
        ? 'Documento recebido via consulta por chave DF-e'
        : dados.origem === 'upload_manual'
          ? 'Documento recebido via upload manual de XML'
          : 'Documento recebido via Distribuição DF-e';
    }

    const documento = await this._documentosRepository.inserir({
      chave,
      numero: metadados.numero,
      serie: metadados.serie,
      modelo: metadados.modelo,
      fornecedor: metadados.fornecedor,
      cnpjFornecedor: metadados.cnpjFornecedor,
      dataEmissao: metadados.dataEmissao,
      dataEntrada: metadados.dataEntrada,
      valorTotal: metadados.valorTotal,
      xml: dados.xml,
      nsu: dados.nsu ?? null,
      origem: dados.origem,
      status,
      statusDetalhe,
      tipoDocumento: tipoDfe
    });

    await this._historicoRepository.inserir({
      documentoId: documento.id,
      statusAnterior: null,
      statusNovo: status,
      detalhe: detalheHistorico
    });

    const documentoNovo = status === DocumentoFiscalStatus.SINCRONIZADA
      || status === DocumentoFiscalStatus.AGUARDANDO_XML_COMPLETO;

    if (documentoNovo) {
      const { emitirDocumentoRecebido } = require('../utils/centralEventosEmitter');
      emitirDocumentoRecebido(documento, dados.origem || 'dfe').catch(() => {});
    }

    return {
      novo: documentoNovo,
      atualizado: false,
      duplicado: status === DocumentoFiscalStatus.DUPLICADA,
      ignorado: false,
      documento,
      tipoDfe
    };
  }
}

CentralDfePersistenciaService.DETALHE_RES_NFE = DETALHE_RES_NFE;
CentralDfePersistenciaService.TIPOS_XML_COMPLETO = TIPOS_XML_COMPLETO;

module.exports = CentralDfePersistenciaService;
