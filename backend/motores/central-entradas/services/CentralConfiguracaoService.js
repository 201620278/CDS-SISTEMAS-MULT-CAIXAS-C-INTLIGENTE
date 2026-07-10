/**
 * CentralConfiguracaoService — Único ponto oficial de configuração da Central (RC4).
 *
 * Nenhum módulo da Central deve ler getFiscalConfig / URLs hardcoded diretamente.
 * Este serviço agrega: ambiente, SEFAZ, certificado (visão), sync, diagnóstico e avançado.
 *
 * @module motores/central-entradas/services/CentralConfiguracaoService
 */

const path = require('path');
const fs = require('fs');
const CentralConfiguracaoRepository = require('../repositories/CentralConfiguracaoRepository');
const CentralConfigService = require('./CentralConfigService');
const centralEntradasFlags = require('../config/centralEntradasFlags');
const { logCentral, logCentralErro } = require('../utils/centralLog');

const CHAVES = Object.freeze({
  AMBIENTE: 'central_ambiente',
  UF: 'central_uf',
  CODIGO_UF: 'central_codigo_uf',
  URL_DFE_PROD: 'sefaz_url_dfe_producao',
  URL_DFE_HOM: 'sefaz_url_dfe_homologacao',
  URL_CONSULTA_PROD: 'sefaz_url_consulta_chave_producao',
  URL_CONSULTA_HOM: 'sefaz_url_consulta_chave_homologacao',
  URL_MANIF_PROD: 'sefaz_url_manifestacao_producao',
  URL_MANIF_HOM: 'sefaz_url_manifestacao_homologacao',
  VERSAO_SERVICO: 'sefaz_versao_servico',
  TIMEOUT_MS: 'sefaz_timeout_ms',
  MAX_TENTATIVAS: 'sefaz_max_tentativas',
  INTERVALO_TENTATIVAS: 'sefaz_intervalo_tentativas_ms',
  REPROCESSAMENTO: 'sync_reprocessamento_automatico',
  HTTP_TIMEOUT: 'http_timeout_ms',
  HTTP_RETRY: 'http_retry',
  PROXY_HAB: 'proxy_habilitado',
  PROXY_URL: 'proxy_url',
  LOG_DETALHADO: 'log_detalhado',
  MODO_DEBUG: 'modo_debug'
});

class CentralConfiguracaoService {
  /**
   * @param {Object} [deps]
   */
  constructor(deps = {}) {
    /** @private */
    this._repository = deps.configuracaoRepository
      ?? deps.configRepository
      ?? new CentralConfiguracaoRepository();
    /** @private */
    this._syncConfig = deps.syncConfigService
      ?? new CentralConfigService({
        configRepository: this._repository,
        flags: deps.flags ?? centralEntradasFlags
      });
    /** @private */
    this._flags = deps.flags ?? centralEntradasFlags;
    /** @private */
    this._getFiscalConfig = deps.getFiscalConfig
      || (() => require('../../../services/fiscal/configService').getFiscalConfig({ validarUrls: false }));
    /** @private */
    this._carregarCertificado = deps.carregarCertificado
      || ((p, s) => require('../../../services/fiscal/certificateService').carregarCertificadoPfx(p, s));
  }

  /**
   * @returns {Promise<Object>}
   */
  async obterPainelCompleto() {
    await this._repository.ensureDefaults();
    const [sync, mapa, certificado, meta] = await Promise.all([
      this._syncConfig.obterResumo(),
      this._obterMapaValores(),
      this._obterVisaoCertificado(),
      this._obterMetadadosAlteracao()
    ]);

    const ambienteCode = Number(mapa[CHAVES.AMBIENTE]) === 1 ? 1 : 2;

    return {
      versaoConfiguracao: 'RC4',
      ambiente: {
        codigo: ambienteCode,
        label: ambienteCode === 1 ? 'Produção' : 'Homologação',
        uf: mapa[CHAVES.UF] || 'SVRS',
        codigoUf: String(mapa[CHAVES.CODIGO_UF] || '23').padStart(2, '0'),
        atualizadoEm: meta.atualizadoEm,
        ultimaAlteracao: meta.ultimaAlteracao
      },
      sefaz: {
        urlDistribuicaoDfe: this._urlDfe(ambienteCode, mapa),
        urlDistribuicaoDfeProducao: mapa[CHAVES.URL_DFE_PROD] || '',
        urlDistribuicaoDfeHomologacao: mapa[CHAVES.URL_DFE_HOM] || '',
        urlConsultaChave: this._urlPorAmbiente(ambienteCode, mapa[CHAVES.URL_CONSULTA_PROD], mapa[CHAVES.URL_CONSULTA_HOM]),
        urlConsultaChaveProducao: mapa[CHAVES.URL_CONSULTA_PROD] || '',
        urlConsultaChaveHomologacao: mapa[CHAVES.URL_CONSULTA_HOM] || '',
        urlManifestacao: this._urlPorAmbiente(ambienteCode, mapa[CHAVES.URL_MANIF_PROD], mapa[CHAVES.URL_MANIF_HOM]),
        urlManifestacaoProducao: mapa[CHAVES.URL_MANIF_PROD] || '',
        urlManifestacaoHomologacao: mapa[CHAVES.URL_MANIF_HOM] || '',
        versaoServico: mapa[CHAVES.VERSAO_SERVICO] || '1.01',
        timeoutMs: Number(mapa[CHAVES.TIMEOUT_MS]) || 90000,
        maxTentativas: Number(mapa[CHAVES.MAX_TENTATIVAS]) || 2,
        intervaloTentativasMs: Number(mapa[CHAVES.INTERVALO_TENTATIVAS]) || 3000,
        manifestacaoPreparada: true,
        manifestacaoAtiva: false
      },
      certificado,
      sincronizacao: {
        ...sync,
        reprocessamentoAutomatico: mapa[CHAVES.REPROCESSAMENTO] !== false
      },
      diagnostico: await this._obterResumoDiagnostico(),
      avancado: {
        httpTimeoutMs: Number(mapa[CHAVES.HTTP_TIMEOUT]) || 90000,
        httpRetry: Number(mapa[CHAVES.HTTP_RETRY]) || 2,
        proxyHabilitado: mapa[CHAVES.PROXY_HAB] === true,
        proxyUrl: mapa[CHAVES.PROXY_URL] || '',
        proxyFuncional: false,
        logDetalhado: mapa[CHAVES.LOG_DETALHADO] === true,
        modoDebug: mapa[CHAVES.MODO_DEBUG] === true
      },
      certificadosFiliais: certificado.presente
        ? [{ id: 'principal', nome: certificado.nome || 'Principal', cnpj: certificado.cnpj, status: certificado.status }]
        : [],
      preparadoPara: ['manifestacao', 'cte', 'mdfe', 'nfse', 'multiplos_cnpjs', 'proxy']
    };
  }

  /**
   * Contexto operacional para sync/SOAP — único contrato interno.
   * @returns {Promise<{ ok: boolean, codigoErro?: string, mensagem?: string, contexto?: Object }>}
   */
  async obterContextoOperacional() {
    await this._repository.ensureDefaults();
    const mapa = await this._obterMapaValores();
    const sync = await this._syncConfig.obterResumo();

    let fiscal = {};
    try {
      fiscal = await this._getFiscalConfig();
    } catch (error) {
      return {
        ok: false,
        codigoErro: 'CONFIG_FISCAL',
        mensagem: this._mensagemAmigavel(error.message)
      };
    }

    const ambienteCentral = Number(mapa[CHAVES.AMBIENTE]);
    const ambiente = ambienteCentral === 1 || ambienteCentral === 2
      ? ambienteCentral
      : (Number(fiscal.ambiente) === 1 ? 1 : 2);

    const certificadoPath = fiscal.certificadoPath || null;
    const certificadoSenha = fiscal.certificadoSenha || null;
    const cnpj = String(fiscal.cnpj || '').replace(/\D/g, '');

    if (!certificadoPath || !certificadoSenha) {
      return {
        ok: false,
        codigoErro: 'CERTIFICADO',
        mensagem: 'Certificado digital não configurado. Abra Configuração da Central → Certificado.'
      };
    }

    if (!cnpj || cnpj.length !== 14) {
      return {
        ok: false,
        codigoErro: 'CNPJ',
        mensagem: 'CNPJ do emitente não configurado. Verifique o cadastro fiscal da empresa.'
      };
    }

    if (!fs.existsSync(certificadoPath)) {
      return {
        ok: false,
        codigoErro: 'CERTIFICADO',
        mensagem: 'Arquivo do certificado não encontrado no caminho configurado.'
      };
    }

    const urlDfe = this._urlDfe(ambiente, mapa);
    if (!urlDfe) {
      return {
        ok: false,
        codigoErro: 'URL_SEFAZ',
        mensagem: 'URL de Distribuição DF-e não configurada na Central.'
      };
    }

    return {
      ok: true,
      contexto: {
        ambiente,
        uf: mapa[CHAVES.UF] || 'SVRS',
        codigoUf: String(mapa[CHAVES.CODIGO_UF] || fiscal.codigoUf || fiscal.fiscal_codigo_uf || '23').replace(/\D/g, '').padStart(2, '0'),
        cnpj,
        certificadoPath,
        certificadoSenha,
        urls: {
          distribuicaoDfe: urlDfe,
          consultaChave: this._urlPorAmbiente(ambiente, mapa[CHAVES.URL_CONSULTA_PROD], mapa[CHAVES.URL_CONSULTA_HOM]),
          manifestacao: this._urlPorAmbiente(ambiente, mapa[CHAVES.URL_MANIF_PROD], mapa[CHAVES.URL_MANIF_HOM])
        },
        versaoServico: mapa[CHAVES.VERSAO_SERVICO] || '1.01',
        timeoutMs: Number(mapa[CHAVES.TIMEOUT_MS]) || Number(mapa[CHAVES.HTTP_TIMEOUT]) || 90000,
        maxTentativas: Number(mapa[CHAVES.MAX_TENTATIVAS]) || 2,
        intervaloTentativasMs: Number(mapa[CHAVES.INTERVALO_TENTATIVAS]) || 3000,
        syncMaxDocumentos: sync.syncMaxDocumentos,
        reprocessamentoAutomatico: mapa[CHAVES.REPROCESSAMENTO] !== false,
        logDetalhado: mapa[CHAVES.LOG_DETALHADO] === true,
        modoDebug: mapa[CHAVES.MODO_DEBUG] === true
      }
    };
  }

  /**
   * @param {Object} alteracoes
   * @returns {Promise<Object>}
   */
  async atualizar(alteracoes = {}) {
    await this._repository.ensureDefaults();

    const syncCampos = [
      'syncAutomaticaHabilitada', 'syncIntervaloMinutos', 'syncAoAbrir',
      'syncMaxDocumentos', 'horarioPermitidoInicio', 'horarioPermitidoFim',
      'horarioBloqueadoInicio', 'horarioBloqueadoFim', 'notificarNovasNotas'
    ];
    const syncPayload = {};
    for (const c of syncCampos) {
      if (alteracoes[c] !== undefined) syncPayload[c] = alteracoes[c];
      if (alteracoes.sincronizacao && alteracoes.sincronizacao[c] !== undefined) {
        syncPayload[c] = alteracoes.sincronizacao[c];
      }
    }
    if (Object.keys(syncPayload).length) {
      await this._syncConfig.atualizar(syncPayload);
    }

    const mapaCampos = {
      ambiente: [CHAVES.AMBIENTE, 'number'],
      uf: [CHAVES.UF, 'string'],
      codigoUf: [CHAVES.CODIGO_UF, 'string'],
      urlDistribuicaoDfeProducao: [CHAVES.URL_DFE_PROD, 'string'],
      urlDistribuicaoDfeHomologacao: [CHAVES.URL_DFE_HOM, 'string'],
      urlConsultaChaveProducao: [CHAVES.URL_CONSULTA_PROD, 'string'],
      urlConsultaChaveHomologacao: [CHAVES.URL_CONSULTA_HOM, 'string'],
      urlManifestacaoProducao: [CHAVES.URL_MANIF_PROD, 'string'],
      urlManifestacaoHomologacao: [CHAVES.URL_MANIF_HOM, 'string'],
      versaoServico: [CHAVES.VERSAO_SERVICO, 'string'],
      timeoutMs: [CHAVES.TIMEOUT_MS, 'number'],
      maxTentativas: [CHAVES.MAX_TENTATIVAS, 'number'],
      intervaloTentativasMs: [CHAVES.INTERVALO_TENTATIVAS, 'number'],
      reprocessamentoAutomatico: [CHAVES.REPROCESSAMENTO, 'boolean'],
      httpTimeoutMs: [CHAVES.HTTP_TIMEOUT, 'number'],
      httpRetry: [CHAVES.HTTP_RETRY, 'number'],
      proxyHabilitado: [CHAVES.PROXY_HAB, 'boolean'],
      proxyUrl: [CHAVES.PROXY_URL, 'string'],
      logDetalhado: [CHAVES.LOG_DETALHADO, 'boolean'],
      modoDebug: [CHAVES.MODO_DEBUG, 'boolean']
    };

    const flat = { ...alteracoes, ...(alteracoes.ambiente || {}), ...(alteracoes.sefaz || {}), ...(alteracoes.avancado || {}), ...(alteracoes.sincronizacao || {}) };
    if (alteracoes.ambiente?.codigo != null) flat.ambiente = alteracoes.ambiente.codigo;
    if (alteracoes.ambiente?.uf != null) flat.uf = alteracoes.ambiente.uf;
    if (alteracoes.ambiente?.codigoUf != null) flat.codigoUf = alteracoes.ambiente.codigoUf;

    for (const [campo, valor] of Object.entries(flat)) {
      if (valor === undefined || !mapaCampos[campo]) continue;
      const [chave, tipo] = mapaCampos[campo];
      let v = valor;
      if (campo === 'ambiente') v = Number(valor) === 1 ? 1 : 2;
      await this._repository.salvar(chave, v, tipo);
    }

    await this._syncConfig.hidratarFlags();
    logCentral('CONFIG', { fase: 'atualizado' });
    return this.obterPainelCompleto();
  }

  /**
   * Restaura defaults RC4 (não apaga sync operacional do usuário se omitido).
   * @param {Object} [opcoes]
   * @returns {Promise<Object>}
   */
  async restaurarPadrao(opcoes = {}) {
    await this._repository.ensureDefaults();
    for (const [chave, valor, tipo] of CentralConfiguracaoRepository.DEFAULTS) {
      if (!opcoes.incluirSync && String(chave).startsWith('sync_')) continue;
      await this._repository.salvar(chave, tipo === 'number' ? Number(valor) : (tipo === 'boolean' ? valor === 'true' : valor), tipo);
    }
    return this.obterPainelCompleto();
  }

  // —— Compatibilidade com CentralConfigService (sync) ——

  /**
   * Alias oficial RC5 — mesmo contrato de CentralConfigService.obterResumo().
   * @returns {Promise<Object>}
   */
  obterResumo() {
    return this.obterResumoSync();
  }

  obterResumoSync() {
    return this._syncConfig.obterResumo();
  }

  atualizarSync(alteracoes) {
    return this._syncConfig.atualizar(alteracoes);
  }

  hidratarFlags() {
    return this._syncConfig.hidratarFlags();
  }

  obterIntervaloMs() {
    return this._syncConfig.obterIntervaloMs();
  }

  verificarHorarioPermitido(agora) {
    return this._syncConfig.verificarHorarioPermitido(agora);
  }

  /** @private */
  async _obterMapaValores() {
    const registros = await this._repository.listarTodas();
    const mapa = {};
    for (const reg of registros) {
      mapa[reg.chave] = this._repository.parseValor(reg);
    }
    return mapa;
  }

  /** @private */
  _urlDfe(ambiente, mapa) {
    return this._urlPorAmbiente(ambiente, mapa[CHAVES.URL_DFE_PROD], mapa[CHAVES.URL_DFE_HOM]);
  }

  /** @private */
  _urlPorAmbiente(ambiente, prod, hom) {
    return Number(ambiente) === 1 ? (prod || '') : (hom || '');
  }

  /** @private */
  async _obterVisaoCertificado() {
    try {
      const fiscal = await this._getFiscalConfig();
      const certificadoPath = fiscal.certificadoPath;
      if (!certificadoPath) {
        return {
          presente: false,
          nome: null,
          cnpj: fiscal.cnpj || null,
          validade: null,
          diasRestantes: null,
          status: 'AUSENTE',
          caminho: null,
          mensagem: 'Nenhum certificado configurado'
        };
      }

      const existe = fs.existsSync(certificadoPath);
      if (!existe) {
        return {
          presente: false,
          nome: path.basename(certificadoPath),
          cnpj: fiscal.cnpj || null,
          validade: null,
          diasRestantes: null,
          status: 'ARQUIVO_AUSENTE',
          caminho: certificadoPath,
          mensagem: 'Arquivo do certificado não encontrado'
        };
      }

      try {
        const cert = this._carregarCertificado(certificadoPath, fiscal.certificadoSenha);
        let validade = null;
        let diasRestantes = null;
        let status = 'OK';
        let nome = path.basename(certificadoPath);
        try {
          const forge = require('node-forge');
          const x509 = forge.pki.certificateFromPem(cert.certPem);
          validade = x509.validity.notAfter;
          diasRestantes = Math.ceil((validade.getTime() - Date.now()) / 86400000);
          if (diasRestantes < 0) status = 'VENCIDO';
          else if (diasRestantes <= 30) status = 'A_VENCER';
          const cn = x509.subject.getField('CN');
          if (cn?.value) nome = cn.value;
        } catch { /* ignore parse */ }

        return {
          presente: true,
          nome,
          cnpj: fiscal.cnpj || null,
          validade: validade ? new Date(validade).toISOString() : null,
          diasRestantes,
          status,
          caminho: certificadoPath,
          mensagem: status === 'OK' ? 'Certificado válido' : status
        };
      } catch (error) {
        return {
          presente: true,
          nome: path.basename(certificadoPath),
          cnpj: fiscal.cnpj || null,
          validade: null,
          diasRestantes: null,
          status: 'ERRO',
          caminho: certificadoPath,
          mensagem: this._mensagemAmigavel(error.message)
        };
      }
    } catch (error) {
      return {
        presente: false,
        nome: null,
        cnpj: null,
        validade: null,
        diasRestantes: null,
        status: 'ERRO',
        caminho: null,
        mensagem: this._mensagemAmigavel(error.message)
      };
    }
  }

  /** @private */
  async _obterMetadadosAlteracao() {
    const registros = await this._repository.listarTodas();
    let latest = null;
    for (const reg of registros) {
      if (!reg.updatedAt) continue;
      if (!latest || String(reg.updatedAt) > String(latest)) latest = reg.updatedAt;
    }
    return {
      atualizadoEm: latest,
      ultimaAlteracao: latest
    };
  }

  /** @private */
  async _obterResumoDiagnostico() {
    const { VERSAO_MODULO } = require('../CentralEntradasOrchestrator');
    let tempoMedio = null;
    let ultimaSync = null;
    let ultimoErro = null;
    try {
      const eventos = require('./CentralEventosService');
      const svc = new eventos();
      tempoMedio = await svc.obterTempoMedioSyncMs();
      ultimaSync = await svc.obterUltimaSyncConcluida();
      ultimoErro = await svc.obterUltimoErroSync();
    } catch { /* ignore */ }

    return {
      versaoCentral: VERSAO_MODULO,
      versaoPipeline: 'RC3',
      versaoParser: 'oficial',
      versaoMiip: 'RC1',
      tempoMedioSyncMs: tempoMedio,
      ultimaSincronizacao: ultimaSync?.createdAt || null,
      ultimoErro: ultimoErro?.descricao || null
    };
  }

  /** @private */
  _mensagemAmigavel(msg) {
    const m = String(msg || '');
    if (/certificado/i.test(m)) return 'Certificado digital ausente ou inválido. Configure na aba Certificado.';
    if (/cnpj/i.test(m)) return 'CNPJ do emitente não configurado.';
    if (/url|autoriza/i.test(m)) return 'Configuração SEFAZ incompleta. Verifique a aba SEFAZ.';
    if (/timeout|ECONNABORTED/i.test(m)) return 'A SEFAZ não respondeu a tempo. Tente novamente.';
    return m || 'Falha na configuração operacional da Central.';
  }
}

CentralConfiguracaoService.CHAVES = CHAVES;

module.exports = CentralConfiguracaoService;
