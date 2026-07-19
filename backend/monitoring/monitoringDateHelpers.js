/**
 * Helpers de data compartilhados do Monitoring Engine (somente leitura).
 */

function dataHojeBrasil() {
  const agora = new Date();
  const dataBrasil = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
  const ano = dataBrasil.getFullYear();
  const mes = String(dataBrasil.getMonth() + 1).padStart(2, '0');
  const dia = String(dataBrasil.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function periodoMes(hoje) {
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
}

function periodoAno(hoje) {
  return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function montarBlocoPeriodo(hoje, mes, ano, extras = {}) {
  return {
    valor: hoje.valor,
    quantidade: hoje.quantidade,
    hoje,
    mes,
    ano,
    ...extras
  };
}

function percentual(parte, total) {
  const t = num(total);
  if (t <= 0) return 0;
  return Math.round((num(parte) / t) * 1000) / 10;
}

function dbGetFactory(db) {
  return function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || {})));
    });
  };
}

module.exports = {
  dataHojeBrasil,
  periodoMes,
  periodoAno,
  num,
  montarBlocoPeriodo,
  percentual,
  dbGetFactory
};
