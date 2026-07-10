/**
 * Central Inteligente de Entradas — Sprint 9 (UX Enterprise).
 * Helpers visuais: skeletons, empty states, gauge, tendências KPI, estados de serviço.
 * Sem regras de negócio — apenas apresentação.
 */
(function initCentralEntradasUx(global) {
    const STORAGE_KEY = 'central_entradas_kpi_snapshot_v1';

    const EMPTY_PRESETS = {
        documentos: {
            icone: 'fa-inbox',
            titulo: 'Nenhum documento ainda',
            descricao: 'Sincronize com a SEFAZ para receber notas fiscais na Central.',
            acaoLabel: 'Sincronizar SEFAZ',
            acaoId: 'centralEmptySync'
        },
        pesquisa: {
            icone: 'fa-search',
            titulo: 'Nenhum resultado encontrado',
            descricao: 'Ajuste os filtros ou limpe a pesquisa para ver mais documentos.',
            acaoLabel: 'Limpar filtros',
            acaoId: 'centralEmptyLimparFiltros'
        },
        alertas: {
            icone: 'fa-bell-slash',
            titulo: 'Sem alertas ativos',
            descricao: 'Não há situações que exijam atenção imediata no momento.'
        },
        pendencias: {
            icone: 'fa-check-circle',
            titulo: 'Sem pendências',
            descricao: 'Todas as notas estão em dia. Nenhuma ação pendente.'
        },
        notificacoes: {
            icone: 'fa-bell',
            titulo: 'Sem notificações',
            descricao: 'Você está em dia. Novos avisos aparecerão aqui.'
        },
        historico: {
            icone: 'fa-history',
            titulo: 'Sem eventos no histórico',
            descricao: 'As transições de status do documento serão registradas aqui.'
        },
        selecao: {
            icone: 'fa-hand-pointer',
            titulo: 'Selecione um documento',
            descricao: 'Clique em uma linha da grade para ver detalhes, itens e histórico.'
        }
    };

    function escapeUx(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderEmptyStateCentral(tipo, overrides = {}) {
        const preset = { ...EMPTY_PRESETS[tipo], ...overrides };
        if (!preset.titulo) return '';

        const acao = preset.acaoLabel && preset.acaoId
            ? `<button type="button" class="btn btn-sm btn-outline-primary mt-2" id="${escapeUx(preset.acaoId)}">${escapeUx(preset.acaoLabel)}</button>`
            : '';

        return `
            <div class="central-ux-empty central-entradas-anim-in" role="status" aria-live="polite">
                <div class="central-ux-empty-icone" aria-hidden="true">
                    <i class="fas ${escapeUx(preset.icone || 'fa-inbox')}"></i>
                </div>
                <div class="central-ux-empty-titulo">${escapeUx(preset.titulo)}</div>
                <div class="central-ux-empty-descricao">${escapeUx(preset.descricao || '')}</div>
                ${acao}
            </div>`;
    }

    function renderSkeletonBlock(linhas = 1, classe = '') {
        const rows = Array.from({ length: linhas }, () => '<div class="central-ux-skeleton-line"></div>').join('');
        return `<div class="central-ux-skeleton ${classe}" aria-hidden="true">${rows}</div>`;
    }

    function renderSkeletonKpisCentral(qtd = 6) {
        return Array.from({ length: qtd }, () => `
            <div class="col-6 col-md-4 col-xl-2">
                <div class="central-entradas-kpi central-ux-skeleton-kpi" aria-busy="true" aria-label="Carregando indicadores">
                    <div class="central-ux-skeleton central-ux-skeleton-circle"></div>
                    <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--lg"></div>
                    <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--sm"></div>
                </div>
            </div>
        `).join('');
    }

    function renderSkeletonIndicadoresCentral() {
        return `
            <div class="central-entradas-indicadores central-ux-skeleton-indicadores" aria-busy="true" aria-label="Carregando monitoramento">
                ${Array.from({ length: 3 }, () => `
                    <div class="central-entradas-indicador">
                        <div class="central-ux-skeleton central-ux-skeleton-circle central-ux-skeleton-circle--sm"></div>
                        <div class="flex-grow-1">
                            <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--xs"></div>
                            <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--md mt-1"></div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    function renderSkeletonGridCentral(linhas = 6) {
        return Array.from({ length: linhas }, () => `
            <tr class="central-ux-skeleton-row" aria-hidden="true">
                <td><div class="central-ux-skeleton central-ux-skeleton-circle central-ux-skeleton-circle--xs"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line"></div><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--xs mt-1"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--sm"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--xs"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--sm"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--xs"></div></td>
                <td><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--md"></div></td>
            </tr>
        `).join('');
    }

    function renderSkeletonPainelCentral() {
        return `
            <div class="card h-100 central-entradas-painel-card" aria-busy="true" aria-label="Carregando detalhe">
                <div class="card-header"><div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--md"></div></div>
                <div class="card-body">
                    <div class="d-flex justify-content-center mb-3">
                        <div class="central-ux-skeleton central-ux-skeleton-gauge"></div>
                    </div>
                    ${renderSkeletonBlock(4)}
                    <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--lg mt-3"></div>
                    <div class="central-ux-skeleton central-ux-skeleton-line mt-2"></div>
                </div>
            </div>`;
    }

    function renderSkeletonTimelineCentral() {
        return `
            <div class="central-entradas-timeline-enterprise" aria-busy="true" aria-label="Carregando histórico">
                ${Array.from({ length: 4 }, () => `
                    <div class="central-entradas-timeline-enterprise-item central-ux-skeleton-timeline-item">
                        <div class="central-ux-skeleton central-ux-skeleton-circle"></div>
                        <div class="flex-grow-1">
                            <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--md"></div>
                            <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--sm mt-1"></div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    function renderSkeletonPainelBlocoCentral() {
        return `
            <div class="py-2" aria-busy="true">
                ${renderSkeletonBlock(3)}
            </div>`;
    }

    function corScoreCentral(score) {
        const n = Number(score);
        if (Number.isNaN(n)) return '#94a3b8';
        if (n >= 80) return '#198754';
        if (n >= 60) return '#0d6efd';
        if (n >= 40) return '#fd7e14';
        return '#dc3545';
    }

    function descricaoScoreCentral(score) {
        const n = Number(score);
        if (Number.isNaN(n)) return 'Score indisponível';
        if (n >= 80) return 'Excelente — documento em ótima condição';
        if (n >= 60) return 'Bom — poucas pendências';
        if (n >= 40) return 'Atenção — revisar antes de lançar';
        return 'Crítico — ação necessária';
    }

    function renderGaugeScoreCentral(score, cor, opcoes = {}) {
        const n = score != null ? Math.max(0, Math.min(100, Number(score))) : null;
        const corFinal = cor || corScoreCentral(n);
        const tamanho = opcoes.tamanho || 96;
        const raio = (tamanho - 10) / 2;
        const circ = 2 * Math.PI * raio;
        const offset = n != null ? circ - (n / 100) * circ : circ;
        const descricao = opcoes.descricao || descricaoScoreCentral(n);
        const valorTexto = n != null ? `${Math.round(n)}%` : '—';

        return `
            <div class="central-ux-gauge central-entradas-anim-in"
                 style="--gauge-cor:${escapeUx(corFinal)}; --gauge-size:${tamanho}px"
                 role="img"
                 aria-label="Score geral ${valorTexto}. ${escapeUx(descricao)}"
                 title="${escapeUx(descricao)}">
                <svg class="central-ux-gauge-svg" viewBox="0 0 ${tamanho} ${tamanho}" aria-hidden="true">
                    <circle class="central-ux-gauge-track" cx="${tamanho / 2}" cy="${tamanho / 2}" r="${raio}"></circle>
                    <circle class="central-ux-gauge-fill" cx="${tamanho / 2}" cy="${tamanho / 2}" r="${raio}"
                        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle>
                </svg>
                <div class="central-ux-gauge-valor">${escapeUx(valorTexto)}</div>
                <div class="central-ux-gauge-label">Score</div>
            </div>
            ${opcoes.mostrarDescricao !== false
                ? `<div class="central-ux-gauge-descricao text-center small text-muted mt-1">${escapeUx(descricao)}</div>`
                : ''}`;
    }

    function calcularTendenciaKpiCentral(atual, anterior) {
        const a = Number(atual);
        const p = Number(anterior);
        if (Number.isNaN(a) || Number.isNaN(p)) {
            return { simbolo: '=', direcao: 'neutro', texto: 'Sem histórico', classe: 'central-ux-trend--neutro' };
        }
        const diff = a - p;
        if (diff === 0) {
            return { simbolo: '=', direcao: 'estavel', texto: 'Estável vs período anterior', classe: 'central-ux-trend--estavel' };
        }
        if (diff > 0) {
            return { simbolo: '▲', direcao: 'alta', texto: `+${diff} vs período anterior`, classe: 'central-ux-trend--alta' };
        }
        return { simbolo: '▼', direcao: 'baixa', texto: `${diff} vs período anterior`, classe: 'central-ux-trend--baixa' };
    }

    function renderTendenciaKpiCentral(atual, anterior, invertido = false) {
        let trend = calcularTendenciaKpiCentral(atual, anterior);
        if (invertido && trend.direcao === 'alta') trend = { ...trend, classe: 'central-ux-trend--baixa' };
        if (invertido && trend.direcao === 'baixa') trend = { ...trend, classe: 'central-ux-trend--alta' };

        return `
            <div class="central-ux-trend ${trend.classe}" title="${escapeUx(trend.texto)}" aria-label="${escapeUx(trend.texto)}">
                <span class="central-ux-trend-simbolo" aria-hidden="true">${trend.simbolo}</span>
                <span class="central-ux-trend-texto">${escapeUx(trend.texto)}</span>
            </div>`;
    }

    function obterSnapshotKpisCentral() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function salvarSnapshotKpisCentral(dashboard, operacional) {
        try {
            const snapshot = {
                savedAt: new Date().toISOString(),
                contadores: dashboard?.contadores || {},
                operacional: operacional || {}
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch { /* ignore quota */ }
    }

    function resolverEstadoServicoCentral(state) {
        const s = state.servicoStatus || {};
        const executando = s.executando || state.sincronizando;
        const syncAuto = s.syncAutomaticaHabilitada || s.servicoAtivo;
        const ultimo = s.ultimoResultado || {};
        const erroRecente = ultimo.sucesso === false && !executando;

        if (!navigator.onLine) {
            return {
                codigo: 'offline',
                label: 'Offline',
                descricao: 'Sem conexão com a internet',
                icone: 'fa-wifi',
                classe: 'central-ux-servico--offline'
            };
        }
        if (executando) {
            return {
                codigo: 'sincronizando',
                label: 'Sincronizando',
                descricao: 'Buscando documentos na SEFAZ',
                icone: 'fa-sync-alt fa-spin',
                classe: 'central-ux-servico--sincronizando'
            };
        }
        if (erroRecente) {
            return {
                codigo: 'erro',
                label: 'Erro na última execução',
                descricao: ultimo.mensagem || 'Verifique o log operacional',
                icone: 'fa-exclamation-triangle',
                classe: 'central-ux-servico--erro'
            };
        }
        if (syncAuto) {
            return {
                codigo: 'monitorando',
                label: 'Monitorando',
                descricao: 'Serviço automático ativo',
                icone: 'fa-satellite-dish',
                classe: 'central-ux-servico--monitorando'
            };
        }
        return {
            codigo: 'aguardando',
            label: 'Aguardando',
            descricao: 'Sincronização manual — serviço em repouso',
            icone: 'fa-pause-circle',
            classe: 'central-ux-servico--aguardando'
        };
    }

    function formatarDataHoraSeparadoCentral(data) {
        if (!data) return { data: '—', hora: '—' };
        const d = new Date(data);
        if (Number.isNaN(d.getTime())) return { data: String(data), hora: '' };
        return {
            data: d.toLocaleDateString('pt-BR'),
            hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    }

    function inferirOrigemTimelineCentral(item) {
        const detalhe = String(item.detalhe || '').toLowerCase();
        if (detalhe.includes('dfe') || detalhe.includes('sefaz')) return 'SEFAZ / DF-e';
        if (detalhe.includes('compra')) return 'Compras';
        if (detalhe.includes('miip') || detalhe.includes('revis')) return 'MIIP';
        if (detalhe.includes('upload') || detalhe.includes('manual')) return 'Upload manual';
        if (detalhe.includes('chave')) return 'Consulta por chave';
        if (item.usuarioId) return 'Usuário';
        return 'Pipeline automático';
    }

    function avatarFornecedorCentral(nome) {
        const texto = String(nome || '?').trim();
        const iniciais = texto.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
        let hash = 0;
        for (let i = 0; i < texto.length; i += 1) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
        const cores = ['#0d6efd', '#6610f2', '#198754', '#fd7e14', '#20c997', '#6f42c1', '#0dcaf0'];
        const cor = cores[Math.abs(hash) % cores.length];
        return { iniciais, cor };
    }

    function badgeStatusUx1(status, label) {
        const mapa = {
            PRONTA_PARA_COMPRA: { classe: 'central-ux1-badge--verde', texto: 'Pronta para Importar' },
            REVISADA: { classe: 'central-ux1-badge--verde', texto: 'Pronta para Importar' },
            AGUARDANDO_REVISAO: { classe: 'central-ux1-badge--amarelo', texto: 'Aguardando Revisão' },
            EM_PROCESSAMENTO: { classe: 'central-ux1-badge--azul', texto: 'Processando' },
            GRAVADA: { classe: 'central-ux1-badge--cinza', texto: 'Importada' },
            ERRO: { classe: 'central-ux1-badge--vermelho', texto: 'Erro' },
            DUPLICADA: { classe: 'central-ux1-badge--vermelho', texto: 'Duplicada' },
            DESCARTADA: { classe: 'central-ux1-badge--cinza', texto: 'Cancelada' },
            SINCRONIZADA: { classe: 'central-ux1-badge--azul', texto: 'Nova' }
        };
        const meta = mapa[status] || { classe: 'central-ux1-badge--cinza', texto: label || status || '—' };
        return `<span class="central-ux1-badge ${meta.classe}" title="${escapeUx(meta.texto)}">${escapeUx(label || meta.texto)}</span>`;
    }

    function renderPipelineTimelineUx1(doc, historico) {
        const status = doc?.status || 'RECEBIDA';
        const ordem = ['RECEBIDA', 'SINCRONIZADA', 'EM_PROCESSAMENTO', 'AGUARDANDO_REVISAO', 'REVISADA', 'PRONTA_PARA_COMPRA', 'EM_COMPRA', 'GRAVADA'];
        const idxAtual = Math.max(0, ordem.indexOf(status));
        const etapas = [
            { label: 'NF Recebida', icone: 'fa-inbox', minIdx: 0 },
            { label: 'Download XML', icone: 'fa-cloud-download-alt', minIdx: 1 },
            { label: 'Parser', icone: 'fa-file-code', minIdx: 2 },
            { label: 'MIIP', icone: 'fa-brain', minIdx: 2 },
            { label: 'Central Revisão', icone: 'fa-user-check', minIdx: 3 },
            { label: 'Compra', icone: 'fa-shopping-cart', minIdx: 5 },
            { label: 'Finalizado', icone: 'fa-check-circle', minIdx: 7 }
        ];

        const historicoPorStatus = {};
        (historico || []).forEach((h) => {
            if (h.statusNovo && !historicoPorStatus[h.statusNovo]) {
                historicoPorStatus[h.statusNovo] = h.createdAt;
            }
        });

        return `
            <div class="central-ux1-pipeline" role="list" aria-label="Pipeline do documento">
                ${etapas.map((etapa, i) => {
                    const concluida = idxAtual >= etapa.minIdx || status === 'GRAVADA';
                    const ativa = idxAtual === etapa.minIdx && status !== 'GRAVADA' && status !== 'ERRO';
                    const erro = status === 'ERRO' && i === etapas.length - 1;
                    const hora = historicoPorStatus[ordem[etapa.minIdx]]
                        ? formatarDataHoraSeparadoCentral(historicoPorStatus[ordem[etapa.minIdx]]).hora
                        : '—';
                    const classe = erro ? 'erro' : (concluida ? 'ok' : (ativa ? 'ativo' : 'pendente'));
                    return `
                        <div class="central-ux1-pipeline-item central-ux1-pipeline-item--${classe}" role="listitem">
                            ${i > 0 ? '<div class="central-ux1-pipeline-seta" aria-hidden="true">↓</div>' : ''}
                            <div class="central-ux1-pipeline-card">
                                <span class="central-ux1-pipeline-icone"><i class="fas ${etapa.icone}"></i></span>
                                <div class="central-ux1-pipeline-info">
                                    <strong>${escapeUx(etapa.label)}</strong>
                                    <small>${concluida ? 'Concluído' : (ativa ? 'Em andamento' : 'Aguardando')} · ${escapeUx(hora)}</small>
                                </div>
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    }

    function renderSkeletonListaDocumentosCentral(qtd = 6) {
        return Array.from({ length: qtd }, () => `
            <div class="central-ux1-doc-card central-ux1-doc-card--skeleton" aria-hidden="true">
                <div class="central-ux-skeleton central-ux-skeleton-circle"></div>
                <div class="flex-grow-1">
                    <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--md"></div>
                    <div class="central-ux-skeleton central-ux-skeleton-line central-ux-skeleton-line--sm mt-1"></div>
                </div>
            </div>
        `).join('');
    }

    function extrairDadosExecutivoCentral(doc, parse, miip, historico) {
        const itens = parse?.parse?.itens || parse?.itens || [];
        const r = miip?.miipResumo?.resumo || miip?.resumo;
        const precisaoMiip = r?.totalItens > 0
            ? Math.round(((r.identificadosAutomaticamente || 0) / r.totalItens) * 100)
            : null;

        let volumeUnidades = 0;
        itens.forEach((item) => { volumeUnidades += Number(item.quantidade || 0); });

        let tempoProcessamento = null;
        if (historico?.length) {
            const inicio = historico.find((h) => h.statusNovo === 'EM_PROCESSAMENTO');
            const fim = [...historico].reverse().find((h) =>
                ['PRONTA_PARA_COMPRA', 'AGUARDANDO_REVISAO', 'GRAVADA', 'ERRO'].includes(h.statusNovo)
            );
            if (inicio?.createdAt && fim?.createdAt) {
                const ms = new Date(fim.createdAt) - new Date(inicio.createdAt);
                if (ms > 0) tempoProcessamento = `${Math.max(1, Math.round(ms / 60000))} min`;
            }
        }

        const valorFrete = parse?.parse?.valor_frete ?? parse?.valor_frete ?? parse?.parse?.valorFrete ?? parse?.valorFrete;
        const transportadora = valorFrete > 0 ? `Frete ${Number(valorFrete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : null;

        return {
            fornecedor: doc?.fornecedor || parse?.parse?.fornecedor || '—',
            cnpjFornecedor: doc?.cnpjFornecedor || parse?.parse?.fornecedor_cnpj || '',
            transportadora: transportadora || 'Não informado na NF-e',
            volumes: itens.length ? `${itens.length} item(ns) · ${volumeUnidades.toLocaleString('pt-BR')} un.` : '—',
            peso: '—',
            pagamento: parse?.parse?.observacao || parse?.observacao || 'A definir em Compras',
            valorTotal: doc?.valorTotal ?? parse?.parse?.valor_total_nota ?? parse?.valor_total_nota,
            qtdItens: itens.length || '—',
            precisaoMiip: precisaoMiip != null ? `${precisaoMiip}%` : '—',
            tempoProcessamento: tempoProcessamento || '—'
        };
    }

    const api = {
        EMPTY_PRESETS,
        escapeUx,
        renderEmptyStateCentral,
        renderSkeletonBlock,
        renderSkeletonKpisCentral,
        renderSkeletonIndicadoresCentral,
        renderSkeletonGridCentral,
        renderSkeletonPainelCentral,
        renderSkeletonTimelineCentral,
        renderSkeletonPainelBlocoCentral,
        corScoreCentral,
        descricaoScoreCentral,
        renderGaugeScoreCentral,
        calcularTendenciaKpiCentral,
        renderTendenciaKpiCentral,
        obterSnapshotKpisCentral,
        salvarSnapshotKpisCentral,
        resolverEstadoServicoCentral,
        formatarDataHoraSeparadoCentral,
        inferirOrigemTimelineCentral,
        extrairDadosExecutivoCentral,
        avatarFornecedorCentral,
        badgeStatusUx1,
        renderPipelineTimelineUx1,
        renderSkeletonListaDocumentosCentral
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (global) {
        global.CentralEntradasUX = api;
    }
})(typeof window !== 'undefined' ? window : global);
