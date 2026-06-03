/**
 * Script de teste - Cole no console do browser (F12)
 * para testar o carregamento da logo
 */

function testarCarregamentoLogo() {
    console.log('🧪 Testando carregamento da logo...\n');
    
    // 1. Verificar token
    const token = localStorage.getItem('token');
    console.log('1️⃣ Token:', token ? '✅ Existe' : '❌ Não encontrado');
    
    // 2. Verificar elemento da sidebar
    const sidebarBrand = document.getElementById('sidebar-brand');
    console.log('2️⃣ Elemento #sidebar-brand:', sidebarBrand ? '✅ Existe' : '❌ Não encontrado');
    
    // 3. Verificar função carregarLogoSidebar
    console.log('3️⃣ Função carregarLogoSidebar:', typeof carregarLogoSidebar === 'function' ? '✅ Existe' : '❌ Não encontrada');
    
    // 4. Executar carregamento da logo
    console.log('\n4️⃣ Carregando logo...');
    if (typeof carregarLogoSidebar === 'function') {
        carregarLogoSidebar()
            .then(() => {
                console.log('✅ Logo carregada com sucesso!');
                const img = sidebarBrand?.querySelector('img');
                if (img) {
                    console.log('📸 Imagem encontrada:', img.src);
                } else {
                    const text = sidebarBrand?.innerText;
                    console.log('📝 Texto exibido:', text);
                }
            })
            .catch(err => {
                console.error('❌ Erro ao carregar logo:', err);
            });
    } else {
        console.error('❌ Função carregarLogoSidebar não existe');
    }
}

// Executar teste
console.log('%c🚀 TESTE DE CARREGAMENTO DE LOGO', 'font-size: 16px; color: #0066cc; font-weight: bold;');
console.log('Executando testarCarregamentoLogo()...\n');
testarCarregamentoLogo();

// Mostrar as configurações salvas
console.log('\n' + '='.repeat(50));
console.log('📋 Verificando configurações salvas...\n');

const token = localStorage.getItem('token');
const API_URL = 'http://localhost:3000/api';

fetch(`${API_URL}/configuracoes`, {
    headers: {'Authorization': `Bearer ${token}`}
})
.then(r => r.json())
.then(configs => {
    const logoConfig = configs.find(c => c.chave === 'logo');
    if (logoConfig) {
        console.log('✅ Logo encontrada no banco de dados:');
        console.log('   Caminho:', logoConfig.valor);
        console.log('   URL completa:', logoConfig.valor.startsWith('/') 
            ? `http://localhost:3000${logoConfig.valor}` 
            : logoConfig.valor);
    } else {
        console.log('⚠️ Nenhuma logo configurada ainda');
    }
})
.catch(err => console.error('❌ Erro ao buscar configurações:', err));
