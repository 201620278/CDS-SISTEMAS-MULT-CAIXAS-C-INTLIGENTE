/**
 * Rotas — Vendas para Entrega (Sprint 2.1)
 * Montadas em /api/vendas
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configuracaoService');
const EntregaController = require('../controllers/EntregaController');

function exigirModuloVendasEntrega(req, res, next) {
  try {
    if (!configService.recursoHabilitado('vendasEntrega')) {
      return res.status(404).json({
        error: 'Módulo Vendas para Entrega desabilitado.',
        codigo: 'MODULO_VENDAS_ENTREGA_DESABILITADO'
      });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao verificar módulo.' });
  }
}

router.use(exigirModuloVendasEntrega);

// Consultas operacionais (antes de :id)
router.get('/entregas/dashboard', EntregaController.dashboard);
router.get('/entregas/alertas', EntregaController.alertas);
router.get('/entregas/reservas-produto/:produtoId', EntregaController.reservasProduto);
router.get('/entregas/por-entregador', EntregaController.porEntregador);
router.get('/entregas/aguardando-prestacao', EntregaController.aguardandoPrestacao);
router.get('/entregas/resumo', EntregaController.resumo);
router.get('/entregas/resumo-status', EntregaController.resumoPorStatus);
router.get('/entregas/reservas', EntregaController.totaisReservados);
router.get('/entregas/pendentes', EntregaController.listarPendentes);

router.get('/entregas', EntregaController.listar);
router.get('/entregas/:id/timeline', EntregaController.timeline);
router.get('/entregas/:id', EntregaController.buscarPorId);
router.post('/entregas/:id/iniciar', EntregaController.iniciarEntrega);

router.post('/:id/prestacao', EntregaController.prestacao);
router.put('/:id/entrega', EntregaController.atualizarEntrega);
router.delete('/:id/entrega', EntregaController.cancelarEntrega);

module.exports = router;
