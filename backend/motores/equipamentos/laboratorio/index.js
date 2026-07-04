/**
 * Laboratório de Equipamentos — exports públicos
 * @module motores/equipamentos/laboratorio
 */

const laboratorioEquipamentos = require('./LaboratorioEquipamentos');

module.exports = {
  laboratorioEquipamentos,
  LaboratorioEquipamentos: laboratorioEquipamentos.LaboratorioEquipamentos,
  frameStudio: require('./FrameStudio'),
  packetInspector: require('./PacketInspector'),
  captureManager: require('./CaptureManager'),
  replayManager: require('./ReplayManager'),
  packetComparator: require('./PacketComparator'),
  diagnosticoEquipamentos: require('./DiagnosticoEquipamentos'),
  frameBuilderMap: require('./frameBuilderMap')
};
