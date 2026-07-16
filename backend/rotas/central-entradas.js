/**
 * Rotas Central Inteligente de Entradas — API do inbox fiscal.
 *
 * Sprint 5: pipeline de processamento, revisão MIIP e bridge Compras.
 *
 * @module rotas/central-entradas
 */

const express = require('express');
const multer = require('multer');
const { exigirDiagnosticoCentral } = require('../middleware/auth');
const CentralEntradasService = require('../motores/central-entradas/CentralEntradasService');
const CentralMigracaoLegadoService = require('../motores/central-entradas/services/CentralMigracaoLegadoService');

const router = express.Router();
const centralEntradasService = new CentralEntradasService();

const uploadXml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (!/\.xml$/i.test(file.originalname || '')) {
      return cb(new Error('Apenas arquivos .xml são permitidos'));
    }
    cb(null, true);
  }
});

function montarFiltrosQuery(query) {
  return {
    status: query.status || null,
    busca: query.busca || null,
    cnpjFornecedor: query.cnpj_fornecedor || null,
    origem: query.origem || null,
    dataEmissaoInicio: query.data_emissao_inicio || null,
    dataEmissaoFim: query.data_emissao_fim || null,
    filtroRapido: query.filtro_rapido || query.filtroRapido || null,
    createdAtInicio: query.created_at_inicio || null,
    createdAtFim: query.created_at_fim || null,
    limite: query.limite != null ? Number(query.limite) : undefined,
    offset: query.offset != null ? Number(query.offset) : undefined,
    pagina: query.pagina != null ? Number(query.pagina) : undefined,
    ordenarPor: query.ordenar_por || query.ordenarPor || null,
    ordenarDirecao: query.ordenar_direcao || query.ordenarDirecao || null
  };
}

router.get('/health', async (req, res) => {
  try {
    const health = await centralEntradasService.obterHealth();
    return res.json(health);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * RC6.5 — Migração idempotente de documentos legados (RES_NFE pré-RC6.2).
 * Não altera Orchestrator/Parser/MIIP/Compras.
 */
router.post('/admin/migrar-legado', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const migracao = new CentralMigracaoLegadoService();
    const resultado = await migracao.executar();
    return res.json({
      analisados: resultado.analisados,
      migrados: resultado.migrados,
      ignorados: resultado.ignorados,
      erros: resultado.erros
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/diagnostico', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const forcar = req.query.forcar === 'true' || req.query.forcar === '1';
    const painel = await centralEntradasService.obterDiagnostico({ forcarAtualizacao: forcar });
    return res.json(painel);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/diagnostico/health-check', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = await centralEntradasService.executarHealthCheckDiagnostico();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/diagnostico/acoes/sincronizar', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = await centralEntradasService.sincronizar({ origem: 'diagnostico' });
    centralEntradasService.limparCacheDiagnostico();
    return res.status(statusHttpSync(resultado)).json({
      ...resultado,
      mensagemAmigavel: resultado.mensagemAmigavel
        || resultado.mensagem
        || (resultado.erros && resultado.erros[0])
        || null
    });
  } catch (error) {
    return res.status(422).json({
      sucesso: false,
      mensagemAmigavel: error.message || 'Falha ao sincronizar pelo diagnóstico.',
      error: error.message
    });
  }
});

router.post('/diagnostico/acoes/reprocessar-pendencias', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = await centralEntradasService.processarDocumentosPendentes({ origem: 'diagnostico' });
    centralEntradasService.limparCacheDiagnostico();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message, sucesso: false });
  }
});

router.post('/diagnostico/acoes/testar-certificado', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = await centralEntradasService.testarCertificadoDiagnostico();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/diagnostico/acoes/testar-sefaz', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = await centralEntradasService.testarSefazDiagnostico();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/diagnostico/acoes/limpar-cache', exigirDiagnosticoCentral, async (req, res) => {
  try {
    const resultado = centralEntradasService.limparCacheDiagnostico();
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/metadados', (req, res) => {
  try {
    return res.json(centralEntradasService.obterMetadados());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await centralEntradasService.obterDashboard();
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/alertas', async (req, res) => {
  try {
    const alertas = await centralEntradasService.listarAlertas();
    return res.json(alertas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/pendencias', async (req, res) => {
  try {
    const pendencias = await centralEntradasService.obterPendencias({
      limite: req.query.limite != null ? Number(req.query.limite) : undefined
    });
    return res.json(pendencias);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/operacional', async (req, res) => {
  try {
    const operacional = await centralEntradasService.obterOperacional();
    return res.json(operacional);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/inteligencia', async (req, res) => {
  try {
    const inteligencia = await centralEntradasService.obterInteligenciaOperacional({
      limitePendencias: req.query.limite != null ? Number(req.query.limite) : 20
    });
    return res.json(inteligencia);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/atencao', async (req, res) => {
  try {
    const atencao = await centralEntradasService.obterItensAtencao();
    return res.json(atencao);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/config', async (req, res) => {
  try {
    const config = await centralEntradasService.obterConfiguracoes();
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/config', async (req, res) => {
  try {
    const config = await centralEntradasService.atualizarConfiguracoes(req.body || {});
    return res.json(config);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const CentralConfiguracaoController = require('../motores/central-entradas/controllers/CentralConfiguracaoController');
const configuracaoController = new CentralConfiguracaoController({
  orchestrator: require('../motores/central-entradas/CentralEntradasOrchestrator')
});

router.get('/configuracao', (req, res) => configuracaoController.obter(req, res));
router.put('/configuracao', (req, res) => configuracaoController.atualizar(req, res));
router.post('/configuracao/restaurar', (req, res) => configuracaoController.restaurarPadrao(req, res));
router.post('/configuracao/testar-sefaz', (req, res) => configuracaoController.testarSefaz(req, res));
router.post('/configuracao/testar-certificado', (req, res) => configuracaoController.testarCertificado(req, res));
router.post('/configuracao/health', (req, res) => configuracaoController.health(req, res));
router.post('/configuracao/limpar-cache', (req, res) => configuracaoController.limparCache(req, res));

router.get('/servico/status', async (req, res) => {
  try {
    const status = centralEntradasService.obterStatusServico();
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/eventos', async (req, res) => {
  try {
    const resultado = await centralEntradasService.listarEventos({
      tipo: req.query.tipo || null,
      origem: req.query.origem || null,
      busca: req.query.busca || null,
      documentoId: req.query.documento_id || req.query.documentoId || null,
      dataInicio: req.query.data_inicio || null,
      dataFim: req.query.data_fim || null,
      sucesso: req.query.sucesso,
      limite: req.query.limite != null ? Number(req.query.limite) : undefined,
      offset: req.query.offset != null ? Number(req.query.offset) : undefined
    });
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/notificacoes', async (req, res) => {
  try {
    const resultado = await centralEntradasService.listarNotificacoes({
      apenasNaoLidas: req.query.apenas_nao_lidas === 'true' || req.query.apenas_nao_lidas === '1',
      limite: req.query.limite != null ? Number(req.query.limite) : undefined
    });
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/notificacoes/marcar-todas-lidas', async (req, res) => {
  try {
    const total = await centralEntradasService.marcarTodasNotificacoesLidas();
    return res.json({ total });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/notificacoes/:id/lida', async (req, res) => {
  try {
    const ok = await centralEntradasService.marcarNotificacaoLida(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Notificação não encontrada' });
    return res.json({ sucesso: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Mapeia resultado de sync para HTTP — RC4: nunca 502 genérico.
 * @param {Object|null} resultado
 * @returns {number}
 */
function statusHttpSync(resultado) {
  if (!resultado) return 200;
  if (resultado.sucesso || resultado.ignorado) return 200;
  if (resultado.codigoErro === 'CERTIFICADO' || resultado.codigoErro === 'CNPJ'
    || resultado.codigoErro === 'CONFIG_FISCAL' || resultado.codigoErro === 'URL_SEFAZ') {
    return 422;
  }
  if (resultado.codigoErro === 'SEFAZ') return 503;
  return 200;
}

/** RC3.4 — Homologação assistida (somente leitura). */
router.get('/homologacao/painel', async (req, res) => {
  try {
    const painel = await centralEntradasService.obterPainelHomologacao({
      limite: req.query.limite != null ? Number(req.query.limite) : undefined
    });
    return res.json(painel);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/homologacao/metricas', async (req, res) => {
  try {
    const metricas = await centralEntradasService.obterMetricasHomologacao();
    return res.json(metricas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/homologacao/:id/inspecionar', async (req, res) => {
  try {
    const inspecao = await centralEntradasService.inspecionarDocumentoHomologacao(req.params.id);
    return res.json(inspecao);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.get('/homologacao/:id/exportar', async (req, res) => {
  try {
    const formato = String(req.query.formato || 'json').toLowerCase() === 'txt' ? 'txt' : 'json';
    const rel = await centralEntradasService.exportarRelatorioHomologacao(req.params.id, formato);
    res.setHeader('Content-Type', rel.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${rel.filename}"`);
    return res.send(rel.corpo);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.post('/sincronizar-ao-abrir', async (req, res) => {
  try {
    const resultado = await centralEntradasService.sincronizarAoAbrir();
    if (!resultado) {
      return res.json({
        ignorado: true,
        sucesso: true,
        motivo: 'sync_ao_abrir desabilitado',
        mensagemAmigavel: 'Sincronização ao abrir está desabilitada nas configurações.'
      });
    }
    return res.status(statusHttpSync(resultado)).json({
      ...resultado,
      mensagemAmigavel: resultado.mensagemAmigavel
        || resultado.mensagem
        || (resultado.erros && resultado.erros[0])
        || null
    });
  } catch (error) {
    return res.status(422).json({
      sucesso: false,
      codigoErro: 'ERRO',
      mensagemAmigavel: error.message || 'Falha ao sincronizar ao abrir a Central.',
      error: error.message
    });
  }
});

router.get('/fornecedor/:cnpj/estatisticas', async (req, res) => {
  try {
    const estatisticas = await centralEntradasService.obterEstatisticasFornecedor(
      req.params.cnpj,
      { periodoDias: req.query.periodo_dias != null ? Number(req.query.periodo_dias) : undefined }
    );

    if (!estatisticas) {
      return res.status(400).json({ error: 'CNPJ inválido' });
    }

    return res.json(estatisticas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const resultado = await centralEntradasService.listarDocumentos(montarFiltrosQuery(req.query));
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/sincronizar', async (req, res) => {
  try {
    const resultado = await centralEntradasService.sincronizar();
    return res.status(statusHttpSync(resultado)).json({
      ...resultado,
      mensagemAmigavel: resultado.mensagemAmigavel
        || resultado.mensagem
        || (resultado.erros && resultado.erros[0])
        || null
    });
  } catch (error) {
    return res.status(422).json({
      sucesso: false,
      mensagemAmigavel: error.message || 'Falha na sincronização.',
      error: error.message
    });
  }
});

router.get('/buscar-chave', async (req, res) => {
  try {
    const chave = String(req.query.chave || '').replace(/\D/g, '');
    if (chave.length !== 44) {
      return res.status(400).json({ error: 'Informe uma chave de acesso com 44 dígitos' });
    }

    const resultado = await centralEntradasService.buscarPorChave(chave);
    return res.json(resultado);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.post('/upload', (req, res, next) => {
  uploadXml.array('xml', 50)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message, sucesso: false });
    }
    return next();
  });
}, async (req, res) => {
  try {
    const arquivos = Array.isArray(req.files) ? req.files : [];
    const usuarioId = req.body?.usuario_id ?? req.body?.usuarioId ?? null;

    const resultado = await centralEntradasService.uploadDocumentos(arquivos, {
      usuarioId: usuarioId != null ? Number(usuarioId) || usuarioId : null
    });

    const statusCode = resultado.totalEnviados === 0 ? 400 : 200;
    return res.status(statusCode).json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message, sucesso: false });
  }
});

router.post('/:id/processar', async (req, res) => {
  try {
    const { usuario_id: usuarioId, forcar_reprocessamento: forcarReprocessamento } = req.body || {};
    const resultado = await centralEntradasService.processarDocumento(req.params.id, {
      usuarioId,
      forcarReprocessamento: Boolean(forcarReprocessamento)
    });

    const statusCode = resultado.sucesso ? 200 : 400;
    return res.status(statusCode).json(resultado);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message, sucesso: false });
  }
});

router.post('/:id/ciclo-dfe', async (req, res) => {
  try {
    const { usuario_id: usuarioId, confirmado } = req.body || {};
    const resultado = await centralEntradasService.processarCicloDfeDocumento(
      req.params.id,
      {
        usuarioId,
        confirmado: confirmado === true
      }
    );
    const statusCode = resultado.sucesso || resultado.aguardandoDisponibilizacao
      ? 200
      : (resultado.requerConfirmacao ? 409 : 422);
    return res.status(statusCode).json(resultado);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message, sucesso: false });
  }
});

router.post('/:id/revisar/concluir', async (req, res) => {
  try {
    const { itens, usuario_id: usuarioId } = req.body || {};
    const resultado = await centralEntradasService.concluirRevisao(req.params.id, {
      itens,
      usuarioId
    });
    return res.json(resultado);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.get('/:id/payload-compra', async (req, res) => {
  try {
    const payload = await centralEntradasService.obterPayloadCompra(req.params.id);
    return res.json(payload);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.post('/:id/abrir-compra', async (req, res) => {
  try {
    const { usuario_id: usuarioId } = req.body || {};
    const resultado = await centralEntradasService.abrirCompra(req.params.id, { usuarioId });
    return res.json(resultado);
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

router.get('/:id/historico', async (req, res) => {
  try {
    const documento = await centralEntradasService.obterDocumento(req.params.id);
    if (!documento) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    const historico = await centralEntradasService.obterHistorico(req.params.id);
    return res.json({ historico });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/xml', async (req, res) => {
  try {
    const xmlDoc = await centralEntradasService.obterXmlDocumento(req.params.id);
    if (!xmlDoc) {
      return res.status(404).json({ error: 'XML não encontrado para este documento' });
    }
    return res.json(xmlDoc);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/parse', async (req, res) => {
  try {
    const resultado = await centralEntradasService.obterParseDocumento(req.params.id);
    if (!resultado) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/score', async (req, res) => {
  try {
    const score = await centralEntradasService.obterScoreDocumento(req.params.id);
    if (!score) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }
    return res.json(score);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detalhe = await centralEntradasService.obterDocumentoDetalhe(req.params.id);
    if (!detalhe) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }
    return res.json(detalhe);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, detalhe, usuario_id: usuarioId } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: 'Campo status é obrigatório' });
    }

    const documento = await centralEntradasService.alterarStatus(req.params.id, status, {
      detalhe,
      usuarioId: usuarioId ?? req.user?.id,
      usuarioNome: req.user?.username || req.user?.nome,
      perfilUsuario: req.user?.perfil,
      roleUsuario: req.user?.role,
      ipRequisicao: req.ip
    });

    return res.json({ documento });
  } catch (error) {
    const code = error.statusCode || 500;
    return res.status(code).json({ error: error.message });
  }
});

module.exports = router;
