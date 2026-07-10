# Central Inteligente de Entradas

**Versão:** `1.0.0-rc4` · Configuração Enterprise RC4  
**Módulo:** Caixa de Entrada Fiscal — **única porta oficial** de documentos fiscais  
**Status:** Congelada (Arquitetura CDS V1)

## Pipeline oficial

```
SEFAZ (DF-e) / Upload XML / Consulta chave
    ↓
CentralDfePersistenciaService → SINCRONIZADA
    ↓
CentralEntradasOrchestrator
    ↓
CentralProcessamentoService (Parser Oficial → MIIP)
    ↓
Revisão / PRONTA_PARA_COMPRA
    ↓
Compras (abrir-compra → saveCompra → Orchestrator.vincularCompra)
    ↓
ERP
```

## Configuração Enterprise (RC4)

Provider oficial único: **`CentralConfiguracaoService`**.

```
Tela Configuração (6 abas)
    ↓
GET/PUT /api/central-entradas/configuracao
    ↓
CentralConfiguracaoService
    ↓
central_entradas_config
    ↓
Sync DF-e (contextoCentral)
```

`CentralConfigService` é **adapter interno de sync** — não deve ser usado fora de `CentralConfiguracaoService`.

## Estrutura

```
motores/central-entradas/
├── CentralEntradasService.js           # Facade
├── CentralEntradasOrchestrator.js      # Orchestrator único (1.0.0-rc4)
├── controllers/CentralConfiguracaoController.js
├── config/
├── contracts/
├── core/                               # Estados + máquina
├── repositories/                       # + CentralConfiguracaoRepository
├── services/                           # Config, Sync, Processamento, Diagnóstico…
└── utils/                              # eventos, logs, mappers
```

## API consolidada (RC4)

| Método | Rota | Descrição |
|---|---|---|
| GET/PUT | `/configuracao` | Painel Enterprise (6 módulos) |
| POST | `/configuracao/testar-sefaz` | Teste SEFAZ via Fiscal Platform |
| POST | `/configuracao/testar-certificado` | Teste certificado |
| POST | `/configuracao/health` | Health check |
| POST | `/configuracao/limpar-cache` | Limpar cache diagnóstico |
| GET | `/inteligencia` | Alertas + operacional + pendências + atenção (1 cálculo) |
| GET | `/operacional` | KPIs operacionais |
| GET | `/alertas` | Alertas |
| GET | `/pendencias` | Pendências |
| GET | `/atencao` | Itens de atenção |

## Testes

```bash
npm run test:central-integridade
npm run test:central-entradas-rc4
```

Documentação: [`docs/CENTRAL_ENTRADAS_ARQUITETURA.md`](../../../docs/CENTRAL_ENTRADAS_ARQUITETURA.md) · [`docs/ARQUITETURA_OFICIAL_CDS_V1.md`](../../../docs/ARQUITETURA_OFICIAL_CDS_V1.md)
