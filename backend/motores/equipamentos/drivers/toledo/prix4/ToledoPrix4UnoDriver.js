/**
 * ToledoPrix4UnoDriver — Driver oficial Toledo Prix 4 Uno.
 *
 * Herda BaseDriver. Arquitetura completa sem comunicação real.
 * Firmware conhecido: 90AX | Comunicação prevista: Ethernet TCP
 *
 * @class ToledoPrix4UnoDriver
 */

const BaseDriver = require('../../BaseDriver');
const ToledoPrix4Protocol = require('./ToledoPrix4Protocol');
const ToledoPrix4Parser = require('./ToledoPrix4Parser');
const ToledoPrix4Validator = require('./ToledoPrix4Validator');
const ToledoPrix4Mapper = require('./ToledoPrix4Mapper');
const ToledoPrix4Discovery = require('./ToledoPrix4Discovery');
const ToledoPrix4Diagnostics = require('./ToledoPrix4Diagnostics');
const {
  FABRICANTE,
  MODELO,
  CODIGO_DRIVER,
  VERSAO_DRIVER,
  PROTOCOLOS,
  TRANSPORTES,
  FIRMWARE_CONHECIDO
} = require('./ToledoPrix4Constants');
const { ToledoPrix4ValidationError } = require('./ToledoPrix4Errors');
const connectionMonitor = require('../../../monitor/ConnectionMonitor');

class ToledoPrix4UnoDriver extends BaseDriver {
  constructor(config = {}) {
    super(config);
    this.modo = 'estrutura';
    this.protocol = new ToledoPrix4Protocol(config);
    this.parser = new ToledoPrix4Parser();
    this.validator = new ToledoPrix4Validator();
    this.mapper = new ToledoPrix4Mapper();
    this.discovery = new ToledoPrix4Discovery();
    this.diagnostics = new ToledoPrix4Diagnostics(this);
  }

  fabricante() { return FABRICANTE; }
  modelo() { return MODELO; }
  versao() { return VERSAO_DRIVER; }

  transportesSuportados() {
    return [...TRANSPORTES];
  }

  informacoes() {
    return {
      codigo: CODIGO_DRIVER,
      fabricante: this.fabricante(),
      modelo: this.modelo(),
      versao: this.versao(),
      firmware_conhecido: [...FIRMWARE_CONHECIDO],
      protocolos: [...PROTOCOLOS],
      transportes: this.transportesSuportados(),
      status: this.modo,
      suporta_comunicacao_real: true,
      comunicacao_real: this.protocol?.conectado === true
    };
  }

  /**
   * @param {string} metodo
   * @param {Object} protocolo
   * @param {Object} [extras]
   * @returns {Object}
   * @private
   */
  _resultadoProtocolo(metodo, protocolo, extras = {}) {
    return {
      sucesso: protocolo?.sucesso !== false,
      simulado: protocolo?.simulado !== false,
      comunicacao_real: protocolo?.comunicacao_real !== false,
      driver: this.informacoes(),
      metodo,
      protocolo,
      timestamp: new Date().toISOString(),
      ...extras
    };
  }

  /**
   * @param {string} metodo
   * @param {Object} [extras]
   * @returns {Object}
   * @private
   */
  _stub(metodo, extras = {}) {
    return {
      sucesso: true,
      simulado: true,
      comunicacao_real: false,
      driver: this.informacoes(),
      metodo,
      mensagem: `${metodo} simulado — fora do escopo Sprint 11A`,
      timestamp: new Date().toISOString(),
      ...extras
    };
  }

  /**
   * @param {Object} val
   * @param {string} contexto
   * @private
   */
  _garantirValido(val, contexto) {
    if (!val.valido) {
      throw new ToledoPrix4ValidationError(
        `Validação falhou: ${contexto}`,
        val.erros
      );
    }
  }

  async conectar() {
    const val = this.validator.validarConfiguracao(this.config);
    if (!val.valido) {
      throw new ToledoPrix4ValidationError('Configuração inválida', val.erros);
    }

    this.protocol.configurar(this.config);
    const resultado = await this.protocol.connect();
    this.modo = 'tcp';

    return {
      sucesso: true,
      simulado: false,
      comunicacao_real: true,
      driver: this.informacoes(),
      metodo: 'conectar',
      validacao: val,
      conexao: resultado,
      monitor: this.protocol.obterMonitor()
    };
  }

  async desconectar() {
    const resultado = await this.protocol.disconnect();
    this.modo = 'estrutura';

    return {
      sucesso: true,
      simulado: false,
      comunicacao_real: true,
      driver: this.informacoes(),
      metodo: 'desconectar',
      conexao: resultado,
      monitor: connectionMonitor.obterStatus(`${this.config.host || this.config.ip}:${this.config.porta || 9100}`)
    };
  }

  async configurar(cfg) {
    const config = cfg || this.config;
    const val = this.validator.validarConfiguracao(config);
    if (!val.valido) {
      throw new ToledoPrix4ValidationError('Configuração inválida', val.erros);
    }

    this.config = { ...this.config, ...config };
    const proto = this.protocol.configurar(this.config);

    return {
      sucesso: true,
      simulado: false,
      comunicacao_real: true,
      driver: this.informacoes(),
      metodo: 'configurar',
      validacao: val,
      protocolo: proto
    };
  }

  async status() {
    if (!this.protocol.conectado) {
      return this._resultadoProtocolo('status', {
        sucesso: false,
        online: false,
        mensagem: 'Não conectado'
      }, { online: false });
    }

    const proto = await this.protocol.status();
    return this._resultadoProtocolo('status', proto, {
      online: proto.online === true,
      monitor: this.protocol.obterMonitor()
    });
  }

  async diagnostico() {
    return this.diagnostics.executar();
  }

  async descobrir() {
    const candidatos = await this.discovery.descobrir(this.config);
    return this._stub('descobrir', { candidatos });
  }

  async sincronizarProduto(produto) {
    const val = this.validator.validarProduto(produto);
    this._garantirValido(val, 'produto');
    const toledo = this.mapper.mapProduto(produto);
    const proto = await this.protocol.enviarProduto(toledo);
    return this._resultadoProtocolo('sincronizarProduto', proto, {
      validacao: val,
      produto: toledo
    });
  }

  async sincronizarProdutos(produtos) {
    const lista = produtos || [];
    const mapeados = [];
    const erros = [];

    for (const item of lista) {
      try {
        const val = this.validator.validarProduto(item);
        if (!val.valido) {
          erros.push({ item, erros: val.erros });
          continue;
        }
        mapeados.push(this.mapper.mapProduto(item));
      } catch (error) {
        erros.push({ item, erros: [error.message] });
      }
    }

    const proto = mapeados.length > 0
      ? await this.protocol.enviarLote(mapeados)
      : null;

    return this._resultadoProtocolo('sincronizarProdutos', proto || { sucesso: erros.length === 0 }, {
      quantidade: lista.length,
      mapeados: mapeados.length,
      erros
    });
  }

  async sincronizarPromocao(promocao) {
    const val = this.validator.validarPromocao(promocao);
    this._garantirValido(val, 'promoção');
    const toledo = this.mapper.mapPromocao(promocao);
    const proto = await this.protocol.enviarPromocao(toledo);
    return this._resultadoProtocolo('sincronizarPromocao', proto, {
      validacao: val,
      promocao: toledo
    });
  }

  async sincronizarDepartamento(departamento) {
    const val = this.validator.validarDepartamento(departamento);
    this._garantirValido(val, 'departamento');
    const toledo = this.mapper.mapDepartamento(departamento);
    const proto = await this.protocol.enviarDepartamento(toledo);
    return this._resultadoProtocolo('sincronizarDepartamento', proto, {
      validacao: val,
      departamento: toledo
    });
  }

  async sincronizarEtiqueta(etiqueta) {
    const val = this.validator.validarEtiqueta(etiqueta);
    this._garantirValido(val, 'etiqueta');
    const toledo = this.mapper.mapEtiqueta(etiqueta);
    const proto = await this.protocol.enviarEtiqueta(toledo);
    return this._resultadoProtocolo('sincronizarEtiqueta', proto, {
      validacao: val,
      etiqueta: toledo
    });
  }

  async removerProduto(codigo) {
    const proto = await this.protocol.removerProduto(codigo);
    return this._resultadoProtocolo('removerProduto', proto, { codigo });
  }

  async obterPeso() {
    const proto = await this.protocol.receberPeso();
    const peso = proto.peso || this.parser.parsePeso(proto.parsed?.bruto);
    const val = this.validator.validarPeso(peso);
    return this._resultadoProtocolo('obterPeso', proto, { ...peso, validacao: val });
  }

  async zerar() {
    return this._stub('zerar');
  }

  async reiniciar() {
    return this._stub('reiniciar');
  }
}

module.exports = ToledoPrix4UnoDriver;
