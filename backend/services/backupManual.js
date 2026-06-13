const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const db = require("../database");

function formatarDataArquivo() {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return (
    agora.getFullYear() +
    "-" + pad(agora.getMonth() + 1) +
    "-" + pad(agora.getDate()) +
    "_" + pad(agora.getHours()) +
    "-" + pad(agora.getMinutes()) +
    "-" + pad(agora.getSeconds())
  );
}

function fazerBackupManual(dbPath, pastaDestino = null) {
  if (!dbPath || !fs.existsSync(dbPath)) {
    throw new Error("Banco de dados não encontrado: " + dbPath);
  }

  const pastaBackup = pastaDestino || path.join(path.dirname(dbPath), "backups");

  if (!fs.existsSync(pastaBackup)) {
    fs.mkdirSync(pastaBackup, { recursive: true });
  }

  const nomeBackup = `backup_pdv_${formatarDataArquivo()}.db`;
  const caminhoBackup = path.join(pastaBackup, nomeBackup);

  fs.copyFileSync(dbPath, caminhoBackup);

  // Criar versão compactada .gz para economia de espaço e redundância
  const caminhoBackupCompactado = `${caminhoBackup}.gz`;
  try {
    const conteudo = fs.readFileSync(caminhoBackup);
    const gzipConteudo = zlib.gzipSync(conteudo);
    fs.writeFileSync(caminhoBackupCompactado, gzipConteudo);
  } catch (err) {
    console.error('Erro ao compactar backup:', err);
  }

  return {
    sucesso: true,
    arquivo: nomeBackup,
    caminho: caminhoBackup,
    compacto: caminhoBackupCompactado
  };
}

function obterPastaBackup(dbPath) {
  return path.join(path.dirname(dbPath), 'backups');
}

function listarHistoricoBackups(pastaBackup = null, limite = 20) {
  const folder = pastaBackup || obterPastaBackup(db.dbPath);
  if (!fs.existsSync(folder)) {
    return [];
  }
  const arquivos = fs.readdirSync(folder)
    .filter((file) => file.endsWith('.db') || file.endsWith('.db.gz'))
    .map((file) => {
      const stats = fs.statSync(path.join(folder, file));
      return {
        arquivo: file,
        caminho: path.join(folder, file),
        tamanho: stats.size,
        modificado_em: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modificado_em) - new Date(a.modificado_em));

  return arquivos.slice(0, limite);
}

function aplicarRetencaoBackups(pastaBackup = null, limite = 30) {
  const arquivos = listarHistoricoBackups(pastaBackup, 1000);
  if (arquivos.length <= limite) return;
  const paraExcluir = arquivos.slice(limite);
  paraExcluir.forEach((arquivo) => {
    try {
      fs.unlinkSync(arquivo.caminho);
    } catch (err) {
      console.error('Erro ao excluir backup antigo:', arquivo.caminho, err);
    }
  });
}

module.exports = {
  fazerBackupManual
  , listarHistoricoBackups
  , aplicarRetencaoBackups
};