/**
 * CdsPageShell — Cabeçalho padrão + breadcrumb (UX-A).
 * Somente UI. Não altera rotas, APIs ou regras.
 */
(function (global) {
  'use strict';

  const PAGE_META = {
    dashboard: { grupo: 'Painel', titulo: 'Dashboard', subtitulo: 'Visão geral do negócio' },
    monitoring: { grupo: 'Painel', titulo: 'Central de Monitoramento', subtitulo: 'Indicadores oficiais via CDS Monitoring Engine' },
    produtos: { grupo: 'Suprimentos', titulo: 'Produtos', subtitulo: 'Cadastro e estoque de produtos' },
    categorias: { grupo: 'Suprimentos', titulo: 'Categorias', subtitulo: 'Organização do catálogo' },
    compras: { grupo: 'Suprimentos', titulo: 'Compras', subtitulo: 'Lançamento e acompanhamento de compras' },
    'central-entradas': { grupo: 'Suprimentos', titulo: 'Central Inteligente de Entradas', subtitulo: 'Documentos fiscais recebidos' },
    financeiro: { grupo: 'Financeiro', titulo: 'Financeiro', subtitulo: 'Contas a receber, pagar e visão geral' },
    caixas: { grupo: 'Financeiro', titulo: 'Gerenciar Caixas', subtitulo: 'Terminais e multi-caixa' },
    clientes: { grupo: 'Cadastros', titulo: 'Clientes', subtitulo: 'Cadastro de clientes' },
    fornecedores: { grupo: 'Cadastros', titulo: 'Fornecedores', subtitulo: 'Cadastro de fornecedores' },
    fiscal: { grupo: 'Fiscal', titulo: 'NFC-e Emitidas', subtitulo: 'Notas fiscais de consumidor emitidas' },
    vendas: { grupo: 'Comercial', titulo: 'Histórico de Vendas', subtitulo: 'Consulta e acompanhamento de vendas' },
    caixa: { grupo: 'Comercial', titulo: 'Fechamento de Caixa', subtitulo: 'Sangria, reforço e fechamento' },
    configuracoes: { grupo: 'Administração', titulo: 'Configurações', subtitulo: 'Preferências do sistema' },
    usuarios: { grupo: 'Administração', titulo: 'Usuários', subtitulo: 'Acessos e permissões' },
    licenca: { grupo: 'Administração', titulo: 'Licença', subtitulo: 'Status e ativação da licença' },
    auditoria: { grupo: 'Administração', titulo: 'Auditoria', subtitulo: 'Trilha de eventos do sistema' },
    'laboratorio-equipamentos': { grupo: 'Administração', titulo: 'Laboratório de Equipamentos', subtitulo: 'Testes e diagnóstico de periféricos' },
    'central-diagnostico': { grupo: 'Administração', titulo: 'Saúde da Central', subtitulo: 'Diagnóstico técnico da Central de Entradas' },
    'configuracoes-avancadas': { grupo: 'Administração', titulo: 'Centro de Configurações', subtitulo: 'Configurações oficiais da plataforma (SUPER_ADMIN)' },
    equipamentos: { grupo: 'Administração', titulo: 'Equipamentos', subtitulo: 'Cadastro de balanças e periféricos' }
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Breadcrumb preparado (oculto por padrão — UX-A).
   * @param {Array<{label:string, page?:string}>} items
   * @param {{visible?:boolean}} [opcoes]
   */
  function renderBreadcrumb(items, opcoes) {
    const visible = opcoes && opcoes.visible === true;
    const parts = (items || []).map((item, index) => {
      const isLast = index === items.length - 1;
      const label = escapeHtml(item.label);
      if (!isLast && item.page) {
        return `<a href="#" class="cds-breadcrumb__link" data-page="${escapeHtml(item.page)}">${label}</a>`;
      }
      return `<span class="cds-breadcrumb__current">${label}</span>`;
    }).join('<span class="cds-breadcrumb__sep" aria-hidden="true">›</span>');

    return `
      <nav class="cds-breadcrumb${visible ? '' : ' cds-breadcrumb--hidden'}" aria-label="Breadcrumb" ${visible ? '' : 'hidden'}>
        ${parts}
      </nav>
    `;
  }

  /**
   * Cabeçalho padrão: breadcrumb + título + subtítulo + toolbar.
   */
  function renderHeader(opcoes) {
    const opts = opcoes || {};
    const page = opts.page || '';
    const meta = PAGE_META[page] || {};
    const titulo = opts.titulo || meta.titulo || 'CDS';
    const subtitulo = opts.subtitulo != null ? opts.subtitulo : (meta.subtitulo || '');
    const grupo = opts.grupo || meta.grupo || 'Painel';
    const toolbar = opts.toolbarHtml || '';
    const breadcrumbItems = opts.breadcrumb || [
      { label: 'Painel', page: 'dashboard' },
      { label: grupo },
      { label: titulo }
    ];

    return `
      <div class="cds-page-shell">
        ${renderBreadcrumb(breadcrumbItems, { visible: opts.breadcrumbVisible === true })}
        <div class="cds-page-header">
          <div class="cds-page-header__text">
            <h1 class="cds-page-header__title">${escapeHtml(titulo)}</h1>
            ${subtitulo ? `<p class="cds-page-header__subtitle">${escapeHtml(subtitulo)}</p>` : ''}
          </div>
          ${toolbar ? `<div class="cds-page-header__toolbar">${toolbar}</div>` : ''}
        </div>
      </div>
    `;
  }

  function metaDaPagina(page) {
    return PAGE_META[page] || null;
  }

  global.CdsPageShell = {
    PAGE_META,
    renderHeader,
    renderBreadcrumb,
    metaDaPagina,
    escapeHtml
  };
})(typeof window !== 'undefined' ? window : global);
