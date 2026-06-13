const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  app: 'cds-sistemas',

  getTerminalInfo: () => ({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch()
  }),

  forcarReflow: () => ipcRenderer.send('forcar-reflow'),

  abrirComprovante: (html, options) =>
    ipcRenderer.send('abrir-comprovante', html, options || {}),

  selecionarPastaBackup: () =>
    ipcRenderer.invoke('selecionar-pasta-backup'),

  listarImpressoras: () =>
    ipcRenderer.invoke('listar-impressoras'),

  imprimirDANFESilencioso: (html, deviceName) =>
    ipcRenderer.invoke('imprimir-danfe-silencioso', html, deviceName),

  fecharJanela: () => window.close()
});
