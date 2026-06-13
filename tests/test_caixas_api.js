/**
 * Script de teste para a API de caixas
 * Uso: node tests/test_caixas_api.js
 * 
 * Valida:
 * - GET /api/caixas (listagem)
 * - GET /api/caixas/:id (busca por ID)
 * - POST /api/caixas (criar)
 * - PUT /api/caixas/:id (editar)
 * - DELETE /api/caixas/:id (desativar)
 * - PUT /api/caixas/:id/reativar (reativar)
 */

const http = require('http');
const token = process.env.TOKEN || 'seu_token_aqui';
const baseUrl = 'http://localhost:3001';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== TESTES DA API DE CAIXAS ===\n');

  try {
    // 1. Listar caixas
    console.log('1. GET /api/caixas');
    const list = await request('GET', '/api/caixas');
    console.log(`Status: ${list.status}`, list.body?.total ? `(Total: ${list.body.total})` : '');
    console.log('');

    // 2. Criar novo caixa
    console.log('2. POST /api/caixas - Criar novo caixa');
    const novoBody = {
      nome: `Caixa Teste ${Date.now()}`,
      descricao: 'Teste automatizado',
      terminal_identificador: 'TEST-01',
      ativo: 1
    };
    const criar = await request('POST', '/api/caixas', novoBody);
    console.log(`Status: ${criar.status}`, criar.body?.id ? `(ID: ${criar.body.id})` : `(Erro: ${criar.body?.error})`);
    const novoId = criar.body?.id;
    console.log('');

    if (novoId) {
      // 3. Buscar por ID
      console.log(`3. GET /api/caixas/${novoId} - Buscar caixa criado`);
      const buscar = await request('GET', `/api/caixas/${novoId}`);
      console.log(`Status: ${buscar.status}`, buscar.body?.nome ? `(Nome: ${buscar.body.nome})` : `(Erro: ${buscar.body?.error})`);
      console.log('');

      // 4. Editar caixa
      console.log(`4. PUT /api/caixas/${novoId} - Editar caixa`);
      const editBody = {
        nome: `${novoBody.nome} - Editado`,
        descricao: 'Descrição alterada',
        terminal_identificador: 'TEST-01',
        ativo: 1
      };
      const editar = await request('PUT', `/api/caixas/${novoId}`, editBody);
      console.log(`Status: ${editar.status}`, editar.body?.message || editar.body?.error);
      console.log('');

      // 5. Desativar caixa
      console.log(`5. DELETE /api/caixas/${novoId} - Desativar caixa`);
      const desativar = await request('DELETE', `/api/caixas/${novoId}`);
      console.log(`Status: ${desativar.status}`, desativar.body?.message || desativar.body?.error);
      console.log('');

      // 6. Reativar caixa
      console.log(`6. PUT /api/caixas/${novoId}/reativar - Reativar caixa`);
      const reativar = await request('PUT', `/api/caixas/${novoId}/reativar`);
      console.log(`Status: ${reativar.status}`, reativar.body?.message || reativar.body?.error);
      console.log('');
    }

    // 7. Listar com filtros
    console.log('7. GET /api/caixas?status=ativo&busca=Caixa - Filtrar ativos');
    const filtered = await request('GET', '/api/caixas?status=ativo&busca=Caixa');
    console.log(`Status: ${filtered.status}`, filtered.body?.total ? `(Total: ${filtered.body.total})` : '');
    console.log('');

    console.log('=== TESTES CONCLUÍDOS ===');
  } catch (err) {
    console.error('Erro durante testes:', err.message);
  }
}

runTests();
