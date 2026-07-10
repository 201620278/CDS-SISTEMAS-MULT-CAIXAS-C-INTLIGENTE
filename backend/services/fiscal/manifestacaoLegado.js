/**
 * Manifestação do Destinatário — fluxo LEGADO (axios / RecepcaoEvento direto).
 * Isolado para fallback da Plataforma Fiscal (Sprint F7).
 *
 * Infraestrutura apenas — sem regras comerciais, UI ou persistência.
 *
 * @module services/fiscal/manifestacaoLegado
 */

const axios = require('axios');
const https = require('https');
const { carregarCertificadoPfx } = require('./certificateService');
const {
  OperationType,
  getManifestacaoEventoCode
} = require('./core/OperationType');

const NS_EVENTO = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
const ACTION_EVENTO = `${NS_EVENTO}/nfeRecepcaoEvento`;

/**
 * @param {number} ambiente 1=prod 2=hom
 * @returns {string}
 */
function getManifestacaoUrl(ambiente) {
  return Number(ambiente) === 1
    ? 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
    : 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx';
}

/**
 * Monta envelope SOAP técnico de manifestação (sem assinatura — infraestrutura).
 * A assinatura real fica para sprint operacional futura.
 *
 * @param {object} params
 * @returns {string}
 */
function montarEnvelopeManifestacao(params) {
  const {
    tpAmb = 2,
    cUF = '23',
    cnpj = '00000000000000',
    chave = '0'.repeat(44),
    operacao = OperationType.MANIFESTACAO_CIENCIA,
    nSeqEvento = 1,
    xJust = '',
    dhEvento = new Date().toISOString()
  } = params;

  const tpEvento = getManifestacaoEventoCode(operacao) || '210210';
  const chaveLimpa = String(chave).replace(/\D/g, '').padStart(44, '0').slice(0, 44);
  const id = `ID${tpEvento}${chaveLimpa}${String(nSeqEvento).padStart(2, '0')}`;

  let detEvento =
    `<detEvento versao="1.00">` +
      `<descEvento>${descricaoEvento(tpEvento)}</descEvento>`;
  if (tpEvento === '210240' && xJust) {
    detEvento += `<xJust>${escapeXml(xJust)}</xJust>`;
  }
  detEvento += `</detEvento>`;

  const evento =
    `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<infEvento Id="${id}">` +
        `<cOrgao>${cUF}</cOrgao>` +
        `<tpAmb>${tpAmb}</tpAmb>` +
        `<CNPJ>${String(cnpj).replace(/\D/g, '')}</CNPJ>` +
        `<chNFe>${chaveLimpa}</chNFe>` +
        `<dhEvento>${dhEvento}</dhEvento>` +
        `<tpEvento>${tpEvento}</tpEvento>` +
        `<nSeqEvento>${nSeqEvento}</nSeqEvento>` +
        `<verEvento>1.00</verEvento>` +
        detEvento +
      `</infEvento>` +
    `</evento>`;

  const envEvento =
    `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
      `<idLote>1</idLote>` +
      evento +
    `</envEvento>`;

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
      `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
      `<soap12:Header>` +
        `<nfeCabecMsg xmlns="${NS_EVENTO}">` +
          `<cUF>${cUF}</cUF>` +
          `<versaoDados>1.00</versaoDados>` +
        `</nfeCabecMsg>` +
      `</soap12:Header>` +
      `<soap12:Body>` +
        `<nfeDadosMsg xmlns="${NS_EVENTO}">` +
          `${envEvento}` +
        `</nfeDadosMsg>` +
      `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

function descricaoEvento(tpEvento) {
  switch (String(tpEvento)) {
    case '210200': return 'Confirmacao da Operacao';
    case '210210': return 'Ciencia da Operacao';
    case '210220': return 'Desconhecimento da Operacao';
    case '210240': return 'Operacao nao Realizada';
    default: return 'Manifestacao';
  }
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Envia manifestação via fluxo legado.
 *
 * @param {object} params
 * @returns {Promise<object>}
 */
async function enviarManifestacaoLegado(params) {
  const started = process.hrtime.bigint();
  const elapsedMs = () => Number(process.hrtime.bigint() - started) / 1e6;

  const {
    envelope: envelopeInput = null,
    operacao = OperationType.MANIFESTACAO_CIENCIA,
    ambiente = 2,
    cUF = '23',
    cnpj,
    chave,
    nSeqEvento = 1,
    xJust = '',
    certificadoPath,
    certificadoSenha,
    url = null,
    httpClient = null,
    timeoutMs = 30000
  } = params;

  const endpoint = url || getManifestacaoUrl(ambiente);

  const xmlStarted = process.hrtime.bigint();
  const envelope = envelopeInput || montarEnvelopeManifestacao({
    tpAmb: Number(ambiente) === 1 ? 1 : 2,
    cUF,
    cnpj,
    chave,
    operacao,
    nSeqEvento,
    xJust
  });
  const tempoXmlMs = Number(process.hrtime.bigint() - xmlStarted) / 1e6;

  const soapStarted = process.hrtime.bigint();

  try {
    if (typeof httpClient === 'function') {
      const result = await httpClient({
        url: endpoint,
        envelope,
        certificadoPath,
        certificadoSenha,
        soapAction: ACTION_EVENTO,
        namespace: NS_EVENTO,
        timeoutMs
      });
      return {
        success: true,
        body: result.body,
        statusCode: result.statusCode || 200,
        endpoint,
        namespace: NS_EVENTO,
        soapAction: ACTION_EVENTO,
        versao: '1.00',
        tempoXmlMs,
        tempoSoapMs: Number(process.hrtime.bigint() - soapStarted) / 1e6,
        tempo: elapsedMs()
      };
    }

    if (!certificadoPath) {
      return {
        success: false,
        body: null,
        statusCode: null,
        message: 'Certificado não configurado (legado manifestação).',
        endpoint,
        namespace: NS_EVENTO,
        tempoXmlMs,
        tempoSoapMs: 0,
        tempo: elapsedMs()
      };
    }

    const certificado = carregarCertificadoPfx(certificadoPath, certificadoSenha);
    const host = new URL(endpoint).hostname;
    const httpsAgent = new https.Agent({
      key: certificado.privateKeyPem,
      cert: certificado.certBundlePem || certificado.certPem,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      keepAlive: false,
      servername: host
    });

    const response = await axios.post(endpoint, envelope, {
      httpsAgent,
      proxy: false,
      timeout: timeoutMs,
      responseType: 'text',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transitional: { forcedJSONParsing: false },
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${ACTION_EVENTO}"`,
        Accept: 'application/soap+xml, text/xml, */*',
        'User-Agent': 'CDGESTAO-MANIFESTACAO-LEGADO/1.0'
      }
    });

    return {
      success: true,
      body: response.data,
      statusCode: response.status,
      endpoint,
      namespace: NS_EVENTO,
      soapAction: ACTION_EVENTO,
      versao: '1.00',
      tempoXmlMs,
      tempoSoapMs: Number(process.hrtime.bigint() - soapStarted) / 1e6,
      tempo: elapsedMs()
    };
  } catch (error) {
    return {
      success: false,
      body: error.response?.data || null,
      statusCode: error.response?.status || null,
      message: error.message || String(error),
      code: error.code || null,
      endpoint,
      namespace: NS_EVENTO,
      soapAction: ACTION_EVENTO,
      versao: '1.00',
      tempoXmlMs,
      tempoSoapMs: Number(process.hrtime.bigint() - soapStarted) / 1e6,
      tempo: elapsedMs()
    };
  }
}

module.exports = {
  getManifestacaoUrl,
  montarEnvelopeManifestacao,
  enviarManifestacaoLegado,
  NS_EVENTO,
  ACTION_EVENTO
};
