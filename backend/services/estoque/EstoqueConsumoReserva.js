/**
 * Converte reserva ATIVA em baixa definitiva de estoque (Sprint 3).
 * 1) Baixa saldo_fiscal / saldo_nao_fiscal / estoque_atual
 * 2) Decrementa reservado_*
 * 3) Marca reserva como CONSUMIDA
 */

'use strict';

const db = require('../../database');
const { reduzirEstoqueDistribuido } = require('../vendas/VendaPagamentoService');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function reduzirEstoqueDistribuidoAsync(vendaItemId, produtoId, qF, qNf) {
  return new Promise((resolve, reject) => {
    reduzirEstoqueDistribuido(vendaItemId, produtoId, qF, qNf, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Consome reservas ativas da venda (baixa definitiva).
 * Deve ser chamado dentro de transação aberta pelo caller quando possível.
 */
async function consumirReservasDaVenda(vendaId) {
  const rows = await all(
    `SELECT * FROM venda_estoque_reservas WHERE venda_id = ? AND status = 'ATIVA'`,
    [vendaId]
  );

  for (const row of rows) {
    const qF = Number(row.quantidade_fiscal || 0);
    const qNf = Number(row.quantidade_nao_fiscal || 0);

    if (qF > 0 || qNf > 0) {
      await reduzirEstoqueDistribuidoAsync(
        row.venda_item_id || null,
        row.produto_id,
        qF,
        qNf
      );
    }

    await run(
      `
        UPDATE produtos
        SET
          reservado_fiscal = CASE
            WHEN COALESCE(reservado_fiscal, 0) - ? < 0 THEN 0
            ELSE COALESCE(reservado_fiscal, 0) - ?
          END,
          reservado_nao_fiscal = CASE
            WHEN COALESCE(reservado_nao_fiscal, 0) - ? < 0 THEN 0
            ELSE COALESCE(reservado_nao_fiscal, 0) - ?
          END
        WHERE id = ?
      `,
      [qF, qF, qNf, qNf, row.produto_id]
    );

    await run(
      `UPDATE venda_estoque_reservas
       SET status = 'CONSUMIDA', atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [row.id]
    );
  }

  return { consumidas: rows.length };
}

module.exports = {
  consumirReservasDaVenda
};
