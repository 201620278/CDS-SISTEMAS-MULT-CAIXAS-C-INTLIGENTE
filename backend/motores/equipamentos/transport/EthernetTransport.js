/**
 * EthernetTransport — Transporte TCP/Ethernet com comunicação real (Sprint 8).
 *
 * Utiliza o módulo nativo `net` do Node.js.
 * Não implementa protocolo de fabricante — apenas conexão TCP reutilizável.
 *
 * @class EthernetTransport
 */

const net = require('net');
const BaseTransport = require('./BaseTransport');
const loggerService = require('../services/LoggerService');

const TIMEOUT_PADRAO = Number(process.env.EQUIPAMENTOS_ETHERNET_TIMEOUT_MS || 5000);
const MAX_RECONEXOES_PADRAO = Number(process.env.EQUIPAMENTOS_ETHERNET_MAX_RECONNECT || 3);
const INTERVALO_RECONEXAO_PADRAO = Number(process.env.EQUIPAMENTOS_ETHERNET_RECONNECT_MS || 2000);

class EthernetTransport extends BaseTransport {
  constructor(config = {}) {
    super(config);
    this._host = config.host || config.ip || '127.0.0.1';
    this._porta = Number(config.porta || config.port || 9100);
    this._timeout = config.timeout ?? TIMEOUT_PADRAO;
    this._maxReconexoes = config.tentativas ?? config.maxReconexoes ?? MAX_RECONEXOES_PADRAO;
    this._intervaloReconexao = config.intervaloReconexao ?? INTERVALO_RECONEXAO_PADRAO;
    this._tentativasReconexao = 0;
    /** @type {import('net').Socket|null} */
    this._socket = null;
    /** @type {Buffer[]} */
    this._bufferRecebimento = [];
    /** @type {Array<{resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
    this._aguardandoLeitura = [];
    this._conectadoEm = null;
    this._ultimoErro = null;
    this._reconectando = false;
  }

  tipo() {
    return 'ethernet';
  }

  // ─── Aliases em inglês (Sprint 8) ─────────────────────────────

  connect() { return this.conectar(); }
  disconnect() { return this.desconectar(); }
  isConnected() { return this.estaConectado() && !!this._socket && !this._socket.destroyed; }
  write(dados) { return this.enviar(dados); }
  read(opcoes) { return this.receber(opcoes); }
  reconnect() { return this.reconectar(); }
  timeout(ms) {
    if (ms != null) this._timeout = Number(ms);
    return this._timeout;
  }

  /**
   * @param {string} mensagem
   * @param {string} status
   * @param {Object} [detalhe]
   * @private
   */
  async _logConexao(mensagem, status, detalhe = {}) {
    await loggerService.logTransporte({
      transporte: 'ethernet',
      operacao: detalhe.operacao || 'conexao',
      equipamento_id: this.config.equipamento_id ?? null,
      host: this._host,
      porta: this._porta,
      status,
      mensagem,
      detalhe: { ...detalhe, mensagem }
    });
  }

  /**
   * @returns {Promise<import('net').Socket>}
   * @private
   */
  _abrirSocket() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this._host,
        port: this._porta
      });

      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Timeout de conexão'));
      }, this._timeout);

      const limpar = () => clearTimeout(timer);

      socket.once('connect', () => {
        limpar();
        socket.setTimeout(this._timeout);
        resolve(socket);
      });

      socket.once('error', (err) => {
        limpar();
        reject(err);
      });
    });
  }

  /**
   * @param {import('net').Socket} socket
   * @private
   */
  _vincularSocket(socket) {
    this._socket = socket;

    socket.on('data', (chunk) => {
      this._bufferRecebimento.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      this._entregarLeituraPendente();
    });

    socket.on('timeout', () => {
      this._ultimoErro = 'Timeout de socket';
      this._logConexao('Timeout', 'timeout', { operacao: 'timeout' }).catch(() => {});
    });

    socket.on('error', (err) => {
      this._ultimoErro = err.message;
      this._logConexao('Erro', 'erro', { operacao: 'erro', erro: err.message }).catch(() => {});
    });

    socket.on('close', () => {
      this._conectado = false;
      this._rejeitarLeiturasPendentes(new Error('Conexão encerrada'));
      this._logConexao('Desconectado', 'desconectado', { operacao: 'desconectar' }).catch(() => {});
    });
  }

  /**
   * @private
   */
  _entregarLeituraPendente() {
    if (!this._aguardandoLeitura.length || !this._bufferRecebimento.length) return;

    const dados = Buffer.concat(this._bufferRecebimento);
    this._bufferRecebimento = [];

    const waiter = this._aguardandoLeitura.shift();
    clearTimeout(waiter.timer);
    waiter.resolve(dados);
  }

  /**
   * @param {Error} erro
   * @private
   */
  _rejeitarLeiturasPendentes(erro) {
    while (this._aguardandoLeitura.length) {
      const waiter = this._aguardandoLeitura.shift();
      clearTimeout(waiter.timer);
      waiter.reject(erro);
    }
  }

  /**
   * @param {Object} [extras]
   * @returns {Object}
   * @private
   */
  _resposta(extras = {}) {
    return {
      sucesso: true,
      simulado: false,
      comunicacao_real: true,
      transporte: 'ethernet',
      host: this._host,
      porta: this._porta,
      conectado: this.isConnected(),
      timestamp: new Date().toISOString(),
      ...extras
    };
  }

  async conectar() {
    if (this.isConnected()) {
      return this._resposta({ metodo: 'conectar', mensagem: 'Já conectado' });
    }

    await this._logConexao('Conectando...', 'conectando', { operacao: 'conectar' });

    try {
      const socket = await this._abrirSocket();
      this._vincularSocket(socket);
      this._conectado = true;
      this._conectadoEm = Date.now();
      this._tentativasReconexao = 0;
      this._ultimoErro = null;

      await this._logConexao('Conectado', 'conectado', { operacao: 'conectar' });

      return this._resposta({
        metodo: 'conectar',
        mensagem: 'Conectado',
        conectado_em: new Date(this._conectadoEm).toISOString()
      });
    } catch (err) {
      this._ultimoErro = err.message;
      this._conectado = false;
      this._socket = null;

      const isTimeout = /timeout/i.test(err.message);
      await this._logConexao(
        isTimeout ? 'Timeout' : 'Erro',
        isTimeout ? 'timeout' : 'erro',
        { operacao: 'conectar', erro: err.message }
      );

      throw err;
    }
  }

  async desconectar() {
    await this._logConexao('Desconectando...', 'desconectando', { operacao: 'desconectar' });

    this._rejeitarLeiturasPendentes(new Error('Desconectado'));

    if (this._socket && !this._socket.destroyed) {
      this._socket.destroy();
    }

    this._socket = null;
    this._conectado = false;
    this._bufferRecebimento = [];

    await this._logConexao('Desconectado', 'desconectado', { operacao: 'desconectar' });

    return this._resposta({
      metodo: 'desconectar',
      mensagem: 'Desconectado',
      conectado: false
    });
  }

  async enviar(dados) {
    if (!this.isConnected()) {
      throw new Error('EthernetTransport: não conectado');
    }

    const payload = Buffer.isBuffer(dados) ? dados : Buffer.from(String(dados));

    return new Promise((resolve, reject) => {
      this._socket.write(payload, (err) => {
        if (err) {
          this._ultimoErro = err.message;
          reject(err);
          return;
        }
        loggerService.logTransporte({
          transporte: 'ethernet',
          operacao: 'enviar',
          equipamento_id: this.config.equipamento_id ?? null,
          status: 'ok',
          detalhe: { bytes: payload.length }
        }).catch(() => {});
        resolve(this._resposta({ metodo: 'enviar', bytes: payload.length }));
      });
    });
  }

  async receber(opcoes = {}) {
    if (!this.isConnected()) {
      throw new Error('EthernetTransport: não conectado');
    }

    const timeoutMs = opcoes.timeout ?? this._timeout;

    if (this._bufferRecebimento.length) {
      const dados = Buffer.concat(this._bufferRecebimento);
      this._bufferRecebimento = [];
      return this._resposta({ metodo: 'receber', dados, timeout: timeoutMs });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._aguardandoLeitura.findIndex((w) => w.timer === timer);
        if (idx >= 0) this._aguardandoLeitura.splice(idx, 1);
        this._ultimoErro = 'Timeout de leitura';
        this._logConexao('Timeout', 'timeout', { operacao: 'receber' }).catch(() => {});
        reject(new Error('Timeout de leitura'));
      }, timeoutMs);

      this._aguardandoLeitura.push({
        resolve: (dados) => {
          resolve(this._resposta({ metodo: 'receber', dados, timeout: timeoutMs }));
        },
        reject,
        timer
      });
    });
  }

  async ping() {
    if (!this.isConnected()) {
      return {
        sucesso: false,
        comunicacao_real: true,
        host: this._host,
        porta: this._porta,
        mensagem: 'Não conectado'
      };
    }

    const inicio = Date.now();
    const ok = this._socket.writable && !this._socket.destroyed;

    await loggerService.logTransporte({
      transporte: 'ethernet',
      operacao: 'ping',
      equipamento_id: this.config.equipamento_id ?? null,
      status: ok ? 'ok' : 'erro'
    }).catch(() => {});

    return this._resposta({
      metodo: 'ping',
      sucesso: ok,
      latencia_ms: Date.now() - inicio
    });
  }

  async status() {
    const tempoConexaoMs = this._conectadoEm ? Date.now() - this._conectadoEm : 0;

    return this._resposta({
      metodo: 'status',
      conectado: this.isConnected(),
      timeout: this._timeout,
      tentativas_reconexao: this._tentativasReconexao,
      max_reconexoes: this._maxReconexoes,
      intervalo_reconexao: this._intervaloReconexao,
      tempo_conexao_ms: tempoConexaoMs,
      ultimo_erro: this._ultimoErro,
      buffer_recebimento: this._bufferRecebimento.length
    });
  }

  async reiniciar() {
    await this.desconectar();
    this._bufferRecebimento = [];
    this._tentativasReconexao = 0;
    return this.conectar();
  }

  async configurar(novaConfig = {}) {
    if (novaConfig.host || novaConfig.ip) this._host = novaConfig.host || novaConfig.ip;
    if (novaConfig.porta || novaConfig.port) this._porta = Number(novaConfig.porta || novaConfig.port);
    if (novaConfig.timeout != null) this._timeout = Number(novaConfig.timeout);
    if (novaConfig.tentativas != null) this._maxReconexoes = Number(novaConfig.tentativas);
    if (novaConfig.maxReconexoes != null) this._maxReconexoes = Number(novaConfig.maxReconexoes);
    if (novaConfig.intervaloReconexao != null) {
      this._intervaloReconexao = Number(novaConfig.intervaloReconexao);
    }
    this.config = { ...this.config, ...novaConfig };

    await loggerService.logTransporte({
      transporte: 'ethernet',
      operacao: 'configurar',
      status: 'configurado',
      detalhe: { host: this._host, porta: this._porta, timeout: this._timeout }
    }).catch(() => {});

    return this._resposta({
      metodo: 'configurar',
      host: this._host,
      porta: this._porta,
      timeout: this._timeout,
      tentativas: this._maxReconexoes,
      intervaloReconexao: this._intervaloReconexao
    });
  }

  async reconectar() {
    if (this._reconectando) {
      return this._resposta({ metodo: 'reconectar', mensagem: 'Reconexão em andamento' });
    }

    if (this._tentativasReconexao >= this._maxReconexoes) {
      await this._logConexao('Limite de reconexões', 'limite_excedido', {
        operacao: 'reconectar',
        tentativas: this._tentativasReconexao
      });
      return {
        sucesso: false,
        comunicacao_real: true,
        metodo: 'reconectar',
        tentativas: this._tentativasReconexao,
        mensagem: 'Limite de tentativas de reconexão excedido'
      };
    }

    this._reconectando = true;
    this._tentativasReconexao += 1;

    await this._logConexao('Reconectando', 'reconectando', {
      operacao: 'reconectar',
      tentativa: this._tentativasReconexao
    });

    try {
      if (this._socket && !this._socket.destroyed) {
        this._socket.destroy();
      }
      this._socket = null;
      this._conectado = false;

      if (this._intervaloReconexao > 0) {
        await new Promise((r) => setTimeout(r, this._intervaloReconexao));
      }

      const resultado = await this.conectar();
      this._reconectando = false;
      return { ...resultado, metodo: 'reconectar', tentativa: this._tentativasReconexao };
    } catch (err) {
      this._reconectando = false;
      this._ultimoErro = err.message;
      throw err;
    }
  }

  obterUltimoErro() {
    return this._ultimoErro;
  }

  obterTempoConexaoMs() {
    return this._conectadoEm ? Date.now() - this._conectadoEm : 0;
  }
}

module.exports = EthernetTransport;
