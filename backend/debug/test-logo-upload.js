/**
 * Teste de Upload de Logo - Adicione este código no console do browser (F12)
 * Isso vai ajudar a diagnosticar o problema
 */

async function testarUploadLogo() {
    console.log('🔍 Iniciando teste de upload de logo...');
    
    // 1. Verificar token
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('❌ Token não encontrado! Faça login primeiro.');
        return;
    }
    console.log('✅ Token encontrado');
    
    // 2. Criar arquivo de teste (1KB PNG válido em base64)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
    const binaryString = atob(pngBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });
    console.log('✅ Arquivo de teste criado:', blob.size, 'bytes');
    
    // 3. Preparar FormData
    const formData = new FormData();
    formData.append('logo', blob, 'test-logo.png');
    console.log('✅ FormData preparado');
    
    // 4. Enviar requisição
    try {
        console.log('📤 Enviando para: ' + API_URL + '/configuracoes/upload-logo');
        const response = await fetch(API_URL + '/configuracoes/upload-logo', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        });
        
        console.log('📍 Status:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('📦 Resposta:', data);
        
        if (response.ok) {
            console.log('✅ SUCESSO! Logo salva em:', data.path);
        } else {
            console.error('❌ Erro do servidor:', data.error);
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }
}

// Execute no console:
// testarUploadLogo()

console.log('💡 Para testar, execute no console: testarUploadLogo()');
