/**
 * Distribuição DF-e — SEFAZ → SOAP → Download XML → Central de Entradas.
 *
 * Sprint 4: responsabilidade exclusiva de sincronizar documentos na inbox.
 * Sprint F6: envio SOAP via Plataforma Fiscal + fallback legado.
 * NÃO cria compras, NÃO altera estoque/financeiro, NÃO chama MIIP.
 *
 * @module services/fiscal/distribuicaoDFe
 */

const { getFiscalConfig } = require('./configService');
const {
  enviarDistribuicaoDfe,
  getDfeUrl
} = require('./distribuicaoDfeRuntime');
const CentralDfePersistenciaService = require('../../motores/central-entradas/services/CentralDfePersistenciaService');
const CentralDocumentosRepository = require('../../motores/central-entradas/repositories/CentralDocumentosRepository');
const CentralNsuRepository = require('../../motores/central-entradas/repositories/CentralNsuRepository');
const CentralNsuService = require('../../motores/central-entradas/services/CentralNsuService');
const {
  NSU_ZERADO,
  normalizarNsu,
  nsuMenorQue,
  extrairMetadadosRetorno,
  extrairDocumentosZip,
  retornoDistSucesso
} = require('./dfeRetornoParser');

const MAX_ITERACOES_SYNC = 50;

/**
 * @param {Object} config
 * @returns {string}
 */
function obterCodigoUf(config) {
  const codigo = config.fiscal_codigo_uf || config.codigo_uf || '23';
  return String(codigo).replace(/\D/g, '').padStart(2, '0');
}

/**
 * @param {Object} config
 * @throws {Error}
 */
function validarConfigFiscal(config) {
  if (!config.certificadoPath || !config.certificadoSenha) {
    throw new Error('Certificado não configurado');
  }

  if (!config.cnpj) {
    throw new Error('CNPJ do emitente não configurado');
  }
}

/**
 * @param {Object} params
 * @returns {string}
 */
function montarXmlDistNsu({ ambiente, codigoUf, cnpj, ultNsu }) {
  return `
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${ambiente}</tpAmb>
  <cUFAutor>${codigoUf}</cUFAutor>
  <CNPJ>${cnpj}</CNPJ>
  <distNSU>
    <ultNSU>${normalizarNsu(ultNsu)}</ultNSU>
  </distNSU>
</distDFeInt>`;
}

/**
 * @param {Object} params
 * @returns {string}
 */
function montarXmlConsChave({ ambiente, codigoUf, cnpj, chave }) {
  return `
<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
  <tpAmb>${ambiente}</tpAmb>
  <cUFAutor>${codigoUf}</cUFAutor>
  <CNPJ>${cnpj}</CNPJ>
  <consChNFe>
    <chNFe>${String(chave).replace(/\D/g, '')}</chNFe>
  </consChNFe>
</distDFeInt>`;
}

/**
 * Envia consulta DF-e via Plataforma Fiscal (F6) com fallback legado.
 *
 * @param {string} xmlConsulta
 * @param {Object} config
 * @param {number} ambiente
 * @param {Object} [deps]
 * @returns {Promise<string>}
 */
async function enviarConsultaDfe(xmlConsulta, config, ambiente, deps = {}) {
  const runtimeSend = deps.enviarDistribuicaoDfe || enviarDistribuicaoDfe;
  const resultado = await runtimeSend({
    xmlConsulta,
    ambiente,
    cUF: obterCodigoUf(config),
    certificadoPath: config.certificadoPath,
    certificadoSenha: config.certificadoSenha,
    versao: '1.01',
    legadoHttpClient: deps.legadoHttpClient || null
  });

  if (!resultado.success || resultado.body == null) {
    throw new Error(resultado.error || 'Falha na Distribuição DF-e (plataforma/legado).');
  }

  return resultado.body;
}

/**
 * @param {string} xmlRetorno
 * @param {CentralDfePersistenciaService} persistencia
 * @param {string} origem
 * @returns {Promise<{ notasNovas: number, notasDuplicadas: number, ignorados: number }>}
 */
async function persistirDocumentosRetorno(xmlRetorno, persistencia, origem) {
  const documentos = extrairDocumentosZip(xmlRetorno);
  let notasNovas = 0;
  let notasDuplicadas = 0;
  let ignorados = 0;

  for (const doc of documentos) {
    const resultado = await persistencia.persistirDocumentoDfe({
      xml: doc.xml,
      nsu: doc.nsu,
      origem
    });

    if (resultado.novo) notasNovas += 1;
    else if (resultado.duplicado) notasDuplicadas += 1;
    else if (resultado.ignorado) ignorados += 1;
  }

  return { notasNovas, notasDuplicadas, ignorados };
}

/**
 * @param {Object} [deps]
 * @returns {Promise<Object>}
 */
async function sincronizarDistribuicaoDFe(deps = {}) {
  let config;
  let ambiente;

  if (deps.contextoCentral) {
    const ctx = deps.contextoCentral;
    config = {
      certificadoPath: ctx.certificadoPath,
      certificadoSenha: ctx.certificadoSenha,
      cnpj: ctx.cnpj,
      fiscal_codigo_uf: ctx.codigoUf,
      codigo_uf: ctx.codigoUf,
      ambiente: ctx.ambiente,
      fiscal_ambiente: ctx.ambiente
    };
    ambiente = Number(ctx.ambiente) === 1 ? 1 : 2;
  } else {
    // DF-e não depende de URL de autorização NFC-e
    config = await getFiscalConfig({ validarUrls: false });
    ambiente = Number(config.fiscal_ambiente || config.ambiente || 2);
  }

  validarConfigFiscal(config);
  const cnpj = String(config.cnpj).replace(/\D/g, '');
  const codigoUf = obterCodigoUf(config);

  const nsuRepository = deps.nsuRepository ?? new CentralNsuRepository();
  const nsuService = deps.nsuService
    ?? new CentralNsuService({ nsuRepository });
  const persistencia = deps.persistenciaService ?? new CentralDfePersistenciaService();
  const correlationId = deps.correlationId || null;

  let controleNsu = await nsuService.obterOuCriar(cnpj, ambiente);
  let ultNsuAtual = normalizarNsu(controleNsu.ultNsu);
  let maxNsuAtual = normalizarNsu(controleNsu.maxNsu || NSU_ZERADO);

  let notasNovasTotal = 0;
  let notasDuplicadasTotal = 0;
  let ignoradosTotal = 0;
  let iteracoes = 0;
  let ultimoRetorno = null;

  while (iteracoes < (deps.maxIteracoes ?? MAX_ITERACOES_SYNC)) {
    iteracoes += 1;

    const xmlConsulta = montarXmlDistNsu({
      ambiente,
      codigoUf,
      cnpj,
      ultNsu: ultNsuAtual
    });

    const xmlRetorno = await enviarConsultaDfe(xmlConsulta, config, ambiente, deps);
    ultimoRetorno = extrairMetadadosRetorno(xmlRetorno);

    if (!retornoDistSucesso(ultimoRetorno.cStat)) {
      throw new Error(
        ultimoRetorno.xMotivo
          || `SEFAZ retornou cStat ${ultimoRetorno.cStat || 'desconhecido'}`
      );
    }

    // cStat 656: não persiste documentos nem altera NSU — apenas cooldown.
    if (String(ultimoRetorno.cStat) === '656') {
      const aplicado = await nsuService.aplicarRetornoDistDfe({
        controle: controleNsu,
        cStat: '656',
        xmlRetorno,
        correlationId
      });
      controleNsu = aplicado.controle;
      ultNsuAtual = normalizarNsu(aplicado.ultNsu);
      maxNsuAtual = normalizarNsu(aplicado.maxNsu);
      return {
        sucesso: false,
        codigo: 'CONSUMO_INDEVIDO',
        notasNovas: notasNovasTotal,
        notasDuplicadas: notasDuplicadasTotal,
        ignorados: ignoradosTotal,
        ultNsu: ultNsuAtual,
        maxNsu: maxNsuAtual,
        iteracoes,
        cStat: '656',
        proximaConsultaEm: aplicado.proximaConsultaEm,
        mensagem: ultimoRetorno.xMotivo
          || 'Consumo indevido (cStat 656) — NSU preservado; nova consulta após 1 hora.',
        ultimaSincronizacao: controleNsu.dataSincronizacao || controleNsu.updatedAt
      };
    }

    const persistidos = await persistirDocumentosRetorno(xmlRetorno, persistencia, 'dfe');
    notasNovasTotal += persistidos.notasNovas;
    notasDuplicadasTotal += persistidos.notasDuplicadas;
    ignoradosTotal += persistidos.ignorados;

    const aplicado = await nsuService.aplicarRetornoDistDfe({
      controle: controleNsu,
      cStat: ultimoRetorno.cStat,
      xmlRetorno,
      ultNsu: ultimoRetorno.ultNSU,
      maxNsu: ultimoRetorno.maxNSU,
      correlationId
    });
    controleNsu = aplicado.controle;
    ultNsuAtual = normalizarNsu(aplicado.ultNsu);
    maxNsuAtual = normalizarNsu(aplicado.maxNsu);

    if (!nsuMenorQue(ultNsuAtual, maxNsuAtual)) {
      break;
    }
  }

  return {
    sucesso: true,
    notasNovas: notasNovasTotal,
    notasDuplicadas: notasDuplicadasTotal,
    ignorados: ignoradosTotal,
    ultNsu: ultNsuAtual,
    maxNsu: maxNsuAtual,
    iteracoes,
    cStat: ultimoRetorno?.cStat || '138',
    mensagem: notasNovasTotal > 0
      ? `${notasNovasTotal} nova(s) nota(s) sincronizada(s)`
      : 'Sincronização concluída — nenhuma nota nova',
    ultimaSincronizacao: controleNsu.dataSincronizacao || controleNsu.updatedAt
  };
}

/**
 * Compatibilidade legada — delega à sincronização oficial.
 *
 * @deprecated RC1 — Use POST /api/central-entradas/sincronizar
 * @returns {Promise<Object>}
 */
async function distribuirDocumentosRecebidos() {
  const resultado = await sincronizarDistribuicaoDFe();
  return {
    sucesso: resultado.sucesso,
    notasNovas: resultado.notasNovas,
    mensagem: resultado.mensagem,
    ultNsu: resultado.ultNsu,
    maxNsu: resultado.maxNsu
  };
}

/**
 * @param {string} chave
 * @param {Object} [deps]
 * @returns {Promise<Object>}
 */
async function consultarNotaPorChave(chave, deps = {}) {
  let config;
  let ambiente;

  if (deps.contextoCentral) {
    const ctx = deps.contextoCentral;
    config = {
      certificadoPath: ctx.certificadoPath,
      certificadoSenha: ctx.certificadoSenha,
      cnpj: ctx.cnpj,
      fiscal_codigo_uf: ctx.codigoUf,
      codigo_uf: ctx.codigoUf,
      ambiente: ctx.ambiente,
      fiscal_ambiente: ctx.ambiente
    };
    ambiente = Number(ctx.ambiente) === 1 ? 1 : 2;
  } else {
    config = await getFiscalConfig({ validarUrls: false });
    ambiente = Number(config.fiscal_ambiente || config.ambiente || 2);
  }

  validarConfigFiscal(config);

  const chaveLimpa = String(chave || '').replace(/\D/g, '');
  if (chaveLimpa.length !== 44) {
    throw new Error('Chave deve conter 44 dígitos');
  }

  const cnpj = String(config.cnpj).replace(/\D/g, '');
  const codigoUf = obterCodigoUf(config);
  const persistencia = deps.persistenciaService ?? new CentralDfePersistenciaService();

  const xmlConsulta = montarXmlConsChave({
    ambiente,
    codigoUf,
    cnpj,
    chave: chaveLimpa
  });

  const xmlRetorno = await enviarConsultaDfe(xmlConsulta, config, ambiente, deps);
  const metadados = extrairMetadadosRetorno(xmlRetorno);

  if (!retornoDistSucesso(metadados.cStat) && metadados.cStat !== '138') {
    throw new Error(metadados.xMotivo || `SEFAZ retornou cStat ${metadados.cStat}`);
  }

  const persistidos = await persistirDocumentosRetorno(xmlRetorno, persistencia, 'consulta_chave');

  return {
    sucesso: true,
    chave: chaveLimpa,
    cStat: metadados.cStat,
    mensagem: metadados.xMotivo,
    notasNovas: persistidos.notasNovas,
    notasDuplicadas: persistidos.notasDuplicadas,
    ignorados: persistidos.ignorados
  };
}

/**
 * Lista documentos da Central (compatibilidade legada /api/dfe/consultar-notas).
 *
 * @deprecated RC1 — Use GET /api/central-entradas/documentos
 * @returns {Promise<Object>}
 */
async function consultarNotasRecebidas() {
  const repository = new CentralDocumentosRepository();
  const documentos = await repository.listar({ limite: 200, ordenarPor: 'created_at', ordenarDirecao: 'DESC' });

  return {
    sucesso: true,
    mensagem: 'Notas da Central Inteligente de Entradas',
    notas: documentos.map((doc) => ({
      id: doc.id,
      chave: doc.chave,
      numero: doc.numero,
      serie: doc.serie,
      fornecedor: doc.fornecedor,
      cnpj_fornecedor: doc.cnpjFornecedor,
      data_emissao: doc.dataEmissao,
      valor_total: doc.valorTotal,
      status: doc.status,
      origem: doc.origem,
      nsu: doc.nsu,
      created_at: doc.createdAt
    }))
  };
}

module.exports = {
  sincronizarDistribuicaoDFe,
  distribuirDocumentosRecebidos,
  consultarNotaPorChave,
  consultarNotasRecebidas,
  getDfeUrl,
  montarXmlDistNsu,
  montarXmlConsChave,
  extrairMetadadosRetorno,
  extrairDocumentosZip,
  persistirDocumentosRetorno,
  enviarConsultaDfe
};
