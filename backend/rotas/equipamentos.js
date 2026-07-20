const express = require('express');
const router = express.Router();
const equipamentosController = require('../controllers/equipamentosController');

router.get('/resumo', equipamentosController.resumo);
router.get('/drivers', equipamentosController.listarDrivers);
router.post('/testar', equipamentosController.testar);
router.post('/diagnostico', equipamentosController.diagnostico);

router.get('/layouts/presets', equipamentosController.listarPresetsLayout);
router.get('/layouts/ativo', equipamentosController.obterLayoutAtivo);
router.put('/layouts/ativo', equipamentosController.definirLayoutAtivo);
router.post('/layouts/testar', equipamentosController.testarParseLayout);
router.post('/etiquetas/interpretar', equipamentosController.interpretarEtiqueta);

router.get('/', equipamentosController.listar);
router.post('/', equipamentosController.criar);

router.get('/:id/layout', equipamentosController.obterLayoutEquipamento);
router.put('/:id/layout', equipamentosController.salvarLayoutEquipamento);
router.get('/:id/conexao', equipamentosController.conexao);
router.get('/:id/logs', equipamentosController.logs);
router.get('/:id/diagnostico', equipamentosController.diagnostico);
router.post('/:id/testar', equipamentosController.testar);
router.post('/:id/duplicar', equipamentosController.duplicar);
router.post('/:id/ativar', equipamentosController.ativar);
router.post('/:id/desativar', equipamentosController.desativar);

router.get('/:id', equipamentosController.buscarPorId);
router.put('/:id', equipamentosController.editar);
router.delete('/:id', equipamentosController.remover);

module.exports = router;
