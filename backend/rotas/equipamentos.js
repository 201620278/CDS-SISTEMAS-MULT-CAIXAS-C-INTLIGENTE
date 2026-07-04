const express = require('express');
const router = express.Router();
const equipamentosController = require('../controllers/equipamentosController');

router.get('/resumo', equipamentosController.resumo);
router.get('/drivers', equipamentosController.listarDrivers);
router.post('/testar', equipamentosController.testar);
router.post('/diagnostico', equipamentosController.diagnostico);

router.get('/', equipamentosController.listar);
router.post('/', equipamentosController.criar);

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
