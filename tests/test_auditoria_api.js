// Teste simples para API de auditoria
// Uso: node tests/test_auditoria_api.js
// Define TEST_API_URL (ex: http://localhost:3000/api) e TEST_TOKEN no ambiente ou edite abaixo.

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const TOKEN = process.env.TEST_TOKEN || '';

async function run() {
  try {
    const res = await fetch(`${API_URL}/auditoria/list?page=1&pageSize=5`, {
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });

    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Resposta:', JSON.stringify(body, null, 2));

    if (!res.ok) process.exitCode = 2;
  } catch (e) {
    console.error('Erro:', e);
    process.exitCode = 1;
  }
}

run();
