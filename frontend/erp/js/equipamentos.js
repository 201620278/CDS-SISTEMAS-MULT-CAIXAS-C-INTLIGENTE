/**
 * Configurações → Equipamentos → Balanças (Sprint 9)
 */

let equipamentosCache = [];
let driversCache = [];
let filtrosEquipamentos = { tipo: 'balanca', busca: '', status: '', ativo: '' };

function escapeHtmlEquipamentos(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function labelStatusEquipamento(status) {
    const s = String(status || 'desconhecido').toLowerCase();
    const mapa = {
        online: '<span class="badge bg-success">Online</span>',
        offline: '<span class="badge bg-secondary">Offline</span>',
        erro: '<span class="badge bg-danger">Erro</span>',
        desconhecido: '<span class="badge bg-warning text-dark">Desconhecido</span>',
        sincronizando: '<span class="badge bg-info">Sincronizando</span>'
    };
    return mapa[s] || `<span class="badge bg-secondary">${escapeHtmlEquipamentos(s)}</span>`;
}

function headersEquipamentos() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function apiUrlEquipamentos() {
    return (typeof API_URL === 'string' && API_URL.trim() !== '') ? API_URL : `${window.location.origin}/api`;
}

function montarQueryFiltros() {
    const p = new URLSearchParams();
    p.set('todos', '1');
    if (filtrosEquipamentos.tipo) p.set('tipo', filtrosEquipamentos.tipo);
    if (filtrosEquipamentos.busca) p.set('busca', filtrosEquipamentos.busca);
    if (filtrosEquipamentos.status) p.set('status', filtrosEquipamentos.status);
    if (filtrosEquipamentos.ativo !== '') p.set('ativo', filtrosEquipamentos.ativo);
    return p.toString();
}

async function carregarEquipamentosDados() {
    const apiUrl = apiUrlEquipamentos();
    const query = montarQueryFiltros();

    const [respLista, respDrivers, respResumo] = await Promise.all([
        fetch(`${apiUrl}/equipamentos?${query}`, { headers: headersEquipamentos() }),
        fetch(`${apiUrl}/equipamentos/drivers`, { headers: headersEquipamentos() }),
        fetch(`${apiUrl}/equipamentos/resumo`, { headers: headersEquipamentos() })
    ]);

    const lista = await respLista.json();
    const drivers = await respDrivers.json();
    const resumo = await respResumo.json();

    if (!respLista.ok) throw new Error(lista.error || 'Erro ao carregar equipamentos');
    if (!respDrivers.ok) throw new Error(drivers.error || 'Erro ao carregar drivers');

    equipamentosCache = lista.equipamentos || [];
    driversCache = drivers.drivers || [];

    return {
        equipamentos: equipamentosCache,
        drivers: driversCache,
        resumo: resumo.resumo || { quantidade: 0, online: 0, offline: 0, fila: 0, pendentes: 0 }
    };
}

function formatarDataHoraEquip(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch (_) {
        return iso;
    }
}

function renderTabelaEquipamentos(equipamentos) {
    if (!equipamentos.length) {
        return '<tr><td colspan="10" class="text-center text-muted py-4">Nenhuma balança encontrada.</td></tr>';
    }

    return equipamentos.map((eq) => `
        <tr>
            <td>${eq.id}</td>
            <td><strong>${escapeHtmlEquipamentos(eq.nome)}</strong></td>
            <td>${escapeHtmlEquipamentos(eq.fabricante || '-')}<br><small class="text-muted">${escapeHtmlEquipamentos(eq.modelo || '-')}</small></td>
            <td><small>${escapeHtmlEquipamentos(eq.driver_nome || eq.driver_codigo || '-')}</small></td>
            <td>${escapeHtmlEquipamentos(eq.transporte || '-')}<br><small class="text-muted">${escapeHtmlEquipamentos(eq.ip || '')}${eq.porta_tcp ? ':' + eq.porta_tcp : ''}</small></td>
            <td>${labelStatusEquipamento(eq.status)}</td>
            <td><small>${formatarDataHoraEquip(eq.ultima_comunicacao)}</small></td>
            <td><small class="text-danger">${escapeHtmlEquipamentos(eq.ultimo_erro || '—')}</small></td>
            <td>${eq.ativo ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Não</span>'}</td>
            <td class="text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarEquipamento(${eq.id})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-secondary me-1" onclick="duplicarEquipamento(${eq.id})" title="Duplicar"><i class="fas fa-copy"></i></button>
                <button class="btn btn-sm btn-outline-info me-1" onclick="testarEquipamento(${eq.id})" title="Testar conexão"><i class="fas fa-plug"></i></button>
                <button class="btn btn-sm btn-outline-warning me-1" onclick="diagnosticarEquipamento(${eq.id})" title="Diagnóstico"><i class="fas fa-stethoscope"></i></button>
                ${eq.ativo
                    ? `<button class="btn btn-sm btn-outline-dark me-1" onclick="desativarEquipamento(${eq.id})" title="Desativar"><i class="fas fa-ban"></i></button>`
                    : `<button class="btn btn-sm btn-outline-success me-1" onclick="ativarEquipamento(${eq.id})" title="Ativar"><i class="fas fa-check"></i></button>`}
                <button class="btn btn-sm btn-outline-danger" onclick="excluirEquipamento(${eq.id})" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderPaginaEquipamentos(dados) {
    const { equipamentos, resumo } = dados;

    const html = `
        <nav aria-label="breadcrumb" class="mb-2">
            <ol class="breadcrumb mb-0">
                <li class="breadcrumb-item"><a href="#" onclick="loadPage('configuracoes'); return false;">Configurações</a></li>
                <li class="breadcrumb-item">Equipamentos</li>
                <li class="breadcrumb-item active">Balanças</li>
            </ol>
        </nav>

        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
                <h3 class="mb-0"><i class="fas fa-weight"></i> Balanças</h3>
                <small class="text-muted">Cadastro e teste de conexão TCP — Motor Equipamentos</small>
            </div>
            <div>
                <button class="btn btn-outline-secondary me-2" onclick="diagnosticarEquipamento()"><i class="fas fa-stethoscope"></i> Diagnóstico geral</button>
                <button class="btn btn-primary" onclick="abrirModalEquipamento()"><i class="fas fa-plus"></i> Nova balança</button>
            </div>
        </div>

        <div class="row mb-3" id="painel-conexao-tcp" style="display:none;">
            <div class="col-12">
                <div class="card border-info">
                    <div class="card-header bg-info text-white"><i class="fas fa-network-wired"></i> Resultado do teste de conexão</div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3"><small class="text-muted">Status</small><div id="tcp-status" class="fw-bold">—</div></div>
                            <div class="col-md-3"><small class="text-muted">Conectado</small><div id="tcp-conectado" class="fw-bold">—</div></div>
                            <div class="col-md-3"><small class="text-muted">Última comunicação</small><div id="tcp-tempo" class="fw-bold">—</div></div>
                            <div class="col-md-3"><small class="text-muted">Último erro</small><div id="tcp-erro" class="fw-bold text-danger">—</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-3">
            <div class="col-6 col-md-3 mb-2"><div class="card"><div class="card-body py-2"><small class="text-muted">Cadastrados</small><div class="h4 mb-0">${resumo.quantidade || 0}</div></div></div></div>
            <div class="col-6 col-md-3 mb-2"><div class="card border-success"><div class="card-body py-2"><small class="text-muted">Online</small><div class="h4 mb-0 text-success">${resumo.online || 0}</div></div></div></div>
            <div class="col-6 col-md-3 mb-2"><div class="card border-danger"><div class="card-body py-2"><small class="text-muted">Offline</small><div class="h4 mb-0 text-danger">${resumo.offline || 0}</div></div></div></div>
            <div class="col-6 col-md-3 mb-2"><div class="card border-warning"><div class="card-body py-2"><small class="text-muted">Pendentes (fila)</small><div class="h4 mb-0">${resumo.pendentes || resumo.fila || 0}</div></div></div></div>
        </div>

        <div class="card mb-3">
            <div class="card-body">
                <div class="row g-2 align-items-end">
                    <div class="col-md-4">
                        <label class="form-label small mb-0">Pesquisar</label>
                        <input type="text" class="form-control" id="filtroBuscaEq" placeholder="Nome, IP, fabricante..." value="${escapeHtmlEquipamentos(filtrosEquipamentos.busca)}">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small mb-0">Status</label>
                        <select class="form-select" id="filtroStatusEq">
                            <option value="">Todos</option>
                            <option value="online" ${filtrosEquipamentos.status === 'online' ? 'selected' : ''}>Online</option>
                            <option value="offline" ${filtrosEquipamentos.status === 'offline' ? 'selected' : ''}>Offline</option>
                            <option value="desconhecido" ${filtrosEquipamentos.status === 'desconhecido' ? 'selected' : ''}>Desconhecido</option>
                            <option value="erro" ${filtrosEquipamentos.status === 'erro' ? 'selected' : ''}>Erro</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small mb-0">Ativo</label>
                        <select class="form-select" id="filtroAtivoEq">
                            <option value="">Todos</option>
                            <option value="1" ${filtrosEquipamentos.ativo === '1' ? 'selected' : ''}>Sim</option>
                            <option value="0" ${filtrosEquipamentos.ativo === '0' ? 'selected' : ''}>Não</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" onclick="aplicarFiltrosEquipamentos()"><i class="fas fa-search"></i> Filtrar</button>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-outline-secondary w-100" onclick="limparFiltrosEquipamentos()">Limpar</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><i class="fas fa-list"></i> Lista de balanças</div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped table-hover mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nome</th>
                                <th>Fabricante/Modelo</th>
                                <th>Driver</th>
                                <th>Conexão</th>
                                <th>Status</th>
                                <th>Última comunicação</th>
                                <th>Último erro</th>
                                <th>Ativo</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>${renderTabelaEquipamentos(equipamentos)}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    $('#page-content').html(html);
}

function aplicarFiltrosEquipamentos() {
    filtrosEquipamentos.busca = document.getElementById('filtroBuscaEq')?.value?.trim() || '';
    filtrosEquipamentos.status = document.getElementById('filtroStatusEq')?.value || '';
    filtrosEquipamentos.ativo = document.getElementById('filtroAtivoEq')?.value ?? '';
    loadEquipamentos();
}

function limparFiltrosEquipamentos() {
    filtrosEquipamentos = { tipo: 'balanca', busca: '', status: '', ativo: '' };
    loadEquipamentos();
}

function loadEquipamentos() {
    $('#page-content').html('<div class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-2">Carregando balanças...</p></div>');
    carregarEquipamentosDados()
        .then(renderPaginaEquipamentos)
        .catch((err) => {
            console.error(err);
            $('#page-content').html(`<div class="alert alert-danger">${escapeHtmlEquipamentos(err.message)}</div>`);
        });
}

function abrirModalEquipamento(equipamento = null) {
    const isEdicao = Boolean(equipamento);
    const eq = equipamento || {};

    const optionsDrivers = driversCache.map((d) =>
        `<option value="${escapeHtmlEquipamentos(d.codigo)}" data-id="${d.id}" data-fab="${escapeHtmlEquipamentos(d.fabricante)}" data-mod="${escapeHtmlEquipamentos(d.modelo)}" ${eq.driver_codigo === d.codigo ? 'selected' : ''}>${escapeHtmlEquipamentos(d.nome_exibicao)}</option>`
    ).join('');

    $('#modal-container').html(`
        <div class="modal fade" id="modalEquipamento" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEdicao ? 'Editar' : 'Nova'} balança</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="eqId" value="${eq.id || ''}">
                        <div class="row">
                            <div class="col-md-8 mb-3">
                                <label class="form-label fw-bold">Nome *</label>
                                <input type="text" class="form-control" id="eqNome" value="${escapeHtmlEquipamentos(eq.nome || '')}" required>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label fw-bold">Driver</label>
                                <select class="form-select" id="eqDriverCodigo" onchange="preencherFabricanteModeloDriver()">
                                    <option value="">— Selecione —</option>
                                    ${optionsDrivers}
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Fabricante</label>
                                <input type="text" class="form-control" id="eqFabricante" value="${escapeHtmlEquipamentos(eq.fabricante || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Modelo</label>
                                <input type="text" class="form-control" id="eqModelo" value="${escapeHtmlEquipamentos(eq.modelo || '')}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label fw-bold">Transporte</label>
                                <select class="form-select" id="eqTransporte">
                                    <option value="ethernet" ${eq.transporte === 'ethernet' || !eq.transporte ? 'selected' : ''}>Ethernet (TCP)</option>
                                    <option value="serial" ${eq.transporte === 'serial' ? 'selected' : ''}>Serial (COM)</option>
                                    <option value="usb" ${eq.transporte === 'usb' ? 'selected' : ''}>USB</option>
                                    <option value="bluetooth" ${eq.transporte === 'bluetooth' ? 'selected' : ''}>Bluetooth</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">IP</label>
                                <input type="text" class="form-control" id="eqIp" value="${escapeHtmlEquipamentos(eq.ip || '')}" placeholder="192.168.0.100">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Porta TCP</label>
                                <input type="number" class="form-control" id="eqPortaTcp" value="${eq.porta_tcp || 9100}" placeholder="9100">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Timeout (ms)</label>
                                <input type="number" class="form-control" id="eqTimeout" value="${eq.timeout_ms || 5000}">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Porta COM</label>
                                <input type="text" class="form-control" id="eqPortaCom" value="${escapeHtmlEquipamentos(eq.porta_com || '')}" placeholder="COM3">
                            </div>
                            <div class="col-md-4 mb-3 d-flex align-items-end">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="eqReconnectAuto" ${eq.reconnect_auto !== false ? 'checked' : ''}>
                                    <label class="form-check-label" for="eqReconnectAuto">Reconectar automaticamente</label>
                                </div>
                            </div>
                            <div class="col-md-4 mb-3 d-flex align-items-end">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="eqAtivo" ${eq.ativo !== false ? 'checked' : ''}>
                                    <label class="form-check-label" for="eqAtivo">Ativo</label>
                                </div>
                            </div>
                            <div class="col-12 mb-3">
                                <label class="form-label">Observações</label>
                                <textarea class="form-control" id="eqObservacao" rows="2">${escapeHtmlEquipamentos(eq.observacao || '')}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" onclick="salvarEquipamento()">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `);

    new bootstrap.Modal(document.getElementById('modalEquipamento')).show();
}

function preencherFabricanteModeloDriver() {
    const sel = document.getElementById('eqDriverCodigo');
    const opt = sel?.selectedOptions?.[0];
    if (!opt || !opt.dataset.fab) return;
    document.getElementById('eqFabricante').value = opt.dataset.fab || '';
    document.getElementById('eqModelo').value = opt.dataset.mod || '';
}

function coletarDadosFormEquipamento() {
    const driverSelect = document.getElementById('eqDriverCodigo');
    const driverOption = driverSelect?.selectedOptions?.[0];
    return {
        nome: document.getElementById('eqNome').value.trim(),
        tipo: 'balanca',
        driver_codigo: driverSelect?.value || null,
        driver_id: driverOption?.dataset?.id ? Number(driverOption.dataset.id) : null,
        fabricante: document.getElementById('eqFabricante').value.trim() || null,
        modelo: document.getElementById('eqModelo').value.trim() || null,
        transporte: document.getElementById('eqTransporte').value,
        porta_com: document.getElementById('eqPortaCom').value.trim() || null,
        ip: document.getElementById('eqIp').value.trim() || null,
        porta_tcp: document.getElementById('eqPortaTcp').value ? Number(document.getElementById('eqPortaTcp').value) : 9100,
        timeout_ms: document.getElementById('eqTimeout').value ? Number(document.getElementById('eqTimeout').value) : 5000,
        reconnect_auto: document.getElementById('eqReconnectAuto').checked,
        ativo: document.getElementById('eqAtivo').checked,
        observacao: document.getElementById('eqObservacao').value.trim() || null
    };
}

async function salvarEquipamento() {
    const apiUrl = apiUrlEquipamentos();
    const id = document.getElementById('eqId').value;
    const payload = coletarDadosFormEquipamento();
    if (!payload.nome) {
        showNotification('Informe o nome da balança', 'warning');
        return;
    }
    try {
        const url = id ? `${apiUrl}/equipamentos/${id}` : `${apiUrl}/equipamentos`;
        const resp = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: headersEquipamentos(),
            body: JSON.stringify(payload)
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error || 'Erro ao salvar');
        bootstrap.Modal.getInstance(document.getElementById('modalEquipamento'))?.hide();
        showNotification(body.message || 'Salvo com sucesso', 'success');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function editarEquipamento(id) {
    const eq = equipamentosCache.find((i) => Number(i.id) === Number(id));
    if (!eq) return showNotification('Equipamento não encontrado', 'warning');
    abrirModalEquipamento(eq);
}

async function excluirEquipamento(id) {
    if (!confirm('Excluir esta balança?')) return;
    try {
        const resp = await fetch(`${apiUrlEquipamentos()}/equipamentos/${id}`, { method: 'DELETE', headers: headersEquipamentos() });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error);
        showNotification(body.message || 'Removido', 'success');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

async function duplicarEquipamento(id) {
    try {
        const resp = await fetch(`${apiUrlEquipamentos()}/equipamentos/${id}/duplicar`, { method: 'POST', headers: headersEquipamentos() });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error);
        showNotification(body.message || 'Duplicado', 'success');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

async function ativarEquipamento(id) {
    try {
        const resp = await fetch(`${apiUrlEquipamentos()}/equipamentos/${id}/ativar`, { method: 'POST', headers: headersEquipamentos() });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error);
        showNotification(body.message || 'Ativado', 'success');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

async function desativarEquipamento(id) {
    try {
        const resp = await fetch(`${apiUrlEquipamentos()}/equipamentos/${id}/desativar`, { method: 'POST', headers: headersEquipamentos() });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error);
        showNotification(body.message || 'Desativado', 'success');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function atualizarPainelConexaoTcp(dados) {
    const painel = document.getElementById('painel-conexao-tcp');
    if (!painel || !dados) return;
    painel.style.display = 'block';
    const eq = dados.equipamento || {};
    const conectado = dados.sucesso === true;
    const el = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
    el('tcp-status', conectado ? '<span class="text-success">Sucesso</span>' : '<span class="text-danger">Falha</span>');
    el('tcp-conectado', conectado ? 'Teste OK (abrir/fechar)' : 'Não');
    const tempo = document.getElementById('tcp-tempo');
    if (tempo) tempo.textContent = formatarDataHoraEquip(eq.ultima_comunicacao || dados.timestamp);
    const erro = document.getElementById('tcp-erro');
    if (erro) erro.textContent = dados.ultimo_erro || eq.ultimo_erro || '—';
}

async function testarEquipamento(id) {
    try {
        const resp = await fetch(`${apiUrlEquipamentos()}/equipamentos/${id}/testar`, {
            method: 'POST',
            headers: headersEquipamentos()
        });
        const body = await resp.json();
        if (!resp.ok && !body.mensagem) throw new Error(body.error || 'Erro no teste');
        if (body.comunicacao_real) atualizarPainelConexaoTcp(body);
        showNotification(body.mensagem || 'Teste concluído', body.sucesso ? 'success' : 'warning');
        loadEquipamentos();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function abrirModalDiagnostico(diag) {
    const d = diag.diagnostico || {};
    $('#modal-container').html(`
        <div class="modal fade" id="modalDiagnosticoEq" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title"><i class="fas fa-stethoscope"></i> Diagnóstico — ${escapeHtmlEquipamentos(diag.equipamento?.nome || '')}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <table class="table table-sm">
                            <tr><th>Ping</th><td>${escapeHtmlEquipamentos(d.ping || '—')}</td></tr>
                            <tr><th>Tempo resposta</th><td>${d.tempo_resposta_ms != null ? d.tempo_resposta_ms + ' ms' : '—'}</td></tr>
                            <tr><th>IP / Porta</th><td>${escapeHtmlEquipamentos(d.ip || '—')}:${d.porta || '—'}</td></tr>
                            <tr><th>Driver</th><td>${escapeHtmlEquipamentos(d.driver || '—')}</td></tr>
                            <tr><th>Transporte</th><td>${escapeHtmlEquipamentos(d.transporte || '—')}</td></tr>
                            <tr><th>Versão driver</th><td>${escapeHtmlEquipamentos(d.versao_driver || '—')}</td></tr>
                            <tr><th>Último erro</th><td class="text-danger">${escapeHtmlEquipamentos(d.ultimo_erro || '—')}</td></tr>
                            <tr><th>Última comunicação</th><td>${formatarDataHoraEquip(d.ultima_comunicacao)}</td></tr>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
    `);
    new bootstrap.Modal(document.getElementById('modalDiagnosticoEq')).show();
}

async function diagnosticarEquipamento(id) {
    try {
        const url = id
            ? `${apiUrlEquipamentos()}/equipamentos/${id}/diagnostico`
            : `${apiUrlEquipamentos()}/equipamentos/diagnostico`;
        const resp = await fetch(url, {
            method: id ? 'GET' : 'POST',
            headers: headersEquipamentos(),
            body: id ? undefined : JSON.stringify({ completo: true })
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error);
        if (id && body.diagnostico) {
            abrirModalDiagnostico(body);
        } else {
            showNotification(body.mensagem || 'Diagnóstico geral concluído', 'info');
        }
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}
