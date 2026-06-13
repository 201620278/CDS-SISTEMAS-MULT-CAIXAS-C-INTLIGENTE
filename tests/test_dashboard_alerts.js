// Teste simples para o endpoint do dashboard que contém alertas
// Uso: node tests/test_dashboard_alerts.js
const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const TOKEN = process.env.TEST_TOKEN || '';

async function run() {
  try {
    const res = await fetch(`${API_URL}/dashboard/resumo`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + TOKEN }
    });

    console.log('Status:', res.status);
    const body = await res.json();
    console.log('Resumo keys:', Object.keys(body));
    console.log('Alerts:', JSON.stringify(body.alerts || {}, null, 2));

    if (!res.ok) process.exitCode = 2;
  } catch (e) {
    console.error('Erro:', e);
    process.exitCode = 1;
  }
}

run();
