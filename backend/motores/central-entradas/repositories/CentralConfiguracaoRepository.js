/**
 * CentralConfiguracaoRepository — Persistência KV da configuração enterprise (RC4).
 * Reutiliza a tabela central_entradas_config.
 *
 * @module motores/central-entradas/repositories/CentralConfiguracaoRepository
 */

const CentralConfigRepository = require('./CentralConfigRepository');

/**
 * Defaults oficiais da Central (operação).
 * Endpoints SOAP DF-e NÃO vivem aqui — exclusivos do UrlResolver (Plataforma Fiscal).
 * Chaves sefaz_url_dfe_* permanecem vazias/legado de schema (não usadas no SOAP).
 */
const DEFAULTS = Object.freeze([
  ['central_ambiente', '2', 'number', 'Ambiente operacional da Central (1=Produção, 2=Homologação)'],
  ['central_uf', 'SVRS', 'string', 'UF/autorizador operacional'],
  ['central_codigo_uf', '23', 'string', 'Código IBGE da UF autor'],
  ['sefaz_url_dfe_producao', '', 'string', 'DEPRECATED — endpoint DF-e via UrlResolver (Plataforma Fiscal)'],
  ['sefaz_url_dfe_homologacao', '', 'string', 'DEPRECATED — endpoint DF-e via UrlResolver (Plataforma Fiscal)'],
  ['sefaz_url_consulta_chave_producao', '', 'string', 'URL Consulta por chave (preparação)'],
  ['sefaz_url_consulta_chave_homologacao', '', 'string', 'URL Consulta por chave homologação (preparação)'],
  ['sefaz_url_manifestacao_producao', '', 'string', 'URL Manifestação (preparação futura)'],
  ['sefaz_url_manifestacao_homologacao', '', 'string', 'URL Manifestação homologação (preparação futura)'],
  ['sefaz_versao_servico', '1.01', 'string', 'Versão do serviço DF-e'],
  ['sefaz_timeout_ms', '90000', 'number', 'Timeout SOAP SEFAZ (ms)'],
  ['sefaz_max_tentativas', '2', 'number', 'Máximo de tentativas SOAP'],
  ['sefaz_intervalo_tentativas_ms', '3000', 'number', 'Intervalo entre tentativas (ms)'],
  ['sync_reprocessamento_automatico', 'true', 'boolean', 'Reprocessar pendências após sync'],
  ['http_timeout_ms', '90000', 'number', 'Timeout HTTP avançado (ms)'],
  ['http_retry', '2', 'number', 'Retries HTTP avançados'],
  ['proxy_habilitado', 'false', 'boolean', 'Proxy (estrutura — não funcional)'],
  ['proxy_url', '', 'string', 'URL do proxy (estrutura)'],
  ['log_detalhado', 'false', 'boolean', 'Log detalhado da Central'],
  ['modo_debug', 'false', 'boolean', 'Modo debug da Central']
]);

class CentralConfiguracaoRepository extends CentralConfigRepository {
  getDescricao() {
    return 'Configuração Enterprise da Central Inteligente de Entradas (RC4)';
  }

  /**
   * Garante chaves RC4 com INSERT OR IGNORE sem sobrescrever valores do usuário.
   * @returns {Promise<void>}
   */
  async ensureDefaults() {
    const sql = this._obterSql();
    await sql.whenReady();

    for (const [chave, valor, tipo, descricao] of DEFAULTS) {
      await sql.run(
        `INSERT OR IGNORE INTO ${CentralConfigRepository.TABELA}
          (chave, valor, tipo, descricao) VALUES (?, ?, ?, ?)`,
        [chave, valor, tipo, descricao]
      );
    }
  }

  /**
   * @returns {ReadonlyArray<[string, string, string, string]>}
   */
  static get DEFAULTS() {
    return DEFAULTS;
  }
}

module.exports = CentralConfiguracaoRepository;
