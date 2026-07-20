/**
 * CDS Centro de Configurações — shell UX RC3.2
 * Somente interface: não altera regras fiscais, APIs nem persistência.
 * Depende de funções existentes em configuracoes.js / fiscal.js.
 */
(function (global) {
  'use strict';

  const CATEGORIAS = Object.freeze([
    { id: 'geral', icon: 'fa-sliders-h', label: 'Geral', keywords: 'implantação tipo erp sem fiscal multi-caixa' },
    { id: 'empresa', icon: 'fa-building', label: 'Empresa', keywords: 'cfop csosn origem cest padrão fiscal empresa' },
    { id: 'fiscal', icon: 'fa-file-invoice', label: 'Fiscal', keywords: 'ambiente produção homologação certificado csc uf sefaz urls qrcode nfc-e manifestação destinatário ciência 210210' },
    { id: 'plataforma', icon: 'fa-university', label: 'Plataforma Fiscal', keywords: 'registry resolver soap transport runtime fallback confidence enablement' },
    { id: 'central', icon: 'fa-inbox', label: 'Central Inteligente', keywords: 'central sync nsu scheduler timeout retries logs debug sefaz' },
    { id: 'equipamentos', icon: 'fa-cash-register', label: 'Equipamentos', keywords: 'tef pinpad equipamento' },
    { id: 'integracoes', icon: 'fa-plug', label: 'Integrações', keywords: 'pix tef pinpad automação bancária' },
    { id: 'seguranca', icon: 'fa-shield-alt', label: 'Segurança', keywords: 'confirmação fiscal tef manual certificado senha' },
    { id: 'performance', icon: 'fa-tachometer-alt', label: 'Performance', keywords: 'timeout retry sync performance' },
    { id: 'backup', icon: 'fa-database', label: 'Backup', keywords: 'backup restauração' },
    { id: 'aparencia', icon: 'fa-palette', label: 'Aparência', keywords: 'tema aparência pdv visual' },
    { id: 'avancado', icon: 'fa-cog', label: 'Avançado', keywords: 'rede ip porta cliente servidor local módulos vendas entrega' }
  ]);

  let estadoExecutivo = {
    empresa: '—',
    cnpj: '—',
    ambiente: null,
    certificado: null,
    central: null,
    versao: '1.0.3',
    usuario: '—',
    ultimaAlteracao: '—'
  };

  function escapeHtml(value) {
    if (typeof global.escapeHtml === 'function') return global.escapeHtml(String(value ?? ''));
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function badge(texto, tone) {
    return `<span class="cds-cfg-badge cds-cfg-badge--${tone || 'neutral'}">${escapeHtml(texto)}</span>`;
  }

  function obterUsuarioNome() {
    try {
      const u = typeof global.obterUsuarioLogado === 'function' ? global.obterUsuarioLogado() : {};
      return u?.nome || u?.username || u?.usuario || '—';
    } catch {
      return '—';
    }
  }

  function toneAmbiente(code) {
    return Number(code) === 1 ? 'warn' : 'info';
  }

  function labelAmbiente(code) {
    return Number(code) === 1 ? 'Produção' : 'Homologação';
  }

  function renderKpi(id, label, value, detail, tone) {
    return `
      <div class="cds-cfg-kpi" data-exec-kpi="${escapeHtml(id)}">
        <div class="cds-cfg-kpi__head">
          <p class="cds-cfg-kpi__label">${escapeHtml(label)}</p>
          <span class="cds-cfg-dot" data-tone="${escapeHtml(tone || 'neutral')}"></span>
        </div>
        <p class="cds-cfg-kpi__value">${value}</p>
        <p class="cds-cfg-kpi__detail">${detail || ''}</p>
      </div>`;
  }

  function renderPainelExecutivo() {
    const e = estadoExecutivo;
    const amb = e.ambiente;
    const cert = e.certificado || {};
    const cen = e.central || {};
    const ambCode = amb != null ? Number(amb) : null;
    const certTone = cert.status === 'OK' ? 'ok' : (cert.status === 'A_VENCER' ? 'warn' : (cert.presente ? 'error' : 'neutral'));
    const certLabel = cert.status === 'OK' ? 'Válido' : (cert.status || (cert.presente ? 'Atenção' : 'Ausente'));
    const sefazOnline = cen.diagnostico?.ultimoErro ? 'warn' : 'ok';
    const syncLabel = cen.sincronizacao?.syncAutomaticaHabilitada ? 'Scheduler ativo' : 'Scheduler off';

    return `
      <div class="cds-cfg-exec" id="cdsCfgExecPanel" aria-label="Painel executivo da plataforma">
        ${renderKpi('empresa', 'Empresa', escapeHtml(e.empresa || '—'), `CNPJ ${escapeHtml(e.cnpj || '—')}`, e.cnpj && e.cnpj !== '—' ? 'ok' : 'warn')}
        ${renderKpi('ambiente', 'Ambiente Fiscal', ambCode != null ? escapeHtml(labelAmbiente(ambCode)) : '—', 'Origem: Centro de Configurações', toneAmbiente(ambCode))}
        ${renderKpi('sefaz', 'SEFAZ', badge(cen.ambiente?.label || '—', sefazOnline === 'ok' ? 'ok' : 'warn'), 'Visão via Central / DF-e', sefazOnline)}
        ${renderKpi('cert', 'Certificado Digital', badge(certLabel, certTone), cert.validade ? `Validade: ${escapeHtml(String(cert.validade).slice(0, 10))} · ${cert.diasRestantes != null ? cert.diasRestantes + ' dias' : ''}` : (cert.mensagem || 'Configure na aba Fiscal'), certTone)}
        ${renderKpi('miip', 'MIIP', badge(cen.diagnostico?.versaoMiip || 'RC1', 'info'), 'Health via pipeline Central', 'ok')}
        ${renderKpi('plataforma', 'Plataforma Fiscal', badge('RC1.1', 'prep'), 'Registry · Resolver · SoapTransport', 'ok')}
        ${renderKpi('central', 'Central Inteligente', badge(syncLabel, cen.sincronizacao?.syncAutomaticaHabilitada ? 'ok' : 'neutral'), cen.diagnostico?.ultimaSincronizacao ? `Última sync: ${escapeHtml(String(cen.diagnostico.ultimaSincronizacao).slice(0, 19).replace('T', ' '))}` : 'Consome config fiscal oficial', 'ok')}
        ${renderKpi('servicos', 'Serviços', badge('Operacional', 'ok'), 'Parser · Motor Fiscal · Financeiro · Equipamentos', 'ok')}
      </div>`;
  }

  function renderNav(ativa) {
    return CATEGORIAS.map((c) => `
      <button type="button" class="cds-cfg-nav__item${c.id === ativa ? ' is-active' : ''}"
        data-cfg-nav="${c.id}" data-cfg-keywords="${escapeHtml(c.keywords)} ${escapeHtml(c.label)}">
        <i class="fas ${c.icon}"></i><span>${escapeHtml(c.label)}</span>
      </button>`).join('');
  }

  function card(title, body, search, extraClass) {
    return `
      <div class="cds-cfg-card${extraClass ? ' ' + extraClass : ''}" data-cfg-search="${escapeHtml(search || title)}">
        <div class="cds-cfg-card__title">${title}</div>
        ${body}
      </div>`;
  }

  function renderPanes(config) {
    const tipo = String(config.tipoImplantacao || 'ERP_SEM_FISCAL').toUpperCase();
    const modo = String(config.modoOperacao || 'LOCAL').toUpperCase();
    const modoConfirmacaoFiscal = String(config.modo_confirmacao_fiscal || 'TEF').toUpperCase();
    const ipServidor = config.ipServidor || '';
    const porta = Number(config.porta) > 0 ? Number(config.porta) : 3001;
    const clienteServidorDisponivel = tipo === 'ERP_MULTICAIXA';
    const vendasEntregaOn = config.habilitar_vendas_entrega === true
      || (config.recursos && config.recursos.vendasEntrega === true);

    return `
      <div class="cds-cfg-pane is-active" data-cfg-pane="geral">
        <h2 class="cds-cfg-pane__title">Geral</h2>
        <p class="cds-cfg-pane__sub">Tipo de implantação da plataforma.</p>
        ${card('<i class="fas fa-layer-group"></i> Tipo de Implantação', `
          <div class="form-check mb-2" data-cfg-search="erp sem fiscal">
            <input class="form-check-input" type="radio" name="tipoImplantacao" id="tipoSemFiscal" value="ERP_SEM_FISCAL" ${tipo === 'ERP_SEM_FISCAL' ? 'checked' : ''}>
            <label class="form-check-label" for="tipoSemFiscal">ERP Sem Fiscal</label>
          </div>
          <div class="form-check mb-2" data-cfg-search="erp fiscal">
            <input class="form-check-input" type="radio" name="tipoImplantacao" id="tipoFiscal" value="ERP_FISCAL" ${tipo === 'ERP_FISCAL' ? 'checked' : ''}>
            <label class="form-check-label" for="tipoFiscal">ERP Fiscal</label>
          </div>
          <div class="form-check" data-cfg-search="multi-caixa multicaixa">
            <input class="form-check-input" type="radio" name="tipoImplantacao" id="tipoMulticaixa" value="ERP_MULTICAIXA" ${tipo === 'ERP_MULTICAIXA' ? 'checked' : ''}>
            <label class="form-check-label" for="tipoMulticaixa">ERP Multi-Caixa</label>
          </div>
        `, 'implantação tipo erp')}
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="empresa">
        <h2 class="cds-cfg-pane__title">Empresa</h2>
        <p class="cds-cfg-pane__sub">Padrões contábeis da empresa. Dados cadastrais fiscais ficam na aba Fiscal (fonte oficial).</p>
        <div class="cds-cfg-note">Razão social, CNPJ, IE e endereço são editados na categoria <strong>Fiscal</strong> (única fonte oficial).</div>
        <div id="secaoPadraoFiscalEmpresa">
          ${card('<i class="fas fa-file-invoice"></i> Padrão Fiscal da Empresa', `
            <p class="cds-cfg-hint mb-3">Valores padrão para novos produtos. Não altera produtos já cadastrados.</p>
            <div class="row g-3">
              <div class="col-md-3" data-cfg-search="cfop">
                <label for="padraoCfop" class="cds-cfg-label">CFOP</label>
                <input type="text" class="form-control" id="padraoCfop" value="${escapeHtml(config.cfop_padrao || '')}" placeholder="Ex.: 5405">
              </div>
              <div class="col-md-3" data-cfg-search="csosn">
                <label for="padraoCsosn" class="cds-cfg-label">CSOSN</label>
                <input type="text" class="form-control" id="padraoCsosn" value="${escapeHtml(config.csosn_padrao || '')}" placeholder="Ex.: 500">
              </div>
              <div class="col-md-3" data-cfg-search="origem">
                <label for="padraoOrigem" class="cds-cfg-label">Origem</label>
                <input type="text" class="form-control" id="padraoOrigem" value="${escapeHtml(config.origem_padrao || '')}" placeholder="Ex.: 0">
              </div>
              <div class="col-md-3" data-cfg-search="cest">
                <label for="padraoCest" class="cds-cfg-label">CEST</label>
                <input type="text" class="form-control" id="padraoCest" value="${escapeHtml(config.cest_padrao || '')}" placeholder="Ex.: 0300100">
              </div>
            </div>
            <div class="cds-cfg-actions">
              <button type="button" class="btn btn-success btn-sm" onclick="salvarPadraoFiscalEmpresa()">
                <i class="fas fa-save"></i> Salvar padrão
              </button>
            </div>
          `, 'cfop csosn origem cest padrão fiscal')}
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="fiscal">
        <h2 class="cds-cfg-pane__title">Fiscal</h2>
        <p class="cds-cfg-pane__sub">Única fonte oficial de Ambiente, UF, certificado, CSC, URLs SEFAZ e Manifestação do Destinatário.</p>
        <div class="cds-cfg-note">
          ${badge('Fonte oficial RC3.1 / RC4.3', 'ok')}
          <span class="ms-2">Central Inteligente, emissão e DF-e consomem esta configuração.</span>
        </div>
        <div id="secaoConfigFiscalAvancadas">
          <p class="text-muted small" id="msgConfigFiscalIndisponivel" style="display:none;">
            Selecione ERP Fiscal ou ERP Multi-Caixa na categoria Geral para configurar os parâmetros fiscais.
          </p>
          <div id="fiscal-config-form-area-avancadas" class="cds-cfg-fiscal-grid" data-cfg-search="ambiente certificado csc produção homologação">
            <div class="text-center py-4 text-muted">
              <i class="fas fa-spinner fa-spin me-2"></i> Carregando configuração fiscal...
            </div>
          </div>
        </div>
        <div class="mt-3" id="cdsCfgSecaoManifestacao">
          <div class="cds-cfg-card cds-cfg-card--manifestacao" id="cdsCfgCardManifestacao"
               data-cfg-search="manifestação destinatário ciência 210210 automática manual confirmação">
            <div class="cds-cfg-card__title"><i class="fas fa-file-signature"></i> Manifestação do Destinatário</div>
            <p class="cds-cfg-hint mb-3">
              Define como a Central Inteligente enviará o evento Ciência da Emissão (210210) durante o ciclo DF-e.
              Esta configuração afeta apenas futuras sincronizações.
            </p>
            <p class="cds-cfg-label mb-2">Modo da Manifestação</p>
            <div class="form-check mb-2" data-cfg-search="manifestação manual">
              <input class="form-check-input" type="radio" name="cdsPoliticaManifestacao" id="cdsManifManual" value="MANUAL">
              <label class="form-check-label" for="cdsManifManual">Manual</label>
            </div>
            <div class="form-check mb-2" data-cfg-search="manifestação automática ciência">
              <input class="form-check-input" type="radio" name="cdsPoliticaManifestacao" id="cdsManifAuto" value="AUTOMATICA_CIENCIA">
              <label class="form-check-label" for="cdsManifAuto">Automática (Ciência da Emissão)</label>
            </div>
            <div class="form-check mb-3" data-cfg-search="manifestação confirmação operador">
              <input class="form-check-input" type="radio" name="cdsPoliticaManifestacao" id="cdsManifConfirmar" value="CONFIRMAR_OPERADOR">
              <label class="form-check-label" for="cdsManifConfirmar">Solicitar confirmação do operador</label>
            </div>
            <div class="cds-cfg-note mb-3">
              Persistência oficial: <code>central_entradas_config</code> → <code>manifestacao_destinatario_politica</code>
              · API <code>PUT /api/central-entradas/configuracao</code>
            </div>
            <div class="cds-cfg-actions">
              <button type="button" class="btn btn-success btn-sm" id="btnSalvarPoliticaManifestacao">
                <i class="fas fa-save"></i> Salvar política
              </button>
              <span id="cdsManifSaveFeedback" class="cds-cfg-hint ms-2"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="plataforma">
        <h2 class="cds-cfg-pane__title">Plataforma Fiscal</h2>
        <p class="cds-cfg-pane__sub">Visão somente leitura da plataforma (Registry, Resolver, Transport).</p>
        <div class="row g-3">
          <div class="col-md-6">${card('Registry', `<div class="cds-cfg-kpi__value">Ativo</div><p class="cds-cfg-hint mb-0">Catálogo de endpoints SEFAZ por modelo/operação/ambiente.</p>`, 'registry')}</div>
          <div class="col-md-6">${card('UrlResolver', `<div class="cds-cfg-kpi__value">Ativo</div><p class="cds-cfg-hint mb-0">Resolve URL a partir do contexto (recebe ambiente por parâmetro).</p>`, 'resolver')}</div>
          <div class="col-md-6">${card('SoapTransport', `<div class="cds-cfg-kpi__value">Ativo</div><p class="cds-cfg-hint mb-0">Transporte SOAP oficial. Sem edição nesta tela.</p>`, 'soap transport')}</div>
          <div class="col-md-6">${card('Enablement / Health', `${badge('RC1.1', 'prep')} ${badge('Somente leitura', 'neutral')}<p class="cds-cfg-hint mt-2 mb-0">Fallback e Confidence Score são internos da plataforma — não editáveis.</p>`, 'fallback confidence enablement health')}</div>
        </div>
        <div class="cds-cfg-note">Ambiente SEFAZ utilizado pela plataforma: o mesmo de <strong>Fiscal</strong> (getFiscalConfig).</div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="central">
        <h2 class="cds-cfg-pane__title">Central Inteligente</h2>
        <p class="cds-cfg-pane__sub">Consome a configuração fiscal oficial. Operação (sync/timeouts) permanece na Central.</p>
        <div class="cds-cfg-note">
          Ambiente, UF, certificado, CSC e política de Manifestação são <strong>somente leitura</strong> na Central.
          Origem: Centro de Configurações → Fiscal (RC4.3).
        </div>
        <div class="row g-3" id="cdsCfgCentralReadonly">
          <div class="col-md-6">${card('Ambiente (somente leitura)', `<div id="cdsCfgCentralAmbiente">—</div>`, 'ambiente produção homologação')}</div>
          <div class="col-md-6">${card('UF emitente (somente leitura)', `<div id="cdsCfgCentralUf">—</div>`, 'uf')}</div>
          <div class="col-md-6">${card('Certificado (visão)', `<div id="cdsCfgCentralCert">—</div>`, 'certificado')}</div>
          <div class="col-md-6">${card('Sincronização / Scheduler', `<div id="cdsCfgCentralSync">—</div>`, 'scheduler sync nsu timeout')}</div>
        </div>
        <div class="cds-cfg-actions">
          <button type="button" class="btn btn-primary btn-sm" id="btnAbrirConfigFiscalOficial">
            <i class="fas fa-file-invoice"></i> Abrir Configuração Fiscal
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick="typeof loadPage==='function'&&loadPage('central-entradas')">
            <i class="fas fa-inbox"></i> Abrir Central Inteligente
          </button>
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="equipamentos">
        <h2 class="cds-cfg-pane__title">Equipamentos</h2>
        <p class="cds-cfg-pane__sub">Atalhos para módulos de equipamentos (sem alterar regras).</p>
        ${card('<i class="fas fa-credit-card"></i> TEF e PinPad', `
          <p class="cds-cfg-hint">Configuração de adquirentes, APIs e PinPads.</p>
          <button type="button" class="btn btn-primary btn-sm" id="btnConfiguracaoTEF">
            <i class="fas fa-credit-card"></i> Abrir configuração TEF
          </button>
        `, 'tef pinpad equipamento')}
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="integracoes">
        <h2 class="cds-cfg-pane__title">Integrações</h2>
        <p class="cds-cfg-pane__sub">Pix automático e TEF.</p>
        ${card('<i class="fas fa-qrcode"></i> Pix Automático', `
          <div class="form-check form-switch mb-3" data-cfg-search="pix automático">
            <input class="form-check-input" type="checkbox" id="togglePixAutomatico" onchange="alterarPixAutomatico()">
            <label class="form-check-label fw-bold" for="togglePixAutomatico">Ativar automação bancária Pix</label>
          </div>
          <p class="cds-cfg-hint">Quando ativado, o sistema gera QR Code Pix automático e confirma o pagamento.</p>
          <div id="containerBotaoPixAutomatico" style="display:none;">
            <button type="button" class="btn btn-success btn-sm" onclick="abrirModalPixAutomatico()">
              <i class="fas fa-qrcode"></i> Configurar Pix Automático
            </button>
          </div>
        `, 'pix')}
        ${card('<i class="fas fa-credit-card"></i> TEF', `
          <button type="button" class="btn btn-outline-primary btn-sm" id="btnConfiguracaoTEFIntegracoes">
            <i class="fas fa-credit-card"></i> Abrir TEF
          </button>
        `, 'tef')}
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="seguranca">
        <h2 class="cds-cfg-pane__title">Segurança</h2>
        <p class="cds-cfg-pane__sub">Confirmação fiscal no PDV. Certificado digital na aba Fiscal.</p>
        ${card('Confirmação Fiscal', `
          <p class="cds-cfg-hint mb-2">Define como o PDV confirma o recebimento fiscal antes da NFC-e.</p>
          <div class="form-check" data-cfg-search="confirmação tef">
            <input class="form-check-input" type="radio" name="modoConfirmacaoFiscal" id="confirmacaoFiscalTef" value="TEF" ${modoConfirmacaoFiscal === 'TEF' ? 'checked' : ''}>
            <label class="form-check-label" for="confirmacaoFiscalTef">TEF</label>
          </div>
          <div class="form-check" data-cfg-search="confirmação manual">
            <input class="form-check-input" type="radio" name="modoConfirmacaoFiscal" id="confirmacaoFiscalManual" value="MANUAL" ${modoConfirmacaoFiscal === 'MANUAL' ? 'checked' : ''}>
            <label class="form-check-label" for="confirmacaoFiscalManual">Manual</label>
          </div>
        `, 'confirmação fiscal segurança')}
        <div class="cds-cfg-note">Certificado A1 e senha: edite em <strong>Fiscal</strong> (fonte oficial).</div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="performance">
        <h2 class="cds-cfg-pane__title">Performance</h2>
        <p class="cds-cfg-pane__sub">Visão dos timeouts operacionais (editáveis na Central Inteligente).</p>
        <div id="cdsCfgPerformanceCards">
          ${card('Timeouts / Retries', `<div id="cdsCfgPerfTimeouts" class="text-muted">Carregando…</div>`, 'timeout retry performance')}
        </div>
        <div class="cds-cfg-actions">
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick="typeof loadPage==='function'&&loadPage('central-entradas')">
            Ajustar na Central Inteligente
          </button>
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="backup">
        <h2 class="cds-cfg-pane__title">Backup</h2>
        <p class="cds-cfg-pane__sub">Organização visual — rotinas existentes permanecem nos módulos atuais.</p>
        <div class="cds-cfg-empty" data-cfg-search="backup">
          <div><i class="fas fa-database"></i></div>
          <div>Use o menu <strong>Configurações</strong> do ERP para rotinas de backup já existentes.</div>
          <button type="button" class="btn btn-outline-primary btn-sm mt-3" onclick="typeof loadPage==='function'&&loadPage('configuracoes')">
            Abrir Configurações
          </button>
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="aparencia">
        <h2 class="cds-cfg-pane__title">Aparência</h2>
        <p class="cds-cfg-pane__sub">Preferências visuais do PDV (quando disponíveis).</p>
        <div class="cds-cfg-empty" data-cfg-search="aparência tema">
          <div><i class="fas fa-palette"></i></div>
          <div>Temas e aparência do PDV são gerenciados na interface do PDV.</div>
        </div>
      </div>

      <div class="cds-cfg-pane" data-cfg-pane="avancado">
        <h2 class="cds-cfg-pane__title">Avançado</h2>
        <p class="cds-cfg-pane__sub">Rede e operação multi-estação.</p>
        <div id="bannerEstacaoClienteRemoto"></div>
        ${card('Modo de Operação', `
          <div class="form-check mb-2" data-cfg-search="banco local">
            <input class="form-check-input" type="radio" name="modoOperacao" id="modoLocal" value="LOCAL" ${modo === 'LOCAL' ? 'checked' : ''}>
            <label class="form-check-label" for="modoLocal">Banco Local</label>
          </div>
          <div class="form-check mb-2" data-cfg-search="cliente servidor">
            <input class="form-check-input" type="radio" name="modoOperacao" id="modoClienteServidor" value="CLIENTE_SERVIDOR" ${modo === 'CLIENTE_SERVIDOR' ? 'checked' : ''} ${clienteServidorDisponivel ? '' : 'disabled'}>
            <label class="form-check-label ${clienteServidorDisponivel ? '' : 'text-muted'}" for="modoClienteServidor">Cliente/Servidor</label>
          </div>
          <small class="cds-cfg-hint">Cliente/Servidor disponível apenas para ERP Multi-Caixa.</small>
          <div id="containerIpServidor" class="mt-3 mb-2">
            <label for="cfgIpServidor" class="cds-cfg-label">IP do Servidor</label>
            <input type="text" class="form-control" id="cfgIpServidor" value="${escapeHtml(ipServidor)}" placeholder="Ex.: 192.168.0.100" data-cfg-search="ip servidor">
          </div>
          <div class="mb-2" data-cfg-search="porta">
            <label for="cfgPorta" class="cds-cfg-label">Porta</label>
            <input type="number" class="form-control" id="cfgPorta" value="${escapeHtml(String(porta))}" min="1" max="65535">
          </div>
          <div id="containerVoltarServidorLocal" class="alert alert-warning mb-0 mt-3" style="display:none;">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <strong id="tituloModoRedeEstacaoInline">Estação em modo cliente</strong>
                <div class="small mb-0">
                  <span id="descricaoModoRedeEstacaoInline">Use o botão para voltar ao backend local deste computador.</span>
                  <span class="d-block mt-1">Servidor remoto: <span id="lblServidorRemotoEstacao">-</span></span>
                </div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btnVoltarServidorLocal" onclick="voltarServidorLocalEstacao()" disabled>
                <i class="fas fa-home"></i> Voltar ao servidor local
              </button>
            </div>
          </div>
          <div class="cds-cfg-actions">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnConfiguracaoRede">
              <i class="fas fa-network-wired"></i> Painel de Rede
            </button>
          </div>
        `, 'rede ip porta cliente servidor')}
        ${card('<i class="fas fa-puzzle-piece"></i> Módulos', `
          <p class="cds-cfg-hint mb-3">Módulos opcionais. Desabilitados por padrão — sem impacto no PDV até ativação.</p>
          <div class="form-check" data-cfg-search="vendas para entrega módulo opcional">
            <input class="form-check-input" type="checkbox" id="cfgHabilitarVendasEntrega" ${vendasEntregaOn ? 'checked' : ''}>
            <label class="form-check-label" for="cfgHabilitarVendasEntrega">Habilitar Vendas para Entrega</label>
          </div>
          <div class="mt-3 ${vendasEntregaOn ? '' : 'opacity-50'}" id="cfgEntregaImpressaoBox">
            <div class="fw-semibold mb-2">Impressão automática (Entrega)</div>
            <div class="form-check"><input class="form-check-input" type="checkbox" id="cfgImpComprovanteEntrega" ${config.imprimir_comprovante_entrega !== false ? 'checked' : ''}><label class="form-check-label" for="cfgImpComprovanteEntrega">Comprovante de Entrega</label></div>
            <div class="form-check"><input class="form-check-input" type="checkbox" id="cfgImpComprovantePrestacao" ${config.imprimir_comprovante_prestacao !== false ? 'checked' : ''}><label class="form-check-label" for="cfgImpComprovantePrestacao">Comprovante de Prestação</label></div>
            <div class="form-check"><input class="form-check-input" type="checkbox" id="cfgImpDanfeEntrega" ${config.imprimir_danfe_nfce_entrega !== false ? 'checked' : ''}><label class="form-check-label" for="cfgImpDanfeEntrega">DANFE NFC-e</label></div>
            <div class="form-check"><input class="form-check-input" type="checkbox" id="cfgImpCupomNaoFiscalEntrega" ${config.imprimir_cupom_nao_fiscal_entrega === true ? 'checked' : ''}><label class="form-check-label" for="cfgImpCupomNaoFiscalEntrega">Cupom Não Fiscal</label></div>
            <div class="row g-2 mt-2">
              <div class="col-4"><label class="form-label small">Alerta aguardando (h)</label><input type="number" min="1" class="form-control form-control-sm" id="cfgAlertaAguardando" value="${Number(config.entrega_alerta_horas_aguardando || 2)}"></div>
              <div class="col-4"><label class="form-label small">Alerta reserva (h)</label><input type="number" min="1" class="form-control form-control-sm" id="cfgAlertaReserva" value="${Number(config.entrega_alerta_horas_reserva || 4)}"></div>
              <div class="col-4"><label class="form-label small">Alerta parado (h)</label><input type="number" min="1" class="form-control form-control-sm" id="cfgAlertaParado" value="${Number(config.entrega_alerta_horas_parado || 3)}"></div>
            </div>
          </div>
          <small class="cds-cfg-hint d-block mt-2">Quando desabilitado, rotinas e widgets do módulo não são carregados.</small>
        `, 'módulos vendas entrega impressão alertas')}
      </div>
    `;
  }

  function hidratarPoliticaManifestacaoUi(politica) {
    const valor = ['MANUAL', 'AUTOMATICA_CIENCIA', 'CONFIRMAR_OPERADOR'].includes(politica)
      ? politica
      : 'MANUAL';
    document.querySelectorAll('input[name="cdsPoliticaManifestacao"]').forEach((el) => {
      el.checked = el.value === valor;
    });
  }

  async function salvarPoliticaManifestacaoCentro() {
    const selecionado = document.querySelector('input[name="cdsPoliticaManifestacao"]:checked');
    const politica = selecionado?.value || 'MANUAL';
    const feedback = document.getElementById('cdsManifSaveFeedback');
    if (feedback) feedback.textContent = 'Salvando…';

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${global.API_URL}/central-entradas/configuracao`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sefaz: { politicaManifestacao: politica } })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      hidratarPoliticaManifestacaoUi(data.sefaz?.politicaManifestacao || politica);
      if (feedback) feedback.textContent = '✔ Política salva';
      if (typeof global.showNotification === 'function') {
        global.showNotification('Política de Manifestação atualizada.', 'success');
      }
      await atualizarPainelExecutivo();
    } catch (err) {
      if (feedback) feedback.textContent = '';
      if (typeof global.showNotification === 'function') {
        global.showNotification(err.message || 'Falha ao salvar política', 'danger');
      }
    }
  }

  function focarCardManifestacao() {
    ativarCategoria('fiscal');
    const tentar = (tentativa) => {
      const el = document.getElementById('cdsCfgCardManifestacao');
      if (el) {
        el.classList.add('is-highlight');
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ }
        setTimeout(() => el.classList.remove('is-highlight'), 4000);
        return;
      }
      if (tentativa < 12) setTimeout(() => tentar(tentativa + 1), 250);
    };
    setTimeout(() => tentar(0), 200);
  }

  function ativarCategoria(id) {
    const cat = CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[0];
    document.querySelectorAll('[data-cfg-nav]').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-cfg-nav') === cat.id);
    });
    document.querySelectorAll('[data-cfg-pane]').forEach((el) => {
      el.classList.toggle('is-active', el.getAttribute('data-cfg-pane') === cat.id);
    });
    try {
      sessionStorage.setItem('cds_cfg_tab', cat.id);
    } catch { /* ignore */ }
  }

  function pesquisarConfiguracao(termo) {
    const q = String(termo || '').trim().toLowerCase();
    document.querySelectorAll('.cds-cfg-card.is-highlight, .cds-cfg-field-hit').forEach((el) => {
      el.classList.remove('is-highlight', 'cds-cfg-field-hit');
    });
    document.querySelectorAll('[data-cfg-nav]').forEach((el) => el.classList.remove('is-match'));

    if (!q) return;

    let destino = null;
    for (const cat of CATEGORIAS) {
      const blob = `${cat.label} ${cat.keywords}`.toLowerCase();
      if (blob.includes(q)) {
        destino = cat.id;
        break;
      }
    }

    if (!destino) {
      const hit = document.querySelector(`[data-cfg-search*="${CSS.escape ? '' : ''}"]`);
      void hit;
      document.querySelectorAll('[data-cfg-search]').forEach((el) => {
        const keys = (el.getAttribute('data-cfg-search') || '').toLowerCase();
        if (!destino && keys.includes(q)) {
          const pane = el.closest('[data-cfg-pane]');
          if (pane) destino = pane.getAttribute('data-cfg-pane');
        }
      });
    }

    if (destino) {
      ativarCategoria(destino);
      const nav = document.querySelector(`[data-cfg-nav="${destino}"]`);
      if (nav) nav.classList.add('is-match');
    }

    document.querySelectorAll('[data-cfg-search]').forEach((el) => {
      const keys = (el.getAttribute('data-cfg-search') || '').toLowerCase();
      if (keys.includes(q)) {
        el.classList.add('is-highlight', 'cds-cfg-field-hit');
        if (destino && el.closest(`[data-cfg-pane="${destino}"]`)) {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* ignore */ }
        }
      }
    });
  }

  async function atualizarPainelExecutivo() {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    estadoExecutivo.usuario = obterUsuarioNome();

    try {
      const fiscalRes = await fetch(`${global.API_URL}/fiscal/config`, { headers });
      if (fiscalRes.ok) {
        const cfg = await fiscalRes.json();
        estadoExecutivo.empresa = cfg.nomeEmpresa || '—';
        estadoExecutivo.cnpj = cfg.cnpj || '—';
        estadoExecutivo.ambiente = cfg.ambiente;
      }
    } catch { /* ignore */ }

    try {
      const cenRes = await fetch(`${global.API_URL}/central-entradas/configuracao`, { headers });
      if (cenRes.ok) {
        const painel = await cenRes.json();
        estadoExecutivo.central = painel;
        estadoExecutivo.certificado = painel.certificado || null;
        if (painel.ambiente?.codigo != null) {
          estadoExecutivo.ambiente = painel.ambiente.codigo;
        }
        estadoExecutivo.ultimaAlteracao = painel.ambiente?.atualizadoEm
          || painel.diagnostico?.ultimaSincronizacao
          || estadoExecutivo.ultimaAlteracao;

        const ambEl = document.getElementById('cdsCfgCentralAmbiente');
        const ufEl = document.getElementById('cdsCfgCentralUf');
        const certEl = document.getElementById('cdsCfgCentralCert');
        const syncEl = document.getElementById('cdsCfgCentralSync');
        const perfEl = document.getElementById('cdsCfgPerfTimeouts');

        if (ambEl) {
          ambEl.innerHTML = `${badge(painel.ambiente?.label || '—', toneAmbiente(painel.ambiente?.codigo))}
            <div class="cds-cfg-hint mt-1">${escapeHtml(painel.ambiente?.origemLabel || 'Centro de Configurações')}</div>`;
        }
        if (ufEl) {
          ufEl.innerHTML = `<strong>${escapeHtml(painel.ambiente?.uf || '—')}</strong>
            <span class="cds-cfg-hint">Código ${escapeHtml(painel.ambiente?.codigoUf || '—')}</span>`;
        }
        if (certEl) {
          const c = painel.certificado || {};
          certEl.innerHTML = `${badge(c.status || 'AUSENTE', c.status === 'OK' ? 'ok' : 'warn')}
            <div class="cds-cfg-hint mt-1">${escapeHtml(c.mensagem || '')}</div>`;
        }
        if (syncEl) {
          const s = painel.sincronizacao || {};
          syncEl.innerHTML = `${badge(s.syncAutomaticaHabilitada ? 'Automática' : 'Manual', s.syncAutomaticaHabilitada ? 'ok' : 'neutral')}
            <div class="cds-cfg-hint mt-1">Intervalo: ${escapeHtml(String(s.syncIntervaloMinutos ?? '—'))} min · Max docs: ${escapeHtml(String(s.syncMaxDocumentos ?? '—'))}</div>`;
        }
        if (perfEl) {
          const sf = painel.sefaz || {};
          perfEl.innerHTML = `<div><strong>Timeout</strong>: ${escapeHtml(String(sf.timeoutMs ?? '—'))} ms</div>
            <div><strong>Max tentativas</strong>: ${escapeHtml(String(sf.maxTentativas ?? '—'))}</div>
            <div class="cds-cfg-hint">Edição em Central Inteligente → Configuração Enterprise</div>`;
        }

        hidratarPoliticaManifestacaoUi(painel.sefaz?.politicaManifestacao || 'MANUAL');
      }
    } catch { /* ignore */ }

    const panel = document.getElementById('cdsCfgExecPanel');
    const wrap = document.getElementById('cdsCfgExecWrap');
    if (wrap) wrap.innerHTML = renderPainelExecutivo();

    const metaEmpresa = document.getElementById('cdsCfgMetaEmpresa');
    const metaUser = document.getElementById('cdsCfgMetaUsuario');
    const metaAlt = document.getElementById('cdsCfgMetaAlteracao');
    if (metaEmpresa) metaEmpresa.textContent = estadoExecutivo.empresa || '—';
    if (metaUser) metaUser.textContent = estadoExecutivo.usuario || '—';
    if (metaAlt) {
      const raw = estadoExecutivo.ultimaAlteracao;
      metaAlt.textContent = raw && raw !== '—'
        ? String(raw).slice(0, 19).replace('T', ' ')
        : '—';
    }

    void panel;
  }

  function wireShell() {
    document.querySelectorAll('[data-cfg-nav]').forEach((btn) => {
      btn.addEventListener('click', () => ativarCategoria(btn.getAttribute('data-cfg-nav')));
    });

    const search = document.getElementById('cdsCfgSearch');
    if (search) {
      let timer = null;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => pesquisarConfiguracao(search.value), 180);
      });
    }

    document.getElementById('btnAbrirConfigFiscalOficial')?.addEventListener('click', () => {
      ativarCategoria('fiscal');
      const area = document.getElementById('fiscal-config-form-area-avancadas');
      try { area?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* ignore */ }
    });

    document.getElementById('btnSalvarPoliticaManifestacao')?.addEventListener('click', () => {
      void salvarPoliticaManifestacaoCentro();
    });

    document.getElementById('btnCdsCfgSalvar')?.addEventListener('click', () => {
      if (typeof global.salvarConfiguracoesAvancadas === 'function') {
        global.salvarConfiguracoesAvancadas().then?.(() => atualizarPainelExecutivo());
      }
    });

    document.getElementById('btnCdsCfgCancelar')?.addEventListener('click', () => {
      if (typeof global.loadConfiguracoesAvancadas === 'function') {
        global.loadConfiguracoesAvancadas();
      }
    });

    document.getElementById('btnCdsCfgRestaurar')?.addEventListener('click', () => {
      if (confirm('Descartar alterações não salvas e recarregar as configurações do servidor?')) {
        if (typeof global.loadConfiguracoesAvancadas === 'function') {
          global.loadConfiguracoesAvancadas();
        }
      }
    });

    document.getElementById('btnConfiguracaoTEF')?.addEventListener('click', () => {
      if (typeof global.abrirConfiguracaoTEF === 'function') global.abrirConfiguracaoTEF();
    });
    document.getElementById('btnConfiguracaoTEFIntegracoes')?.addEventListener('click', () => {
      if (typeof global.abrirConfiguracaoTEF === 'function') global.abrirConfiguracaoTEF();
    });
    document.getElementById('btnConfiguracaoRede')?.addEventListener('click', () => {
      if (typeof global.abrirModalConfiguracaoRede === 'function') global.abrirModalConfiguracaoRede();
    });

    let tab = 'geral';
    try {
      tab = sessionStorage.getItem('cds_cfg_tab') || 'geral';
    } catch { /* ignore */ }
    if (global.__CDS_CFG_FORCE_TAB) {
      tab = global.__CDS_CFG_FORCE_TAB;
      global.__CDS_CFG_FORCE_TAB = null;
    }
    ativarCategoria(tab);

    const anchor = global.__CDS_CFG_FORCE_ANCHOR;
    global.__CDS_CFG_FORCE_ANCHOR = null;
    if (anchor === 'manifestacao') {
      focarCardManifestacao();
    }
  }

  function renderCentroConfiguracoesCDS(config) {
    global.configuracaoAvancadaServidor = config || {};
    estadoExecutivo.usuario = obterUsuarioNome();

    const html = `
      <div class="cds-cfg" id="cdsCentroConfiguracoes">
        <div class="cds-cfg-hero">
          <h1 class="cds-cfg-hero__title"><i class="fas fa-cogs"></i> Configurações do CDS Sistemas</h1>
          <p class="cds-cfg-hero__sub">Plataforma Inteligente de Gestão · Centro oficial de configuração</p>
          <div class="cds-cfg-hero__meta">
            <span><i class="fas fa-code-branch"></i> Versão <strong id="cdsCfgMetaVersao">1.0.3</strong></span>
            <span><i class="fas fa-building"></i> <strong id="cdsCfgMetaEmpresa">—</strong></span>
            <span><i class="fas fa-user"></i> <strong id="cdsCfgMetaUsuario">${escapeHtml(estadoExecutivo.usuario)}</strong></span>
            <span><i class="fas fa-clock"></i> Última alteração <strong id="cdsCfgMetaAlteracao">—</strong></span>
          </div>
          <div class="cds-cfg-hero__actions">
            <button type="button" class="btn btn-light btn-sm" id="btnCdsCfgSalvar"><i class="fas fa-save"></i> Salvar</button>
            <button type="button" class="btn btn-outline-light btn-sm" id="btnCdsCfgCancelar"><i class="fas fa-undo"></i> Cancelar</button>
            <button type="button" class="btn btn-outline-light btn-sm" id="btnCdsCfgRestaurar"><i class="fas fa-history"></i> Restaurar padrão</button>
            <div class="cds-cfg-search">
              <i class="fas fa-search"></i>
              <input type="search" class="form-control form-control-sm" id="cdsCfgSearch" placeholder="Pesquisar configuração..." autocomplete="off">
            </div>
          </div>
        </div>

        <div id="cdsCfgExecWrap">${renderPainelExecutivo()}</div>

        <form id="formConfigAvancadas" onsubmit="return false;">
          <div class="cds-cfg-shell">
            <nav class="cds-cfg-nav" aria-label="Categorias de configuração">${renderNav('geral')}</nav>
            <div class="cds-cfg-main">${renderPanes(config || {})}</div>
          </div>
        </form>
      </div>
    `;

    $('#page-content').html(html);

    if (typeof global.configurarFormConfigAvancadas === 'function') {
      global.configurarFormConfigAvancadas();
    }
    if (typeof global.aplicarEstadoFormConfigAvancadas === 'function') {
      global.aplicarEstadoFormConfigAvancadas();
    }
    if (typeof global.carregarStatusPixAutomatico === 'function') {
      global.carregarStatusPixAutomatico();
    }

    wireShell();
    atualizarPainelExecutivo();
  }

  global.CATEGORIAS_CDS_CFG = CATEGORIAS;
  global.renderCentroConfiguracoesCDS = renderCentroConfiguracoesCDS;
  global.atualizarPainelExecutivoCentroCfg = atualizarPainelExecutivo;
  global.ativarCategoriaCentroCfg = ativarCategoria;
  global.pesquisarConfiguracaoCentroCfg = pesquisarConfiguracao;
  global.focarCardManifestacaoCentroCfg = focarCardManifestacao;
  global.salvarPoliticaManifestacaoCentroCfg = salvarPoliticaManifestacaoCentro;
})(typeof window !== 'undefined' ? window : global);
