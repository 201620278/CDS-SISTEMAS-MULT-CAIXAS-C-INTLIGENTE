// Funções para backup Google Drive
async function showBackupConfigModal() {
  let config = {
    enabled: false,
    frequency: 'daily',
    google: {
      client_id: '',
      client_secret: '',
      redirect_uris: [''],
      refresh_token: ''
    }
  };

  try {
    const response = await fetch(`${API_URL}/configuracoes/backup`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (response.ok) {
      config = await response.json();
    }
  } catch (error) {
    console.error('Erro ao carregar configuração de backup:', error);
  }

  const modalHtml = `
    <div class="modal fade" id="backupConfigModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Configuração de Backup Google Drive</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="backupConfigForm">
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="backupEnabled" ${config.enabled ? 'checked' : ''}>
                <label class="form-check-label" for="backupEnabled">Habilitar backup automático</label>
              </div>
              <div class="mb-3">
                <label for="backupFrequency" class="form-label">Frequência</label>
                <select class="form-select" id="backupFrequency">
                  <option value="daily" ${config.frequency === 'daily' ? 'selected' : ''}>Diário</option>
                  <option value="weekly" ${config.frequency === 'weekly' ? 'selected' : ''}>Semanal</option>
                  <option value="monthly" ${config.frequency === 'monthly' ? 'selected' : ''}>Mensal</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="googleClientId" class="form-label">Client ID</label>
                <input type="text" class="form-control" id="googleClientId" value="${config.google?.client_id || ''}">
              </div>
              <div class="mb-3">
                <label for="googleClientSecret" class="form-label">Client Secret</label>
                <input type="text" class="form-control" id="googleClientSecret" value="${config.google?.client_secret || ''}">
              </div>
              <div class="mb-3">
                <label for="googleRedirectUri" class="form-label">Redirect URI</label>
                <input type="text" class="form-control" id="googleRedirectUri" value="${config.google?.redirect_uris?.[0] || ''}">
              </div>
              <div class="mb-3">
                <label for="googleRefreshToken" class="form-label">Refresh Token</label>
                <input type="text" class="form-control" id="googleRefreshToken" value="${config.google?.refresh_token || ''}">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="salvarBackupConfig()">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#modal-container').html(modalHtml);
  const modalEl = document.getElementById('backupConfigModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function salvarBackupConfig() {
  const config = {
    enabled: document.getElementById('backupEnabled').checked,
    frequency: document.getElementById('backupFrequency').value,
    google: {
      client_id: document.getElementById('googleClientId').value,
      client_secret: document.getElementById('googleClientSecret').value,
      redirect_uris: [document.getElementById('googleRedirectUri').value],
      refresh_token: document.getElementById('googleRefreshToken').value
    }
  };

  try {
    const resp = await fetch(`${API_URL}/configuracoes/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(config)
    });

    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error || 'Erro ao salvar configuração de backup');
    }

    showNotification('Configuração de backup salva!');
    const modalEl = document.getElementById('backupConfigModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Erro ao salvar configuração de backup', 'danger');
  }
}

async function backupManual() {
  try {
    const resp = await fetch(`${API_URL}/configuracoes/backup/manual`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await resp.json();
    if (resp.ok && data.success) {
      showNotification('Backup enviado para o Google Drive!');
    } else {
      throw new Error(data.error || 'Erro ao fazer backup');
    }
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Erro ao fazer backup', 'danger');
  }
}
