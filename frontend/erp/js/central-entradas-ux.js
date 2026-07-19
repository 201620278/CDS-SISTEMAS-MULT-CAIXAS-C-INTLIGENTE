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
        const texto = String(data).trim();
        // Data pura (YYYY-MM-DD): evita shift de fuso ao usar Date UTC.
        const soData = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (soData) {
            return { data: `${soData[3]}/${soData[2]}/${soData[1]}`, hora: '' };
        }
        const d = new Date(texto);
        if (Number.isNaN(d.getTime())) return { data: texto, hora: '' };
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

    /**
     * RC7.5 — Helpers operacionais (somente apresentação).
     */

    function formatarDuracaoHumanaCentral(ms, agora = Date.now()) {
        const n = Number(ms);
        if (n == null || Number.isNaN(n)) return '—';
        const seg = Math.max(0, Math.floor(n / 1000));
        if (seg < 60) return `${seg}s`;
        if (seg < 3600) {
            const m = Math.floor(seg / 60);
            return m === 1 ? '1 minuto' : `${m} minutos`;
        }
        if (seg < 86400) {
            const h = Math.floor(seg / 3600);
            return h === 1 ? '1 hora' : `${h} horas`;
        }
        const d = Math.floor(seg / 86400);
        return d === 1 ? '1 dia' : `${d} dias`;
    }

    function formatarCountdownCentral(alvoIso, agora = Date.now()) {
        if (!alvoIso) return { label: '—', faltam: '—', restanteMs: 0, esgotado: true };
        const alvo = new Date(alvoIso).getTime();
        if (Number.isNaN(alvo)) return { label: '—', faltam: '—', restanteMs: 0, esgotado: true };
        const restante = Math.max(0, alvo - agora);
        const totalSeg = Math.floor(restante / 1000);
        const h = Math.floor(totalSeg / 3600);
        const m = Math.floor((totalSeg % 3600) / 60);
        const s = totalSeg % 60;
        let faltam = '';
        if (h > 0) faltam = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        else faltam = `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        const hora = formatarDataHoraSeparadoCentral(alvoIso);
        return {
            label: hora.hora !== '—' ? hora.hora : formatarDataHoraSeparadoCentral(alvoIso).data,
            dataHora: `${hora.data} ${hora.hora}`.trim(),
            faltam: restante <= 0 ? 'agora' : faltam,
            restanteMs: restante,
            esgotado: restante <= 0
        };
    }

    function mensagemAmigavelCentral(chave, fallback) {
        const mapa = {
            AGUARDANDO_XML_COMPLETO: 'Aguardando a disponibilização do XML completo pela SEFAZ.',
            ERRO: 'Consulta temporariamente indisponível.',
            CONSUMO_INDEVIDO: 'A SEFAZ solicitou um intervalo antes da próxima consulta.',
            '656': 'A SEFAZ solicitou um intervalo antes da próxima consulta.',
            MANIFESTACAO_ACEITA: 'Manifestação registrada com sucesso. O sistema continuará consultando automaticamente a SEFAZ.',
            '137': '137 — Nenhum documento localizado',
            '138': '138 — Documento localizado',
            '593': '593 — Configuração de certificado/CNPJ inválida'
        };
        return mapa[chave] || fallback || chave || '—';
    }

    function resolverDataDocumentoCentral(doc) {
        const emissao = doc?.dataEmissao || doc?.data_emissao || null;
        if (emissao) {
            return { valor: emissao, fonte: 'dataEmissao', ...formatarDataHoraSeparadoCentral(emissao) };
        }
        const dh = doc?.dhRecbto || doc?.dh_recbto || doc?.dataRecebimento || null;
        if (dh) {
            return { valor: dh, fonte: 'dhRecbto', ...formatarDataHoraSeparadoCentral(dh) };
        }
        return { valor: null, fonte: null, data: '—', hora: '' };
    }

    function resolverChipEtapaCentral(doc, wait) {
        const status = doc?.status || '';
        if (status === 'ERRO') {
            return { codigo: 'ERRO', label: 'Erro', indicador: '🔴', cor: '#dc3545' };
        }
        if (status === 'GRAVADA' || status === 'EM_COMPRA') {
            return { codigo: 'COMPRA', label: 'Compra criada', indicador: '🟢', cor: '#198754' };
        }
        if (status === 'AGUARDANDO_REVISAO' || status === 'REVISADA' || status === 'PRONTA_PARA_COMPRA') {
            return { codigo: 'MIIP', label: 'MIIP', indicador: '🟠', cor: '#fd7e14' };
        }
        if (status === 'EM_PROCESSAMENTO') {
            return { codigo: 'PARSER', label: 'Parser', indicador: '🟣', cor: '#6610f2' };
        }
        if (status === 'AGUARDANDO_XML_COMPLETO') {
            if (wait?.consultaBloqueada || wait?.bloqueio656?.ativo) {
                return { codigo: 'CONSULTANDO', label: 'Aguardando intervalo SEFAZ', indicador: '🔵', cor: '#0dcaf0' };
            }
            return { codigo: 'AGUARDANDO_XML', label: 'Aguardando XML', indicador: '🟡', cor: '#f59e0b' };
        }
        if (['SINCRONIZADA', 'RECEBIDA'].includes(status) && (doc?.tipoDocumento === 'PROC_NFE' || doc?.tipoDocumento === 'NFE')) {
            return { codigo: 'XML_RECEBIDO', label: 'XML Recebido', indicador: '🟢', cor: '#198754' };
        }
        return { codigo: 'RECEBIDO', label: 'Recebido', indicador: '🟢', cor: '#0d6efd' };
    }

    function _buscarHistoricoStatus(historico, pred) {
        const lista = Array.isArray(historico) ? historico : [];
        for (let i = 0; i < lista.length; i += 1) {
            const h = lista[i];
            if (pred(h)) return h;
        }
        return null;
    }

    function montarEtapasOperacionaisCentral(doc, historico, wait) {
        const hist = Array.isArray(historico) ? [...historico] : [];
        hist.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

        const hRes = _buscarHistoricoStatus(hist, (h) =>
            h.statusNovo === 'SINCRONIZADA' || h.statusNovo === 'AGUARDANDO_XML_COMPLETO' || /RES_NFE|receb/i.test(h.detalhe || ''));
        const hManif = _buscarHistoricoStatus(hist, (h) =>
            /MANIFESTACAO_ACEITA|CIENCIA|manifest/i.test(String(h.detalhe || '') + String(h.tipo || ''))
            || (h.statusAnterior === 'AGUARDANDO_XML_COMPLETO' && h.statusNovo === 'AGUARDANDO_XML_COMPLETO'));
        const hXml = _buscarHistoricoStatus(hist, (h) =>
            h.statusNovo === 'SINCRONIZADA' && (doc?.tipoDocumento === 'PROC_NFE' || doc?.tipoDocumento === 'NFE'))
            || (doc?.tipoDocumento === 'PROC_NFE' || doc?.tipoDocumento === 'NFE'
                ? { createdAt: doc.processadoEm || doc.updatedAt } : null);
        const hParser = _buscarHistoricoStatus(hist, (h) =>
            h.statusNovo === 'EM_PROCESSAMENTO' || /PARSER/i.test(h.detalhe || ''));
        const hMiip = _buscarHistoricoStatus(hist, (h) =>
            ['AGUARDANDO_REVISAO', 'REVISADA', 'PRONTA_PARA_COMPRA'].includes(h.statusNovo) || /MIIP/i.test(h.detalhe || ''));
        const hCompra = _buscarHistoricoStatus(hist, (h) =>
            ['GRAVADA', 'EM_COMPRA'].includes(h.statusNovo));

        const status = doc?.status || '';
        const xmlCompleto = ['PROC_NFE', 'NFE'].includes(doc?.tipoDocumento)
            && status !== 'AGUARDANDO_XML_COMPLETO';

        const etapas = [
            {
                id: 'recebido',
                label: 'Recebido',
                detalhe: 'RES_NFE / documento na Central',
                icone: 'fa-inbox',
                em: hRes?.createdAt || doc?.createdAt || null,
                concluida: true,
                ativa: false
            },
            {
                id: 'manifestacao',
                label: 'Manifestação',
                detalhe: mensagemAmigavelCentral('MANIFESTACAO_ACEITA'),
                icone: 'fa-file-signature',
                em: hManif?.createdAt || (status !== 'RECEBIDA' ? (hRes?.createdAt || null) : null),
                concluida: !['RECEBIDA'].includes(status) || Boolean(hManif),
                ativa: false
            },
            {
                id: 'xml',
                label: 'XML Completo',
                detalhe: status === 'AGUARDANDO_XML_COMPLETO'
                    ? mensagemAmigavelCentral('AGUARDANDO_XML_COMPLETO')
                    : 'PROC_NFE disponível',
                icone: 'fa-file-code',
                em: xmlCompleto ? (hXml?.createdAt || doc?.updatedAt) : (wait?.ultimaConsulta || null),
                concluida: xmlCompleto,
                ativa: status === 'AGUARDANDO_XML_COMPLETO'
            },
            {
                id: 'parser',
                label: 'Parser',
                detalhe: 'Extração estruturada da NF-e',
                icone: 'fa-cogs',
                em: hParser?.createdAt || null,
                concluida: Boolean(hParser) || ['AGUARDANDO_REVISAO', 'REVISADA', 'PRONTA_PARA_COMPRA', 'EM_COMPRA', 'GRAVADA'].includes(status),
                ativa: status === 'EM_PROCESSAMENTO'
            },
            {
                id: 'miip',
                label: 'MIIP',
                detalhe: 'Identificação de produtos',
                icone: 'fa-brain',
                em: hMiip?.createdAt || null,
                concluida: ['AGUARDANDO_REVISAO', 'REVISADA', 'PRONTA_PARA_COMPRA', 'EM_COMPRA', 'GRAVADA'].includes(status),
                ativa: status === 'AGUARDANDO_REVISAO'
            },
            {
                id: 'compras',
                label: 'Compras',
                detalhe: 'Compra criada / gravada',
                icone: 'fa-shopping-cart',
                em: hCompra?.createdAt || null,
                concluida: ['GRAVADA', 'EM_COMPRA'].includes(status),
                ativa: status === 'EM_COMPRA'
            }
        ];

        // Tempos entre etapas
        for (let i = 0; i < etapas.length; i += 1) {
            const atual = etapas[i].em ? new Date(etapas[i].em).getTime() : null;
            const prev = i > 0 && etapas[i - 1].em ? new Date(etapas[i - 1].em).getTime() : null;
            if (atual && prev && atual >= prev) {
                etapas[i].duracaoMs = atual - prev;
                etapas[i].duracaoLabel = formatarDuracaoHumanaCentral(atual - prev);
            } else {
                etapas[i].duracaoMs = null;
                etapas[i].duracaoLabel = null;
            }
            const dt = etapas[i].em ? formatarDataHoraSeparadoCentral(etapas[i].em) : { data: '—', hora: '—' };
            etapas[i].horaLabel = dt.hora;
            etapas[i].dataLabel = dt.data;
            etapas[i].statusLabel = etapas[i].concluida ? 'Concluído' : (etapas[i].ativa ? 'Em andamento' : 'Pendente');
        }

        const concluidas = etapas.filter((e) => e.concluida).length;
        return { etapas, progresso: concluidas / etapas.length, concluidas, total: etapas.length };
    }

    function renderBarraProgressoOperacionalCentral(modelo) {
        const total = modelo?.total || 6;
        const ok = modelo?.concluidas || 0;
        const blocos = Array.from({ length: total }, (_, i) => {
            const filled = i < ok;
            return `<span class="central-rc75-progress-block ${filled ? 'is-on' : ''}" aria-hidden="true"></span>`;
        }).join('');
        return `
            <div class="central-rc75-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"
                 aria-valuenow="${ok}" aria-label="Progresso do documento ${ok} de ${total}">
                <div class="central-rc75-progress-track">${blocos}</div>
                <div class="central-rc75-progress-labels">
                    ${(modelo?.etapas || []).map((e) => `<span class="${e.concluida ? 'is-on' : ''}" title="${escapeUx(e.label)}">${escapeUx(e.label)}</span>`).join('')}
                </div>
            </div>`;
    }

    function renderTimelineOperacionalCentral(modelo) {
        const etapas = modelo?.etapas || [];
        if (!etapas.length) return '';
        return `
            <div class="central-rc75-timeline" role="list" aria-label="Linha do tempo operacional">
                ${etapas.map((e, i) => `
                    <div class="central-rc75-timeline-item central-rc75-timeline-item--${e.concluida ? 'ok' : (e.ativa ? 'ativo' : 'pendente')}" role="listitem">
                        ${i > 0 ? `<div class="central-rc75-timeline-gap" aria-hidden="true">
                            <span>↓</span>
                            ${e.duracaoLabel ? `<small>(${escapeUx(e.duracaoLabel)})</small>` : ''}
                        </div>` : ''}
                        <div class="central-rc75-timeline-card">
                            <span class="central-rc75-timeline-icone"><i class="fas ${e.icone}"></i></span>
                            <div class="central-rc75-timeline-body">
                                <strong>${escapeUx(e.label)}</strong>
                                <div class="central-rc75-timeline-meta">
                                    <span>${escapeUx(e.horaLabel || '—')}</span>
                                    <span class="central-rc75-pill">${escapeUx(e.statusLabel)}</span>
                                </div>
                                <small class="text-muted">${escapeUx(e.detalhe || '')}</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }

    function renderChipEtapaCentral(chip) {
        if (!chip) return '';
        return `<span class="central-rc75-chip" style="--chip-cor:${chip.cor || '#64748b'}" title="${escapeUx(chip.label)}">
            <span aria-hidden="true">${escapeUx(chip.indicador || '')}</span> ${escapeUx(chip.label)}
        </span>`;
    }

    function renderCardXmlWaitOperacionalCentral(doc, wait, opcoes = {}) {
        if (doc?.status !== 'AGUARDANDO_XML_COMPLETO') return '';
        const w = wait || {};
        const agora = opcoes.agora || Date.now();
        const proxima = w.proximaTentativa || w.bloqueio656?.bloqueadoAte || null;
        const cd = formatarCountdownCentral(proxima, agora);
        const tempoAguardando = w.tempoAguardandoMs != null
            ? formatarDuracaoHumanaCentral(w.tempoAguardandoMs)
            : (w.iniciadoEm
                ? formatarDuracaoHumanaCentral(agora - new Date(w.iniciadoEm).getTime())
                : (w.tempoAguardandoLabel || '—'));
        const backoff = w.bloqueio656?.intervaloMs
            ? formatarDuracaoHumanaCentral(w.bloqueio656.intervaloMs)
            : (opcoes.backoffLabel || '—');
        const ultimoCstat = opcoes.ultimoCStat
            || w.bloqueio656?.cStat
            || w.estado593?.cStat
            || null;
        const ultimoRetorno = ultimoCstat
            ? mensagemAmigavelCentral(String(ultimoCstat), `${ultimoCstat}`)
            : 'Aguardando retorno da SEFAZ';

        let statusMsg = mensagemAmigavelCentral('AGUARDANDO_XML_COMPLETO');
        if (w.estado593?.ativo || w.configuracaoInvalida) {
            statusMsg = 'Configuração de certificado/CNPJ inválida. Consultas suspensas.';
        } else if (w.bloqueio656?.ativo || w.consultaBloqueada) {
            statusMsg = mensagemAmigavelCentral('CONSUMO_INDEVIDO');
        }

        return `
            <div class="central-rc75-xml-card central-entradas-anim-in" id="centralRc75XmlCard" data-doc-id="${escapeUx(doc.id)}">
                <div class="central-rc75-xml-card__title">
                    <i class="fas fa-file-import me-1" aria-hidden="true"></i> XML Completo
                    ${renderChipEtapaCentral(resolverChipEtapaCentral(doc, w))}
                </div>
                <div class="central-rc75-xml-grid">
                    <div><span class="central-rc75-k">Status</span><span class="central-rc75-v" data-central-live="status-msg">${escapeUx(statusMsg)}</span></div>
                    <div><span class="central-rc75-k">Última consulta</span><span class="central-rc75-v" data-central-live="ultima-consulta">${escapeUx(w.ultimaConsulta ? formatarDataHoraSeparadoCentral(w.ultimaConsulta).data + ' ' + formatarDataHoraSeparadoCentral(w.ultimaConsulta).hora : '—')}</span></div>
                    <div><span class="central-rc75-k">Próxima tentativa</span><span class="central-rc75-v" data-central-live="proxima-consulta" data-central-target="${escapeUx(proxima || '')}">${escapeUx(cd.dataHora || '—')}</span></div>
                    <div><span class="central-rc75-k">Faltam</span><span class="central-rc75-v central-rc75-countdown" data-central-live="countdown" data-central-target="${escapeUx(proxima || '')}">${escapeUx(cd.faltam)}</span></div>
                    <div><span class="central-rc75-k">Tempo aguardando</span><span class="central-rc75-v" data-central-live="tempo-aguardando" data-central-inicio="${escapeUx(w.iniciadoEm || '')}">${escapeUx(tempoAguardando)}</span></div>
                    <div><span class="central-rc75-k">Tentativas realizadas</span><span class="central-rc75-v">${escapeUx(String(w.tentativas ?? 0))}</span></div>
                    <div><span class="central-rc75-k">Backoff atual</span><span class="central-rc75-v">${escapeUx(backoff)}</span></div>
                    <div><span class="central-rc75-k">Último retorno SEFAZ</span><span class="central-rc75-v">${escapeUx(ultimoRetorno)}</span></div>
                </div>
            </div>`;
    }

    function renderInfoTecnicasRecolhivelCentral(ctx = {}) {
        const doc = ctx.doc || {};
        const wait = ctx.wait || {};
        const sefaz = ctx.sefaz || {};
        const statusBg = ctx.statusBg || {};
        return `
            <details class="central-rc75-tech">
                <summary><i class="fas fa-microchip me-1"></i> Informações Técnicas</summary>
                <div class="central-rc75-tech-grid">
                    <div><span class="central-rc75-k">Documento</span><span class="central-rc75-v">${escapeUx(doc.id ?? '—')}</span></div>
                    <div><span class="central-rc75-k">NSU</span><span class="central-rc75-v">${escapeUx(doc.nsu || wait.nsu || '—')}</span></div>
                    <div><span class="central-rc75-k">Chave</span><span class="central-rc75-v text-break">${escapeUx(doc.chave || '—')}</span></div>
                    <div><span class="central-rc75-k">Último cStat</span><span class="central-rc75-v">${escapeUx(sefaz.ultimoCStat || wait.bloqueio656?.cStat || '—')}</span></div>
                    <div><span class="central-rc75-k">CorrelationId</span><span class="central-rc75-v text-break">${escapeUx(wait.correlationId || sefaz.ultimaRespostaSEFAZ?.correlationId || '—')}</span></div>
                    <div><span class="central-rc75-k">RequestId</span><span class="central-rc75-v text-break">${escapeUx(sefaz.ultimaRespostaSEFAZ?.requestId || '—')}</span></div>
                    <div><span class="central-rc75-k">Endpoint</span><span class="central-rc75-v text-break">${escapeUx(sefaz.ultimaRespostaSEFAZ?.endpoint || '—')}</span></div>
                    <div><span class="central-rc75-k">SOAP / Economia</span><span class="central-rc75-v">${escapeUx(String(sefaz.consultasSOAP ?? '—'))} / ${escapeUx(String(sefaz.economiaSOAP ?? sefaz.consultasEvitadas ?? '—'))}</span></div>
                    <div><span class="central-rc75-k">Tempo</span><span class="central-rc75-v">${escapeUx(sefaz.tempoMedio || '—')}</span></div>
                    <div><span class="central-rc75-k">XML Wait</span><span class="central-rc75-v">${escapeUx(statusBg.xmlWait?.ativo || wait.aguardandoXml ? 'ATIVO' : '—')}</span></div>
                    <div><span class="central-rc75-k">Gate</span><span class="central-rc75-v">${escapeUx(sefaz.estadoOperacional?.codigo || 'ATIVO')}</span></div>
                    <div><span class="central-rc75-k">Background</span><span class="central-rc75-v">${escapeUx(statusBg.servicoAtivo ? 'ATIVO' : (statusBg.background?.status || '—'))}</span></div>
                    <div><span class="central-rc75-k">Scheduler</span><span class="central-rc75-v">${escapeUx(statusBg.xmlWait?.ativo || statusBg.syncAutomaticaHabilitada ? 'ATIVO' : '—')}</span></div>
                </div>
            </details>`;
    }

    function renderPainelSaudeSefazCentral(sefaz, statusBg = {}) {
        const est = sefaz?.estadoOperacional || { indicador: '🟢', label: 'Operando normalmente', codigo: 'NORMAL' };
        const label = est.codigo === 'NORMAL' ? 'Operando normalmente' : (est.label || est.codigo);
        return `
            <div class="central-rc75-saude" id="centralRc75Saude" aria-label="SEFAZ Operacional">
                <div class="central-rc75-saude__head">
                    <strong>SEFAZ OPERACIONAL</strong>
                    <span>${escapeUx(est.indicador || '🟢')} ${escapeUx(label)}</span>
                </div>
                <div class="central-rc75-saude__grid">
                    <div><span class="central-rc75-k">Background</span><span class="central-rc75-v" data-central-live="bg-status">${escapeUx(statusBg.servicoAtivo ? 'ATIVO' : 'PARADO')}</span></div>
                    <div><span class="central-rc75-k">XML Wait</span><span class="central-rc75-v" data-central-live="xmlwait-status">${escapeUx(statusBg.xmlWait?.ativo ? 'ATIVO' : (statusBg.xmlWait?.telemetria?.schedulerAtivo ? 'ATIVO' : '—'))}</span></div>
                    <div><span class="central-rc75-k">Operational Gate</span><span class="central-rc75-v">ATIVO</span></div>
                    <div><span class="central-rc75-k">Última consulta</span><span class="central-rc75-v" data-central-live="saude-ultima">${escapeUx(sefaz?.ultimaConsulta ? formatarDataHoraSeparadoCentral(sefaz.ultimaConsulta).hora : '—')}</span></div>
                    <div><span class="central-rc75-k">Consultas realizadas</span><span class="central-rc75-v">${escapeUx(String(sefaz?.consultasSOAP ?? sefaz?.consultasRealizadas ?? '—'))}</span></div>
                    <div><span class="central-rc75-k">Consultas evitadas</span><span class="central-rc75-v">${escapeUx(String(sefaz?.consultasEvitadas ?? sefaz?.economiaSOAP ?? '—'))}</span></div>
                </div>
            </div>`;
    }

    function renderLoadingEtapasCentral(fase = 'preparando') {
        const etapas = [
            { id: 'preparando', label: 'Preparando dados...' },
            { id: 'recebendo', label: 'Recebendo documentos...' },
            { id: 'consultando', label: 'Consultando fornecedores...' },
            { id: 'atualizando', label: 'Atualizando painel...' },
            { id: 'concluido', label: 'Concluído.' }
        ];
        const idx = Math.max(0, etapas.findIndex((e) => e.id === fase));
        return `
            <div class="central-rc75-loading" role="status" aria-live="polite">
                <div class="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true"></div>
                <div>
                    ${etapas.map((e, i) => `
                        <div class="central-rc75-loading-step ${i < idx ? 'is-done' : ''} ${i === idx ? 'is-active' : ''}">
                            ${i < idx ? '✓' : (i === idx ? '…' : '○')} ${escapeUx(e.label)}
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    function atualizarLiveRegionsCentral(root, agora = Date.now()) {
        if (!root || !root.querySelectorAll) return 0;
        let n = 0;
        root.querySelectorAll('[data-central-live="countdown"]').forEach((el) => {
            const alvo = el.getAttribute('data-central-target');
            const cd = formatarCountdownCentral(alvo, agora);
            if (el.textContent !== cd.faltam) {
                el.textContent = cd.faltam;
                n += 1;
            }
        });
        root.querySelectorAll('[data-central-live="tempo-aguardando"]').forEach((el) => {
            const inicio = el.getAttribute('data-central-inicio');
            if (!inicio) return;
            const label = formatarDuracaoHumanaCentral(agora - new Date(inicio).getTime());
            if (el.textContent !== label) {
                el.textContent = label;
                n += 1;
            }
        });
        root.querySelectorAll('[data-central-live="proxima-consulta"]').forEach((el) => {
            const alvo = el.getAttribute('data-central-target');
            if (!alvo) return;
            const cd = formatarCountdownCentral(alvo, agora);
            if (el.textContent !== (cd.dataHora || '—')) {
                el.textContent = cd.dataHora || '—';
                n += 1;
            }
        });
        return n;
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
        renderSkeletonListaDocumentosCentral,
        // RC7.5
        formatarDuracaoHumanaCentral,
        formatarCountdownCentral,
        mensagemAmigavelCentral,
        resolverDataDocumentoCentral,
        resolverChipEtapaCentral,
        montarEtapasOperacionaisCentral,
        renderBarraProgressoOperacionalCentral,
        renderTimelineOperacionalCentral,
        renderChipEtapaCentral,
        renderCardXmlWaitOperacionalCentral,
        renderInfoTecnicasRecolhivelCentral,
        renderPainelSaudeSefazCentral,
        renderLoadingEtapasCentral,
        atualizarLiveRegionsCentral
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (global) {
        global.CentralEntradasUX = api;
    }
})(typeof window !== 'undefined' ? window : global);
