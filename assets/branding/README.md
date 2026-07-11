# Branding Oficial CDS Sistemas — 1.0

Pasta canônica da identidade visual.

| Arquivo | Uso |
|---|---|
| `logo-oficial.png` | Logo principal (login, splash, marca) |
| `logo-auxiliar.png` | Sidebar / usos secundários |
| `favicon.ico` | Favicon Web |
| `icon.ico` | Ícone Electron / instalador |
| `splash.png` | Splash de carregamento |
| `login-background.png` | Fundo padrão do login |
| `marca-dagua.png` | Marca d'água / documentos |
| `BrandService.js` | Serviço Node/Electron |

URL Web (após `express.static`): `/branding/<arquivo>`

API: `BrandService` (Node) e `window.BrandService` (Web via `frontend/shared/js/brand-service.js`).
