const express = require('express');
const router = express.Router();
const db = require('../database');
const { verificarToken } = require('./auth');
const bcrypt = require('bcryptjs');
const { gravarAuditoria } = require('../services/auditoria');

function n(valor) {
  return Number(valor || 0);
}

function agoraLocalBrasil() {
  const agora = new Date();

  const dataBrasil = new Date(
    agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza' })
  );

  const ano = dataBrasil.getFullYear();
  const mes = String(dataBrasil.getMonth() + 1).padStart(2, '0');
  const dia = String(dataBrasil.getDate()).padStart(2, '0');
  const hora = String(dataBrasil.getHours()).padStart(2, '0');
  const min = String(dataBrasil.getMinutes()).padStart(2, '0');
  const seg = String(dataBrasil.getSeconds()).padStart(2, '0');

  return `${ano}-${mes}-${dia} ${hora}:${min}:${seg}`;
}

function hoje() {
  return agoraLocalBrasil().slice(0, 10);
}

function normalizarForma(forma) {
  return String(forma || '').toLowerCase().trim();
}

function calcularResumoCaixa(caixa, callback) {
  const data = caixa.data;

  db.all(`
    SELECT forma_pagamento, SUM(total) AS total
    FROM vendas
    WHERE status = 'concluida'
      AND caixa_id = ?
    GROUP BY forma_pagamento
  `, [caixa.id], (err, vendas) => {
    if (err) return callback(err);

    db.get(`
      SELECT SUM(valor) AS total_sangrias
      FROM caixa_movimentacoes
      WHERE caixa_id = ? AND tipo = 'sangria'
    `, [caixa.id], (err2, sangriasRow) => {
      if (err2) return callback(err2);

      db.get(`
        SELECT SUM(valor) AS total_suprimentos
        FROM caixa_movimentacoes
        WHERE caixa_id = ? AND tipo = 'suprimento'
      `, [caixa.id], (err3, suprimentosRow) => {
        if (err3) return callback(err3);

        let vendasDinheiro = 0;
        let vendasPix = 0;
        let vendasCartaoCredito = 0;
        let vendasCartaoDebito = 0;
        let vendasPrazo = 0;
        let outrasFormas = 0;

        (vendas || []).forEach(v => {
          const forma = normalizarForma(v.forma_pagamento);
          const total = n(v.total);

          if (forma === 'dinheiro') vendasDinheiro += total;
          else if (forma === 'pix') vendasPix += total;
          else if (forma === 'cartao_credito' || forma === 'credito') vendasCartaoCredito += total;
          else if (forma === 'cartao_debito' || forma === 'debito') vendasCartaoDebito += total;
          else if (forma === 'prazo') vendasPrazo += total;
          else outrasFormas += total;
        });

        const totalSangrias = n(sangriasRow?.total_sangrias);
        const totalSuprimentos = n(suprimentosRow?.total_suprimentos);

        const totalDigital = vendasPix + vendasCartaoCredito + vendasCartaoDebito;
        const totalVendido = vendasDinheiro + totalDigital + vendasPrazo + outrasFormas;

        const dinheiroEsperado =
          n(caixa.valor_inicial) +
          vendasDinheiro +
          totalSuprimentos -
          totalSangrias;

        const saldoGeral =
          n(caixa.valor_inicial) +
          totalVendido +
          totalSuprimentos -
          totalSangrias;

        callback(null, {
          caixa,
          total_vendido: totalVendido,
          dinheiro: {
            valor_inicial: n(caixa.valor_inicial),
            vendas_dinheiro: vendasDinheiro,
            suprimentos: totalSuprimentos,
            sangrias: totalSangrias,
            dinheiro_esperado: dinheiroEsperado
          },
          digital: {
            pix: vendasPix,
            cartao_credito: vendasCartaoCredito,
            cartao_debito: vendasCartaoDebito,
            total_digital: totalDigital
          },
          prazo: vendasPrazo,
          outras_formas: outrasFormas,
          saldo_geral: saldoGeral
        });
      });
    });
  });
}

function validarSenhaAdmin(senhaAdmin, callback) {
  if (!senhaAdmin) {
    return callback(null, false);
  }

  db.all(`SELECT * FROM usuarios`, [], async (err, usuarios) => {
    if (err) return callback(err);

    if (!usuarios || usuarios.length === 0) {
      return callback(null, false);
    }

    for (const usuario of usuarios) {
      const perfilUsuario = String(
        usuario.perfil ||
        usuario.nivel ||
        usuario.cargo ||
        usuario.role ||
        usuario.funcao ||
        ''
      ).toLowerCase();

      const isAdmin =
        perfilUsuario === 'admin' ||
        perfilUsuario === 'administrador' ||
        perfilUsuario === 'gerente';

      if (!isAdmin) continue;

      const senhaBanco =
        usuario.senha ||
        usuario.password ||
        usuario.senha_hash;

      if (!senhaBanco) continue;

      const senhaOk = await bcrypt.compare(senhaAdmin, senhaBanco).catch(() => false);

      if (senhaOk || senhaAdmin === senhaBanco) {
        return callback(null, true);
      }
    }

    return callback(null, false);
  });
}

router.get('/aberto', (req, res) => {
  db.get(`
    SELECT *
    FROM caixa
    WHERE status = 'aberto'
    ORDER BY id DESC
    LIMIT 1
  `, [], (err, caixa) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!caixa) return res.json(null);

    calcularResumoCaixa(caixa, (calcErr, resumo) => {
      if (calcErr) return res.status(500).json({ error: calcErr.message });
      res.json(resumo);
    });
  });
});

router.get('/saldo-inicial-sugerido', (req, res) => {
  db.get(`
    SELECT
      id,
      valor_fechamento,
      fechado_em
    FROM caixa
    WHERE status = 'fechado'
    ORDER BY id DESC
    LIMIT 1
  `, [], (err, caixa) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const valor = Number(caixa?.valor_fechamento || 0);

    res.json({
      valor_sugerido: valor,
      ultimo_caixa_id: caixa?.id || null,
      fechado_em: caixa?.fechado_em || null,
      mensagem: caixa
        ? 'Saldo sugerido carregado do último fechamento.'
        : 'Nenhum fechamento anterior encontrado.'
    });
  });
});

router.post('/abrir', verificarToken, (req, res) => {
  const valorInicial = n(req.body.valor_inicial);

  db.get(`
    SELECT id FROM caixa
    WHERE status = 'aberto'
    LIMIT 1
  `, [], (err, caixaAberto) => {
    if (err) return res.status(500).json({ error: err.message });

    if (caixaAberto) {
      return res.status(400).json({
        error: 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.'
      });
    }

    db.run(`
      INSERT INTO caixa (
        data,
        valor_inicial,
        status,
        aberto_em,
        aberto_por
      ) VALUES (
        DATE('now', 'localtime'),
        ?,
        'aberto',
        DATETIME('now', 'localtime'),
        ?
      )
    `, [valorInicial, req.user?.id || null], function(insertErr) {
      if (insertErr) return res.status(500).json({ error: insertErr.message });

      const caixaId = this.lastID;

      db.run(`
        INSERT INTO caixa_movimentacoes (
          caixa_id,
          tipo,
          valor,
          motivo,
          usuario_id
        ) VALUES (?, 'abertura', ?, 'Abertura de caixa', ?)
      `, [caixaId, valorInicial, req.user?.id || null], (movErr) => {
        if (movErr) return res.status(500).json({ error: movErr.message });

        // Registrar auditoria centralizada
        gravarAuditoria({
          usuario_id: req.user?.id || null,
          usuario_nome: req.user?.nome || req.user?.username || null,
          modulo: 'caixa',
          acao: 'abrir_caixa',
          referencia_tipo: 'caixa',
          referencia_id: caixaId,
          detalhes: { valor_inicial: valorInicial },
          ip_requisicao: req.ip || null
        }).catch((auditErr) => console.error('Erro ao gravar auditoria de abertura de caixa:', auditErr));

        res.json({
          message: 'Caixa aberto com sucesso.',
          caixa_id: caixaId
        });
      });
    });
  });
});

router.post('/sangria', verificarToken, async (req, res) => {
  const valor = n(req.body.valor);
  const motivo = req.body.motivo || 'Sangria de caixa';
  const operadorId = req.user?.id || null;
  const operadorNome = req.user?.nome || req.user?.username || 'Desconhecido';
  const senhaAdmin = req.body.senha_admin;

  if (valor <= 0) {
    return res.status(400).json({ error: 'Informe um valor válido para sangria.' });
  }

  validarSenhaAdmin(senhaAdmin, (senhaErr, senhaValida) => {
    if (senhaErr) {
      return res.status(500).json({ error: senhaErr.message });
    }

    if (!senhaValida) {
      return res.status(403).json({ error: 'Senha de administrador inválida para realizar sangria.' });
    }

    db.get(
      `SELECT * FROM caixa WHERE status = 'aberto' ORDER BY id DESC LIMIT 1`,
      [],
      (errCaixa, caixa) => {
        if (errCaixa) {
          return res.status(500).json({ error: errCaixa.message });
        }

        if (!caixa) {
          return res.status(400).json({ error: 'Nenhum caixa aberto.' });
        }

        calcularResumoCaixa(caixa, (calcErr, resumo) => {
          if (calcErr) {
            return res.status(500).json({ error: calcErr.message });
          }

          if (valor > resumo.dinheiro.dinheiro_esperado) {
            return res.status(400).json({
              error: `Sangria maior que o dinheiro esperado. Disponível: ${resumo.dinheiro.dinheiro_esperado.toFixed(2)}`
            });
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run(
              `INSERT INTO caixa_movimentacoes (
                caixa_id,
                tipo,
                valor,
                motivo,
                usuario_id,
                operador_nome
              ) VALUES (?, 'sangria', ?, ?, ?, ?)`,
              [caixa.id, valor, motivo, operadorId, operadorNome],
              (movErr) => {
                if (movErr) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: movErr.message });
                }

                db.run(
                  `INSERT INTO auditoria_caixa (
                    caixa_id,
                    operador_id,
                    acao,
                    tipo_movimentacao,
                    valor,
                    detalhes
                  ) VALUES (?, ?, 'sangria', 'sangria', ?, ?)`,
                  [caixa.id, operadorId, valor, JSON.stringify({ motivo, operador: operadorNome })],
                  (auditErr) => {
                    if (auditErr) console.error('Erro ao registrar auditoria:', auditErr);

                      db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: commitErr.message });
                      }

                        // auditoria centralizada
                        gravarAuditoria({
                          usuario_id: operadorId,
                          usuario_nome: operadorNome,
                          modulo: 'caixa',
                          acao: 'sangria',
                          referencia_tipo: 'caixa',
                          referencia_id: caixa.id,
                          detalhes: { valor, motivo },
                          ip_requisicao: req.ip || null
                        }).catch((auditErr) => console.error('Erro ao gravar auditoria de sangria:', auditErr));

                        res.json({
                          message: 'Sangria registrada com sucesso.',
                          valor,
                          motivo,
                          operador: operadorNome
                        });
                    });
                  }
                );
              }
            );
          });
        });
      }
    );
  });
});

router.post('/suprimento', verificarToken, (req, res) => {
  const valor = n(req.body.valor);
  const motivo = req.body.motivo || 'Suprimento de caixa';
  const operadorId = req.user?.id || null;
  const operadorNome = req.user?.nome || req.user?.username || 'Desconhecido';

  if (valor <= 0) {
    return res.status(400).json({ error: 'Informe um valor válido para suprimento.' });
  }

  db.get(
    `SELECT * FROM caixa WHERE status = 'aberto' ORDER BY id DESC LIMIT 1`,
    [],
    (err, caixa) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!caixa) return res.status(400).json({ error: 'Nenhum caixa aberto.' });

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `INSERT INTO caixa_movimentacoes (
            caixa_id,
            tipo,
            valor,
            motivo,
            usuario_id,
            operador_nome
          ) VALUES (?, 'suprimento', ?, ?, ?, ?)`,
          [caixa.id, valor, motivo, operadorId, operadorNome],
          (movErr) => {
            if (movErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: movErr.message });
            }

            db.run(
              `INSERT INTO auditoria_caixa (
                caixa_id,
                operador_id,
                acao,
                tipo_movimentacao,
                valor,
                detalhes,
                ip_requisicao
              ) VALUES (?, ?, 'suprimento', 'suprimento', ?, ?, ?)`,
              [caixa.id, operadorId, valor, JSON.stringify({ motivo, operador: operadorNome }), req.ip || null],
              (auditErr) => {
                if (auditErr) console.error('Erro ao registrar auditoria:', auditErr);

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: commitErr.message });
                    }

                    // auditoria centralizada
                    gravarAuditoria({
                      usuario_id: operadorId,
                      usuario_nome: operadorNome,
                      modulo: 'caixa',
                      acao: 'suprimento',
                      referencia_tipo: 'caixa',
                      referencia_id: caixa.id,
                      detalhes: { valor, motivo },
                      ip_requisicao: req.ip || null
                    }).catch((auditErr) => console.error('Erro ao gravar auditoria de suprimento:', auditErr));

                    res.json({
                      message: 'Suprimento registrado com sucesso.',
                      valor,
                      motivo,
                      operador: operadorNome
                    });
                  });
              }
            );
          }
        );
      });
    }
  );
});

router.post('/fechar', verificarToken, (req, res) => {
  const valorInformado = n(req.body.valor_informado);
  const observacao = req.body.observacao || '';
  const operadorId = req.user?.id || null;
  const operadorNome = req.user?.nome || req.user?.username || 'Desconhecido';

  db.get(
    `SELECT * FROM caixa WHERE status = 'aberto' ORDER BY id DESC LIMIT 1`,
    [],
    (err, caixa) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!caixa) return res.status(400).json({ error: 'Nenhum caixa aberto.' });

      // Validar fechamento duplicado
      db.get(
        `SELECT id FROM caixa_fechamentos WHERE caixa_id = ? LIMIT 1`,
        [caixa.id],
        (checkErr, jaFechado) => {
          if (checkErr) return res.status(500).json({ error: checkErr.message });
          if (jaFechado) {
            return res.status(400).json({ 
              error: 'Este caixa já foi fechado. Use REIMPRESSÃO se necessário reimprimir.' 
            });
          }

          // Calcular fechamento detalhado
          calcularFechamentoDetalhado(caixa, (calcErr, detalhes) => {
            if (calcErr) return res.status(500).json({ error: calcErr.message });

            const diferenca = valorInformado - detalhes.total_esperado;

            db.serialize(() => {
              db.run('BEGIN TRANSACTION');

              // Atualizar status do caixa e resumos do fechamento
              db.run(`
                UPDATE caixa SET
                  status = 'fechado',
                  fechado_em = DATETIME('now', 'localtime'),
                  fechado_por = ?,
                  valor_fechamento = ?,
                  total_sangrias = ?,
                  total_suprimentos = ?,
                  saldo_esperado = ?,
                  diferenca = ?,
                  observacao = ?
                WHERE id = ?
              `, [
                operadorId,
                valorInformado,
                detalhes.total_sangrias,
                detalhes.total_suprimentos,
                detalhes.total_esperado,
                diferenca,
                observacao,
                caixa.id
              ], (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: updateErr.message });
                }

                // Registrar fechamento detalhado
                db.run(`
                  INSERT INTO caixa_fechamentos (
                    caixa_id,
                    operador_id,
                    data_fechamento,
                    valor_inicial,
                    vendas_dinheiro,
                    vendas_pix,
                    vendas_debito,
                    vendas_credito,
                    vendas_prazo,
                    vendas_tef,
                    total_sangrias,
                    total_suprimentos,
                    total_vendido,
                    total_esperado,
                    total_informado,
                    diferenca,
                    observacao
                  ) VALUES (?, ?, DATETIME('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  caixa.id,
                  operadorId,
                  detalhes.valor_inicial,
                  detalhes.vendas_dinheiro,
                  detalhes.vendas_pix,
                  detalhes.vendas_debito,
                  detalhes.vendas_credito,
                  detalhes.vendas_prazo,
                  detalhes.vendas_tef,
                  detalhes.total_sangrias,
                  detalhes.total_suprimentos,
                  detalhes.total_vendido,
                  detalhes.total_esperado,
                  valorInformado,
                  diferenca,
                  observacao
                ], (insertErr) => {
                  if (insertErr) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: insertErr.message });
                  }

                  // Registrar auditoria
                  db.run(`
                    INSERT INTO auditoria_caixa (
                      caixa_id,
                      operador_id,
                      acao,
                      tipo_movimentacao,
                      valor,
                      detalhes,
                      ip_requisicao
                    ) VALUES (?, ?, 'fechamento', 'fechamento', ?, ?, ?)
                  `, [
                    caixa.id,
                    operadorId,
                    valorInformado,
                    JSON.stringify({
                      diferenca,
                      operador: operadorNome,
                      observacao
                    }),
                    req.ip || null
                  ], (auditErr) => {
                    if (auditErr) console.error('Erro ao registrar auditoria:', auditErr);

                    // Registrar movimentação
                    db.run(`
                      INSERT INTO caixa_movimentacoes (
                        caixa_id,
                        tipo,
                        valor,
                        motivo,
                        usuario_id,
                        operador_nome
                      ) VALUES (?, 'fechamento', ?, 'Fechamento de caixa', ?, ?)
                    `, [caixa.id, valorInformado, operadorId, operadorNome], (movErr) => {
                      if (movErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: movErr.message });
                      }

                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: commitErr.message });
                          }

                          // auditoria centralizada do fechamento
                          gravarAuditoria({
                            usuario_id: operadorId,
                            usuario_nome: operadorNome,
                            modulo: 'caixa',
                            acao: 'fechar_caixa',
                            referencia_tipo: 'caixa',
                            referencia_id: caixa.id,
                            detalhes: { valor_informado: valorInformado, diferenca, observacao },
                            ip_requisicao: req.ip || null
                          }).catch((auditErr) => console.error('Erro ao gravar auditoria de fechamento de caixa:', auditErr));

                          res.json({
                            message: 'Caixa fechado com sucesso.',
                            caixa_id: caixa.id,
                            operador: operadorNome,
                            detalhes: {
                              ...detalhes,
                              total_informado: valorInformado,
                              diferenca
                            }
                          });
                        });
                    });
                  });
                });
              });
            });
          });
        }
      );
    }
  );
});

// Função para calcular fechamento detalhado com todas as formas de pagamento
function calcularFechamentoDetalhado(caixa, callback) {
  const data = caixa.data;

  db.all(`
    SELECT forma_pagamento, SUM(total) AS total
    FROM vendas
    WHERE status = 'concluida'
      AND caixa_id = ?
    GROUP BY forma_pagamento
  `, [caixa.id], (err, vendas) => {
    if (err) return callback(err);

    db.get(`
      SELECT SUM(valor) AS total_sangrias
      FROM caixa_movimentacoes
      WHERE caixa_id = ? AND tipo = 'sangria'
    `, [caixa.id], (err2, sangriasRow) => {
      if (err2) return callback(err2);

      db.get(`
        SELECT SUM(valor) AS total_suprimentos
        FROM caixa_movimentacoes
        WHERE caixa_id = ? AND tipo = 'suprimento'
      `, [caixa.id], (err3, suprimentosRow) => {
        if (err3) return callback(err3);

        let vendasDinheiro = 0;
        let vendasPix = 0;
        let vendasCartaoCredito = 0;
        let vendasCartaoDebito = 0;
        let vendasPrazo = 0;
        let vendasTef = 0;

        (vendas || []).forEach(v => {
          const forma = normalizarForma(v.forma_pagamento);
          const total = n(v.total);

          if (forma === 'dinheiro') vendasDinheiro += total;
          else if (forma === 'pix') vendasPix += total;
          else if (forma === 'cartao_credito' || forma === 'credito') vendasCartaoCredito += total;
          else if (forma === 'cartao_debito' || forma === 'debito') vendasCartaoDebito += total;
          else if (forma === 'prazo') vendasPrazo += total;
          else if (forma === 'tef' || forma === 'cartao') vendasTef += total;
        });

        const totalSangrias = n(sangriasRow?.total_sangrias);
        const totalSuprimentos = n(suprimentosRow?.total_suprimentos);
        const valorInicial = n(caixa.valor_inicial);

        const totalVendido = vendasDinheiro + vendasPix + vendasCartaoCredito + vendasCartaoDebito + vendasPrazo + vendasTef;
        const totalEsperado = valorInicial + vendasDinheiro + totalSuprimentos - totalSangrias;

        callback(null, {
          valor_inicial: valorInicial,
          vendas_dinheiro: vendasDinheiro,
          vendas_pix: vendasPix,
          vendas_debito: vendasCartaoDebito,
          vendas_credito: vendasCartaoCredito,
          vendas_prazo: vendasPrazo,
          vendas_tef: vendasTef,
          total_sangrias: totalSangrias,
          total_suprimentos: totalSuprimentos,
          total_vendido: totalVendido,
          total_esperado: totalEsperado
        });
      });
    });
  });
}

function obterDetalhesCaixa(caixaId, callback) {
  db.get(`
    SELECT c.*, ua.nome AS aberto_por_nome, uf.nome AS fechado_por_nome
    FROM caixa c
    LEFT JOIN usuarios ua ON ua.id = c.aberto_por
    LEFT JOIN usuarios uf ON uf.id = c.fechado_por
    WHERE c.id = ?
  `, [caixaId], (err, caixa) => {
    if (err) return callback(err);
    if (!caixa) return callback(null, null);

    db.get(
      `SELECT * FROM caixa_fechamentos WHERE caixa_id = ? ORDER BY id DESC LIMIT 1`,
      [caixaId],
      (fechErr, fechamento) => {
        if (fechErr) return callback(fechErr);

        db.all(
          `SELECT cm.*, u.nome as usuario_nome FROM caixa_movimentacoes cm LEFT JOIN usuarios u ON u.id = cm.usuario_id WHERE cm.caixa_id = ? ORDER BY cm.id DESC`,
          [caixaId],
          (movErr, movimentacoes) => {
            if (movErr) return callback(movErr);

            db.all(
              `SELECT * FROM auditoria_caixa WHERE caixa_id = ? ORDER BY criado_em DESC`,
              [caixaId],
              (auditErr, auditoria) => {
                if (auditErr) return callback(auditErr);

                callback(null, {
                  caixa,
                  fechamento: fechamento || null,
                  movimentacoes: movimentacoes || [],
                  auditoria: auditoria || []
                });
              }
            );
          }
        );
      }
    );
  });
}

router.get('/fechamento/:caixa_id', (req, res) => {
  const caixaId = Number(req.params.caixa_id);

  obterDetalhesCaixa(caixaId, (err, resultado) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!resultado) return res.status(404).json({ error: 'Caixa não encontrado.' });
    res.json(resultado);
  });
});

router.post('/:caixa_id/reimprimir', verificarToken, (req, res) => {
  const caixaId = Number(req.params.caixa_id);
  const operadorId = req.user?.id || null;
  const operadorNome = req.user?.nome || req.user?.username || 'Desconhecido';

  db.get(`SELECT * FROM caixa WHERE id = ?`, [caixaId], (err, caixa) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!caixa) return res.status(404).json({ error: 'Caixa não encontrado.' });
    if (caixa.status !== 'fechado') {
      return res.status(400).json({ error: 'Somente caixas fechados podem ser reimpressos.' });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `UPDATE caixa SET ja_reimpresso = COALESCE(ja_reimpresso, 0) + 1 WHERE id = ?`,
        [caixaId],
        (updateErr) => {
          if (updateErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: updateErr.message });
          }

          db.run(
            `INSERT INTO auditoria_caixa (
              caixa_id,
              operador_id,
              acao,
              tipo_movimentacao,
              valor,
              detalhes,
              ip_requisicao
            ) VALUES (?, ?, 'reimpressao', 'fechamento', ?, ?, ?)`,
            [
              caixaId,
              operadorId,
              caixa.valor_fechamento || 0,
              JSON.stringify({ operador: operadorNome, motivo: 'Reimpressão de fechamento' }),
              req.ip || null
            ],
              (auditErr) => {
                if (auditErr) console.error('Erro ao registrar auditoria de reimpressão:', auditErr);

                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: commitErr.message });
                  }

                  // auditoria centralizada de reimpressão
                  gravarAuditoria({
                    usuario_id: operadorId,
                    usuario_nome: operadorNome,
                    modulo: 'caixa',
                    acao: 'reimpressao_fechamento',
                    referencia_tipo: 'caixa',
                    referencia_id: caixaId,
                    detalhes: { motivo: 'Reimpressão de fechamento' },
                    ip_requisicao: req.ip || null
                  }).catch((auditErr) => console.error('Erro ao gravar auditoria de reimpressão:', auditErr));

                  obterDetalhesCaixa(caixaId, (detErr, resultado) => {
                    if (detErr) return res.status(500).json({ error: detErr.message });
                    res.json({
                      message: 'Reimpressão registrada.',
                      resultado
                    });
                  });
                });
            }
          );
        }
      );
    });
  });
});

router.get('/historico', (req, res) => {
  db.all(`
    SELECT c.*, ua.nome AS aberto_por_nome, uf.nome AS fechado_por_nome
    FROM caixa c
    LEFT JOIN usuarios ua ON ua.id = c.aberto_por
    LEFT JOIN usuarios uf ON uf.id = c.fechado_por
    ORDER BY c.id DESC
    LIMIT 100
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get('/movimentacoes/:caixa_id', (req, res) => {
  db.all(`
    SELECT cm.*, u.nome as usuario_nome
    FROM caixa_movimentacoes cm
    LEFT JOIN usuarios u ON u.id = cm.usuario_id
    WHERE cm.caixa_id = ?
    ORDER BY cm.id DESC
  `, [req.params.caixa_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get('/por-data', (req, res) => {
  const data = req.query.data || hoje();

  db.all(`
    SELECT c.*, ua.nome AS aberto_por_nome, uf.nome AS fechado_por_nome
    FROM caixa c
    LEFT JOIN usuarios ua ON ua.id = c.aberto_por
    LEFT JOIN usuarios uf ON uf.id = c.fechado_por
    WHERE c.data = ?
    ORDER BY c.id DESC
  `, [data], (err, caixas) => {
    if (err) {
      return res.status(500).json({
        sucesso: false,
        mensagem: err.message
      });
    }

    if (!caixas || caixas.length === 0) {
      return res.json({
        sucesso: true,
        data,
        caixas: []
      });
    }

    const resultado = [];
    let processados = 0;

    caixas.forEach((caixa) => {
      calcularResumoCaixa(caixa, (calcErr, resumo) => {
        if (calcErr) {
          return res.status(500).json({
            sucesso: false,
            mensagem: calcErr.message
          });
        }

        db.all(`
          SELECT
            cm.*,
            u.nome as usuario_nome
          FROM caixa_movimentacoes cm
          LEFT JOIN usuarios u ON u.id = cm.usuario_id
          WHERE cm.caixa_id = ?
          ORDER BY cm.id DESC
        `, [caixa.id], (movErr, movimentacoes) => {
          if (movErr) {
            return res.status(500).json({
              sucesso: false,
              mensagem: movErr.message
            });
          }

          resultado.push({
            caixa,
            resumo,
            movimentacoes: movimentacoes || []
          });

          processados++;

          if (processados === caixas.length) {
            res.json({
              sucesso: true,
              data,
              caixas: resultado
            });
          }
        });
      });
    });
  });
});

module.exports = router;