/**
 * Contexto de consulta do Monitoring Engine.
 * Carrega escopo, usuário e flags de visualização — sem SQL.
 */

function criarMonitoringContext(req = {}, extras = {}) {
  const query = req.query || {};
  const usuario = req.usuario || req.user || {};
  return {
    requestId: extras.requestId || `mon-${Date.now()}`,
    usuarioId: usuario.id || null,
    perfil: usuario.perfil || null,
    role: usuario.role || null,
    permissoes: usuario.permissoes || [],
    modoFiscalUi: query.modo_fiscal === '1' || query.modo_fiscal === 'true',
    agora: new Date(),
    extras: { ...extras }
  };
}

module.exports = {
  criarMonitoringContext,
  MonitoringContext: { create: criarMonitoringContext }
};
