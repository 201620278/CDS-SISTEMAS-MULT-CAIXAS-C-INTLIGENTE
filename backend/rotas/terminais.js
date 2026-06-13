const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../database');
const { gravarAuditoria } = require('../services/auditoria');

router.get('/', (req, res) => {
  db.all(`
    SELECT t.*, c.nome AS caixa_nome
    FROM terminais t
    LEFT JOIN caixas c ON c.id = t.caixa_id
    WHERE COALESCE(t.ativo, 1) = 1
    ORDER BY t.id
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get('/auto', (req, res) => {
  const hostname = String(req.query.hostname || os.hostname()).trim();

  if (!hostname) {
    return res.status(400).json({ error: 'Hostname do terminal não pode estar vazio.' });
  }

  db.get(`SELECT * FROM terminais WHERE hostname = ?`, [hostname], (err, terminal) => {
    if (err) return res.status(500).json({ error: err.message });

    const agora = new Date().toISOString();
    if (terminal) {
      db.run(
        `UPDATE terminais SET ultima_conexao = ?, updated_at = ? WHERE id = ?`, 
        [agora, agora, terminal.id],
        (updateErr) => {
          if (updateErr) {
            console.error('Erro ao atualizar terminal:', updateErr);
          }
          db.get(`SELECT * FROM terminais WHERE id = ?`, [terminal.id], (getErr, updated) => {
            if (getErr) return res.status(500).json({ error: getErr.message });
            res.json(updated);
          });
        }
      );
      return;
    }

    db.run(
      `INSERT INTO terminais (nome, hostname, ativo, ultima_conexao, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)`,
      [hostname, hostname, agora, agora, agora],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        db.get(`SELECT * FROM terminais WHERE id = ?`, [this.lastID], (getErr, novoTerminal) => {
          if (getErr) return res.status(500).json({ error: getErr.message });
            // auditoria de criação de terminal
            gravarAuditoria({
              usuario_id: req.user?.id || null,
              usuario_nome: req.user?.nome || req.user?.username || null,
              modulo: 'terminais',
              acao: 'criar_terminal',
              referencia_tipo: 'terminal',
              referencia_id: this.lastID,
              detalhes: { nome: nomeTerminal, hostname },
              ip_requisicao: req.ip || null
            }).catch((auditErr) => console.error('Erro ao gravar auditoria de terminal:', auditErr));

            res.json(novoTerminal);
        });
      }
    );
  });
});

router.post('/', (req, res) => {
  const { nome, hostname, caixa_id, ativo } = req.body;
  const nomeTerminal = String(nome || hostname || '').trim();

  if (!nomeTerminal) {
    return res.status(400).json({ error: 'Nome ou hostname do terminal é obrigatório.' });
  }

  const valores = [nomeTerminal, String(hostname || nomeTerminal).trim() || null, caixa_id || null, ativo === 0 ? 0 : 1, new Date().toISOString(), new Date().toISOString()];

  db.run(
    `INSERT INTO terminais (nome, hostname, caixa_id, ativo, ultima_conexao, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    valores,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT * FROM terminais WHERE id = ?`, [this.lastID], (getErr, row) => {
        if (getErr) return res.status(500).json({ error: getErr.message });
        res.status(201).json(row);
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { nome, hostname, caixa_id, ativo } = req.body;

  db.get(`SELECT * FROM terminais WHERE id = ?`, [id], (err, terminal) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!terminal) return res.status(404).json({ error: 'Terminal não encontrado.' });

    const updatedNome = nome !== undefined ? nome : terminal.nome;
    const updatedHostname = hostname !== undefined ? hostname : terminal.hostname;
    const updatedCaixaId = caixa_id !== undefined ? caixa_id : terminal.caixa_id;
    const updatedAtivo = ativo !== undefined ? (ativo ? 1 : 0) : terminal.ativo;
    const agora = new Date().toISOString();

    db.run(
      `UPDATE terminais SET nome = ?, hostname = ?, caixa_id = ?, ativo = ?, updated_at = ? WHERE id = ?`,
      [updatedNome, updatedHostname, updatedCaixaId, updatedAtivo, agora, id],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        db.get(`SELECT * FROM terminais WHERE id = ?`, [id], (getErr, row) => {
          if (getErr) return res.status(500).json({ error: getErr.message });
          // auditoria de atualização de terminal
          gravarAuditoria({
            usuario_id: req.user?.id || null,
            usuario_nome: req.user?.nome || req.user?.username || null,
            modulo: 'terminais',
            acao: 'atualizar_terminal',
            referencia_tipo: 'terminal',
            referencia_id: id,
            detalhes: { antes: terminal, depois: { nome: updatedNome, hostname: updatedHostname, caixa_id: updatedCaixaId, ativo: updatedAtivo } },
            ip_requisicao: req.ip || null
          }).catch((auditErr) => console.error('Erro ao gravar auditoria de atualização de terminal:', auditErr));

          res.json(row);
        });
      }
    );
  });
});

module.exports = router;
