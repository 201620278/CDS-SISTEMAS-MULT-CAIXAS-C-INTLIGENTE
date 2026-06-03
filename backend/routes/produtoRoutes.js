const express = require('express');
const router = express.Router();
const controller = require('../controllers/produtoController');

// LISTAR PRODUTOS
router.get('/', controller.listarProdutos);

// Buscar produto por código
router.get('/codigo/:codigo', controller.buscarProdutoPorCodigo);

// Histórico de preços do produto
router.get('/:id/historico-precos', controller.historicoPrecos);

// Relatório de estoque de produtos com data de compra
router.get('/relatorio-estoque', controller.relatorioEstoque);

// Buscar produto por ID trazendo o nome da categoria e subcategoria
router.get('/:id', controller.buscarProdutoPorId);

// Criar produto
router.post('/', controller.criarProduto);

// Atualizar produto
router.put('/:id', controller.atualizarProduto);

// Deletar produto
router.delete('/:id', controller.deletarProduto);

// Buscar produtos com estoque baixo
router.get('/estoque/baixo', controller.buscarEstoqueBaixo);

module.exports = router;
