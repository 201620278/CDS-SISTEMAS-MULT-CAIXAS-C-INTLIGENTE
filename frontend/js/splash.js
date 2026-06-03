// Controle da Splash Screen - Tela de Carregamento
document.addEventListener('DOMContentLoaded', function() {
    const splashScreen = document.getElementById('splash-screen');
    
    if (splashScreen) {
        // Esconde o splash screen após 800ms (menos de 1 segundo)
        setTimeout(function() {
            splashScreen.classList.add('hide');
            
            // Remove do DOM após a animação (opcional, mas mais limpo)
            setTimeout(function() {
                splashScreen.style.display = 'none';
            }, 500);
        }, 800);
    }
});

// Função para mostrar o splash manualmente se necessário
function showSplash() {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        splashScreen.style.display = 'flex';
        splashScreen.classList.remove('hide');
        
        // Auto-hide após 800ms
        setTimeout(function() {
            splashScreen.classList.add('hide');
        }, 800);
    }
}
