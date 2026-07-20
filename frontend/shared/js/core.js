/**
 * Núcleo compartilhado entre CDS ERP e CDS PDV.
 */
const API_URL = (() => {
    if (typeof window.API_URL === 'string' && window.API_URL.trim() !== '') {
        return window.API_URL;
    }
    const resolved = `${window.location.origin}/api`;
    window.API_URL = resolved;
    return resolved;
})();

let currentPage = window.CDS_DEFAULT_PAGE || 'dashboard';
let chart = null;

function limparModaisTravados() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        el.removeAttribute('aria-hidden');
    });
    document.querySelectorAll('.loading, .overlay, .toast-container, .spinner-overlay').forEach(el => {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
    });
    document.body.style.display = 'none';
    document.body.offsetHeight;
    document.body.style.display = '';
}

$(document).on('hidden.bs.modal', function () {
    limparModaisTravados();
});

setInterval(() => {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop && !document.querySelector('.modal.show')) {
        limparModaisTravados();
    }
}, 2000);

let ultimoClique = Date.now();
let cliquesDetectados = 0;

$(document).on('click', function () {
    ultimoClique = Date.now();
    cliquesDetectados++;
});

setInterval(() => {
    if (window.electronAPI && cliquesDetectados > 0) {
        const tempoDesdeUltimoClique = Date.now() - ultimoClique;
        if (tempoDesdeUltimoClique > 100 && tempoDesdeUltimoClique < 2000) {
            if (window.electronAPI.forcarReflow) {
                window.electronAPI.forcarReflow();
            }
        }
        cliquesDetectados = 0;
    }
}, 3000);

const MODO_FISCAL_PADRAO = '1';

function obterRecursosImplantacao() {
    return (CONFIG_IMPLANTACAO && CONFIG_IMPLANTACAO.recursos) || {};
}

function implantacaoPermiteFiscal() {
    return obterRecursosImplantacao().fiscal === true;
}

function implantacaoPermiteMultiCaixa() {
    return obterRecursosImplantacao().multiCaixa === true;
}

async function carregarConfiguracaoImplantacao() {
    try {
        const response = await fetch(`${API_URL}/configuracoes-avancadas/recursos`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) return;

        CONFIG_IMPLANTACAO = await response.json();
        window.CONFIG_IMPLANTACAO = CONFIG_IMPLANTACAO;
        aplicarRecursosImplantacao();
    } catch (error) {
        console.error('Erro ao carregar configuração de implantação:', error);
    }
}

function aplicarRecursosImplantacao() {
    const recursos = obterRecursosImplantacao();

    $('[data-recurso="fiscal"]').toggle(!!recursos.fiscal);
    $('[data-recurso="multiCaixa"]').toggle(!!recursos.multiCaixa);
    $('[data-recurso="vendasEntrega"]').toggle(!!recursos.vendasEntrega);

    document.body.classList.toggle('modulo-vendas-entrega', !!recursos.vendasEntrega);

    if (window.PdvVendaEntrega && typeof window.PdvVendaEntrega.atualizarBotaoEntrega === 'function') {
        window.PdvVendaEntrega.atualizarBotaoEntrega();
    }

    if (!recursos.fiscal) {
        localStorage.setItem('pdv_modo_fiscal_ativo', '0');
    }

    document.body.classList.toggle('implantacao-sem-fiscal', !recursos.fiscal);
    document.body.classList.toggle('implantacao-fiscal', !!recursos.fiscal);
    document.body.classList.toggle('implantacao-multicaixa', !!recursos.multiCaixa);

    aplicarModoFiscalGlobal();
    if (typeof filtrarMenuPorPermissoes === 'function') {
        filtrarMenuPorPermissoes();
    }
}

function paginaPermitidaPorImplantacao(page) {
    if (page === 'fiscal' && !implantacaoPermiteFiscal()) return false;
    if (page === 'central-entradas' && !implantacaoPermiteFiscal()) return false;
    if (page === 'central-diagnostico' && !implantacaoPermiteFiscal()) return false;
    if (page === 'caixas' && !implantacaoPermiteMultiCaixa()) return false;
    if (page === 'entregas') {
        try {
            return obterRecursosImplantacao().vendasEntrega === true;
        } catch (_) {
            return false;
        }
    }
    return true;
}

function modoFiscalAtivoSistema() {
    if (!implantacaoPermiteFiscal()) return false;
    return localStorage.getItem('pdv_modo_fiscal_ativo') === '1';
}

function aplicarModoFiscalGlobal() {
    const ativo = modoFiscalAtivoSistema();
    document.body.classList.toggle('modo-fiscal-ativo', ativo);

    const faixa = document.getElementById('faixaSistemaFiscalPdv');
    if (faixa) {
        faixa.style.display = ativo ? 'block' : 'none';
    }

    const tituloPdv = document.querySelector('.pdv-header-left span');
    if (tituloPdv) {
        tituloPdv.textContent = ativo
            ? 'PDV - Frente de Caixa Fiscal NFC-e'
            : 'PDV - Frente de Caixa';
    }

    const btnFinalizar = document.getElementById('btnFinalizarVendaPdv');
    if (btnFinalizar) {
        const titulo = btnFinalizar.querySelector('.btn-finalizar-titulo');
        if (!titulo) {
            btnFinalizar.textContent = ativo ? 'Emitir NFC-e' : 'Finalizar Venda';
        }
    }

    if (typeof atualizarBarraModoFiscalSidebar === 'function') {
        atualizarBarraModoFiscalSidebar();
    }
}

let modoFiscalSyncInterval = null;
let modoFiscalSalvandoServidor = false;

function normalizarValorModoFiscal(valor) {
    return valor === true || valor === 'true' || valor === 1 || valor === '1' ? '1' : '0';
}

async function obterModoFiscalServidor() {
    if (!implantacaoPermiteFiscal()) {
        return '0';
    }

    try {
        const response = await fetch(`${API_URL}/configuracoes/modo_dashboard_fiscal`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data && data.valor !== undefined && data.valor !== null) {
            return normalizarValorModoFiscal(data.valor);
        }
    } catch (error) {
        console.warn('Erro ao obter modo fiscal do servidor:', error);
    }

    return null;
}

async function salvarModoFiscalServidor(valor) {
    if (!implantacaoPermiteFiscal()) {
        return;
    }

    const normalizado = normalizarValorModoFiscal(valor);

    try {
        modoFiscalSalvandoServidor = true;
        await fetch(`${API_URL}/configuracoes/modo_dashboard_fiscal`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({ valor: normalizado })
        });
    } catch (error) {
        console.warn('Erro ao salvar modo fiscal no servidor:', error);
    } finally {
        modoFiscalSalvandoServidor = false;
    }
}

function aplicarModoFiscalLocal(valor, opcoes = {}) {
    const normalizado = normalizarValorModoFiscal(valor);
    const atual = localStorage.getItem('pdv_modo_fiscal_ativo');

    if (atual === normalizado && !opcoes.forcar) {
        aplicarModoFiscalGlobal();
        return false;
    }

    localStorage.setItem('pdv_modo_fiscal_ativo', normalizado);
    localStorage.setItem('modo_dashboard_fiscal', normalizado);
    aplicarModoFiscalGlobal();

    if (opcoes.recarregar !== false && typeof recarregarModulosModoFiscal === 'function') {
        recarregarModulosModoFiscal();
    } else if (opcoes.recarregar !== false && currentPage === 'vendas' && typeof loadVendas === 'function') {
        loadVendas();
    }

    return true;
}

async function carregarModoFiscalInicial() {
    const remoto = await obterModoFiscalServidor();

    if (remoto !== null) {
        aplicarModoFiscalLocal(remoto, { recarregar: false });
        return;
    }

    if (localStorage.getItem('pdv_modo_fiscal_ativo') === null) {
        aplicarModoFiscalLocal(MODO_FISCAL_PADRAO, { recarregar: false });
        if (remoto === null && implantacaoPermiteFiscal()) {
            salvarModoFiscalServidor(MODO_FISCAL_PADRAO);
        }
    } else {
        aplicarModoFiscalGlobal();
    }
}

async function sincronizarModoFiscalServidor(opcoes = {}) {
    if (!implantacaoPermiteFiscal() || modoFiscalSalvandoServidor) {
        return;
    }

    const remoto = await obterModoFiscalServidor();
    if (remoto === null) {
        return;
    }

    const local = localStorage.getItem('pdv_modo_fiscal_ativo');
    if (local === remoto) {
        return;
    }

    const alterou = aplicarModoFiscalLocal(remoto, { recarregar: true });

    if (alterou && opcoes.notificar) {
        showNotification(
            remoto === '1'
                ? 'Modo fiscal ativado no servidor. PDV sincronizado.'
                : 'Modo completo ativado no servidor. PDV sincronizado.',
            'info'
        );
    }
}

function iniciarSincronizacaoModoFiscalServidor() {
    if (modoFiscalSyncInterval) {
        clearInterval(modoFiscalSyncInterval);
        modoFiscalSyncInterval = null;
    }

    if (!implantacaoPermiteFiscal()) {
        return;
    }

    const intervaloMs = window.CDS_MODULE === 'pdv' ? 3000 : 5000;

    modoFiscalSyncInterval = setInterval(() => {
        sincronizarModoFiscalServidor({ notificar: window.CDS_MODULE === 'pdv' });
    }, intervaloMs);
}

function alternarModoFiscalGlobal() {
    if (!implantacaoPermiteFiscal()) {
        showNotification('Emissão fiscal desabilitada para o tipo de implantação configurado.', 'warning');
        return;
    }

    const novoValor = modoFiscalAtivoSistema() ? '0' : '1';
    localStorage.setItem('pdv_modo_fiscal_ativo', novoValor);
    localStorage.setItem('modo_dashboard_fiscal', novoValor);
    aplicarModoFiscalGlobal();
    salvarModoFiscalServidor(novoValor);

    showNotification(
        novoValor === '1'
            ? 'Modo fiscal ativado. Exibindo somente informações fiscais.'
            : 'Modo completo ativado. Exibindo fiscal, não fiscal e total.',
        novoValor === '1' ? 'success' : 'info'
    );

    if (typeof recarregarModulosModoFiscal === 'function') {
        recarregarModulosModoFiscal();
    } else if (currentPage === 'vendas' && typeof loadVendas === 'function') {
        loadVendas();
    }
}

function handleUnauthorized() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

function isErroSessaoExpirada(xhr) {
    if (!xhr) return false;
    if (xhr.status === 401) return true;

    if (xhr.status === 403) {
        const mensagem = String(xhr.responseJSON?.error || '').toLowerCase();
        return (
            mensagem.includes('token') ||
            mensagem.includes('sessão') ||
            mensagem.includes('sessao') ||
            mensagem === 'acesso negado'
        );
    }

    return false;
}

$(document).ajaxError(function (event, xhr, settings) {
    if (settings.global === false) return;
    if (isErroSessaoExpirada(xhr)) {
        handleUnauthorized();
    }
});

function renderSidebarBrandPadrao() {
    const brandContent = document.getElementById('sidebar-brand-content') || document.getElementById('sidebar-brand');
    if (!brandContent) return;

    const modulo = window.CDS_MODULE === 'pdv' ? 'PDV' : 'ERP';
    if (typeof BrandService !== 'undefined' && BrandService.htmlSidebarPadrao) {
        brandContent.innerHTML = BrandService.htmlSidebarPadrao(modulo);
    } else {
        brandContent.innerHTML = `
            <h5 class="text-white">CDS</h5>
            <small class="text-muted">${modulo}</small>
        `;
    }

    if (typeof atualizarBarraModoFiscalSidebar === 'function') {
        atualizarBarraModoFiscalSidebar();
    }
}

function normalizeLogoPath(logoPath) {
    const value = String(logoPath || '').trim();
    if (!value) return '';
    if (value.startsWith('/storage/')) return value;
    if (value.startsWith('storage/')) return `/${value}`;

    const normalized = value.replace(/\\/g, '/');
    const storageIndex = normalized.indexOf('/storage/');
    if (storageIndex !== -1) {
        return normalized.slice(storageIndex);
    }

    return value;
}

async function carregarLogoSidebar() {
    const brandContent = document.getElementById('sidebar-brand-content') || document.getElementById('sidebar-brand');
    if (!brandContent) return;

    try {
        const response = await fetch(`${API_URL}/configuracoes`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            renderSidebarBrandPadrao();
            return;
        }

        const configuracoes = await response.json();
        const logoConfig = Array.isArray(configuracoes)
            ? configuracoes.find((config) => config.chave === 'logo' || config.chave === 'caminho_logomarca')
            : null;
        const rawLogoPath = logoConfig && logoConfig.valor ? String(logoConfig.valor).trim() : '';
        const logoPath = normalizeLogoPath(rawLogoPath);

        if (!logoPath) {
            renderSidebarBrandPadrao();
            return;
        }

        const logoUrl = logoPath.startsWith('/')
            ? `${API_URL.replace('/api', '')}${logoPath}`
            : logoPath;

        brandContent.innerHTML = `
            <img
                src="${logoUrl}"
                alt="Logo da empresa"
                class="img-fluid"
                style="max-height: 110px; object-fit: contain;"
            >
        `;
    } catch (error) {
        console.error('Erro ao carregar logo da sidebar:', error);
        renderSidebarBrandPadrao();
    }

    if (typeof atualizarBarraModoFiscalSidebar === 'function') {
        atualizarBarraModoFiscalSidebar();
    }
}

function isScriptAlreadyLoaded(src) {
    return Array.from(document.scripts).some(script => script.src && script.src.endsWith(src));
}

function resolveModulePageUrl(url) {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
        return url;
    }

    const module = window.CDS_MODULE || 'erp';
    const clean = url.replace(/^pages\//, '');
    return `/${module}/pages/${clean}`;
}

function carregarPaginaHtml(url, callback) {
    limparModaisTravados();
    const resolvedUrl = resolveModulePageUrl(url);

    $.get(resolvedUrl, function (html) {
        const $page = $('#page-content');
        const nodes = $.parseHTML(html, document, true);

        $page.empty();

        if (!nodes) {
            if (typeof callback === 'function') callback();
            return;
        }

        const inlineScripts = [];
        const pendingScripts = [];

        nodes.forEach(node => {
            if (node.nodeType === 1 && node.tagName.toLowerCase() === 'script') {
                if (node.src) {
                    const srcPath = node.getAttribute('src');
                    if (!isScriptAlreadyLoaded(srcPath)) {
                        pendingScripts.push(new Promise((resolve) => {
                            const script = document.createElement('script');
                            script.src = srcPath;
                            script.onload = resolve;
                            script.onerror = resolve;
                            document.body.appendChild(script);
                        }));
                    }
                } else {
                    inlineScripts.push(node.text || node.textContent || node.innerHTML || '');
                }
            } else {
                $page.append(node);
            }
        });

        inlineScripts.forEach(code => {
            if (code.trim()) {
                $.globalEval(code);
            }
        });

        const executarCallback = () => {
            aplicarModoFiscalGlobal();
            if (typeof callback === 'function') callback();
            aplicarModoFiscalGlobal();
        };

        if (pendingScripts.length === 0) {
            executarCallback();
        } else {
            Promise.all(pendingScripts).then(executarCallback);
        }
    }).fail(function () {
        $('#page-content').html('<div class="alert alert-danger">Erro ao carregar a página solicitada.</div>');
    });
}

function filtrarMenuPorPermissoes() {
    $('.nav-link[data-page]').each(function () {
        const page = $(this).data('page');
        const $item = $(this).closest('li.nav-item');

        if (!paginaPermitidaPorImplantacao(page)) {
            $item.hide();
            return;
        }

        if (!usuarioTemPermissao(page)) {
            $item.hide();
            return;
        }

        $item.show();
    });

    $('#nav-config-avancadas').toggle(isSuperAdminUser());
    $('#nav-abrir-pdv').toggle(window.CDS_MODULE === 'erp' && podeAbrirPDV());
    $('#nav-config-rede-pdv').toggle(window.CDS_MODULE === 'pdv' && isSuperAdminUser());
    $('#nav-nome-terminal-pdv').toggle(window.CDS_MODULE === 'pdv' && isSuperAdminUser());
    $('#nav-abrir-erp').toggle(
        window.CDS_MODULE === 'pdv' &&
        typeof podeAbrirERP === 'function' &&
        podeAbrirERP(obterUsuarioLogado())
    );

    // UX-A: ocultar grupos sem itens visíveis (ACL/implantação inalteradas)
    if (typeof atualizarVisibilidadeGruposMenu === 'function') {
        atualizarVisibilidadeGruposMenu();
    }
}

/**
 * UX-A — Esconde seções do sidebar quando nenhum filho está visível.
 * Placeholder de Relatórios permanece visível.
 */
function atualizarVisibilidadeGruposMenu() {
    $('.nav-group').each(function () {
        const $group = $(this);
        if ($group.data('placeholder')) {
            $group.show();
            return;
        }

        const $itens = $group.find('> .nav-group-items > .nav-item');
        let visiveis = 0;
        $itens.each(function () {
            if ($(this).css('display') !== 'none' && $(this).is(':visible')) {
                visiveis += 1;
            }
        });

        // :visible pode falhar se ancestral oculto — usar display do próprio item
        if (visiveis === 0) {
            visiveis = $itens.filter(function () {
                return this.style.display !== 'none' && $(this).css('display') !== 'none';
            }).length;
        }

        $group.toggle(visiveis > 0);
    });
}

/**
 * UX-A — Recolher / expandir sidebar (somente visual).
 */
function inicializarSidebarToggle() {
    const $btn = $('#sidebar-toggle');
    if (!$btn.length) return;

    const KEY = 'cds_erp_sidebar_collapsed';
    try {
        if (localStorage.getItem(KEY) === '1') {
            document.body.classList.add('sidebar-collapsed');
        }
    } catch (e) { /* ignore */ }

    const syncIcon = () => {
        const collapsed = document.body.classList.contains('sidebar-collapsed');
        $btn.find('i').attr('class', collapsed ? 'fas fa-angles-right' : 'fas fa-angles-left');
        $btn.attr('title', collapsed ? 'Expandir menu' : 'Recolher menu');
        $btn.attr('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    };
    syncIcon();

    $btn.off('click.cdsSidebar').on('click.cdsSidebar', function () {
        document.body.classList.toggle('sidebar-collapsed');
        const collapsed = document.body.classList.contains('sidebar-collapsed');
        try {
            localStorage.setItem(KEY, collapsed ? '1' : '0');
        } catch (e) { /* ignore */ }
        syncIcon();
    });
}

function formatCurrency(value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) value = 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(value));
}

function formatDate(date) {
    if (!date) return '';
    const texto = String(date).trim();
    const matchData = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchData) {
        return `${matchData[3]}/${matchData[2]}/${matchData[1]}`;
    }
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? texto : d.toLocaleDateString('pt-BR');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const data = new Date(dateString);
    return Number.isNaN(data.getTime())
        ? dateString
        : data.toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
}

function formatarDataHoraBR(dataHora) {
    if (!dataHora) return '-';
    const [data, hora] = dataHora.split(' ');
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano} ${hora}`;
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    const numeros = String(cnpj).replace(/\D/g, '');
    if (numeros.length !== 14) return cnpj;
    return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatarCPF(cpf) {
    if (!cpf) return '';
    const numeros = String(cpf).replace(/\D/g, '');
    if (numeros.length !== 11) return cpf;
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarCpfCnpj(valor) {
    if (!valor) return '';
    const numeros = String(valor).replace(/\D/g, '');
    if (numeros.length === 11) return formatarCPF(numeros);
    if (numeros.length === 14) return formatarCNPJ(numeros);
    return valor;
}

function formatCpfCnpjInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1-$2');
    } else {
        value = value.replace(/(\d{2})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1/$2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
    }
    input.value = value;
}

function showNotification(mensagem, tipo = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.warn('[CDS] notification-container ausente:', mensagem);
        return;
    }

    const tom = ({ error: 'danger', erro: 'danger', ok: 'success', info: 'info', warning: 'warning', warn: 'warning', danger: 'danger', success: 'success' })[tipo] || tipo || 'success';
    const id = `notif-${Date.now()}`;
    const alert = document.createElement('div');
    alert.id = id;
    alert.className = `alert alert-${tom} alert-dismissible fade show`;
    alert.style.pointerEvents = 'auto';
    alert.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" onclick="fecharNotificacao('${id}')"></button>
    `;

    container.appendChild(alert);
    setTimeout(() => fecharNotificacao(id), 3000);
}

/** Alias oficial RC4.3.1 — feedback unificado (substitui alert/toast ad-hoc). */
function mostrarToastCentral(mensagem, tipo = 'info') {
    showNotification(mensagem, tipo);
}

function fecharNotificacao(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

/** Aplica identidade visual oficial (Branding 1.0) nos elementos data-brand. */
function aplicarIdentidadeVisualCds() {
    if (typeof BrandService === 'undefined') return;

    BrandService.aplicarFavicon();

    document.querySelectorAll('[data-brand="nome"]').forEach((el) => {
        el.textContent = BrandService.NOME;
    });
    document.querySelectorAll('[data-brand="slogan"]').forEach((el) => {
        el.innerHTML = BrandService.SLOGAN.replace(', ', ',<br>');
    });
    document.querySelectorAll('[data-brand="copyright"]').forEach((el) => {
        el.textContent = BrandService.NOME;
    });

    const pdvTitle = document.getElementById('pdvBrandTitle');
    if (pdvTitle) pdvTitle.textContent = BrandService.NOME_DISPLAY;
}

function inicializarShellModulo(options = {}) {
    const defaultPage = options.defaultPage || currentPage;

    if (!localStorage.getItem('token')) {
        window.location.href = '/login';
        return;
    }

    if (redirecionarSeModuloNegado(window.CDS_MODULE)) {
        return;
    }

    aplicarIdentidadeVisualCds();

    const user = obterUsuarioLogado();
    $('#user-nome').text(user.nome || user.username || 'Usuário');
    $('#user-perfil').text(
        isUsuarioCaixa(user) ? 'Caixa' :
        user.role === 'admin' ? 'Administrador' : 'Operador'
    );

    $.ajaxSetup({
        beforeSend: function (xhr, settings) {
            if (settings.url && !settings.url.includes('/api/')) return;
            const token = localStorage.getItem('token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
        }
    });

    $.ajax({
        url: `${API_URL}/auth/verificar`,
        method: 'POST',
        success: function () {
            carregarConfiguracaoImplantacao().finally(async function () {
                await carregarModoFiscalInicial();
                iniciarSincronizacaoModoFiscalServidor();

                if (implantacaoPermiteFiscal()) {
                    $(document).off('keydown.modoFiscalF12').on('keydown.modoFiscalF12', function (e) {
                        if (e.key === 'F12') {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            alternarModoFiscalGlobal();
                            return false;
                        }
                    });
                }

                carregarLogoSidebar();
                filtrarMenuPorPermissoes();
                if (typeof inicializarSidebarToggle === 'function') {
                    inicializarSidebarToggle();
                }

                $('.nav-link[data-page]').off('click.cdsNav').on('click.cdsNav', function (e) {
                    e.preventDefault();
                    const page = $(this).data('page');
                    loadPage(page);
                    $('.nav-link').removeClass('active');
                    $(this).addClass('active');
                });

                currentPage = defaultPage;
                $('.nav-link').removeClass('active');
                $(`.nav-link[data-page="${defaultPage}"]`).addClass('active');
                loadPage(defaultPage);
            });
        },
        error: function () {
            handleUnauthorized();
        }
    });
}

window.produtoUsaConversaoUnidades = function produtoUsaConversaoUnidades(produto) {
    if (!produto) return false;
    return Number(produto.produto_fracionado ?? produto.vendido_por_peso ?? 0) === 1;
};

window.aplicarIdentidadeVisualCds = aplicarIdentidadeVisualCds;

/** @deprecated Alias legado — use produtoUsaConversaoUnidades */
window.produtoEhFracionado = window.produtoUsaConversaoUnidades;

$.ajaxSetup({
    beforeSend: function (xhr, settings) {
        if (settings.url && !settings.url.includes('/api/')) return;
        const token = localStorage.getItem('token');
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
    }
});
