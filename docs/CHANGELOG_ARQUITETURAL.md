# CHANGELOG ARQUITETURAL

**Projeto:** CDS Sistemas  
**Escopo:** Somente mudanças que alteraram a arquitetura da plataforma  
**Não inclui:** bugs, hotfixes, ajustes cosméticos ou correções pontuais  

---

## Status Atual

| Campo | Valor |
|---|---|
| **Arquitetura** | **OFICIAL** |
| **Versão** | **1.0** |
| **Data de consolidação** | 2026-07-10 |
| **Congelamentos** | MIIP `1.0 RC1` · Central Inteligente `1.0 RC4` |
| **Hardening** | RC5 (2026-07-10) |
| **Núcleo Venda** | [NUCLEO_TRANSACIONAL_VENDA_V1.md](./NUCLEO_TRANSACIONAL_VENDA_V1.md) (2026-07-11) |
| **Constituição** | [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md) |

---

## Eventos arquiteturais

### 1. Arquitetura Inicial

| Campo | Conteúdo |
|---|---|
| **Versão** | Pré-plataforma / ERP monolítico |
| **Data** | Fundação do CDS Sistemas |
| **Resumo** | Sistema de gestão comercial (ERP/PDV) com módulos acoplados em rotas e serviços |
| **Arquitetura** | Monólito funcional — sem motores especializados nem pipeline único de entrada fiscal |
| **Motivos** | Atender operação de mercado (vendas, compras, estoque, NFC-e) |
| **Impacto** | Base operacional; dívida estrutural que motivou a plataforma de motores |
| **Documentos relacionados** | `package.json`, `electron.js`, rotas ERP/PDV |

---

### 2. Criação do Motor Fiscal

| Campo | Conteúdo |
|---|---|
| **Versão** | Plataforma Fiscal F1–F10 / RC1.1 |
| **Data** | 2026 (Sprints F1–F10 + consolidação RC1.1) |
| **Resumo** | Introdução de `FiscalWebServices`, Registry, UrlResolver, SoapTransport e runtimes por operação |
| **Arquitetura** | Camada de transporte SEFAZ desacoplada das regras de negócio; fallback legado controlado |
| **Motivos** | Unificar endpoints, TLS, retry, métricas e migração gradual sem quebrar emissão |
| **Impacto** | Autorização NFC-e, cancelamento, DF-e, status, consulta e manifestação (infra) passam pela plataforma |
| **Documentos relacionados** | [FISCAL_PLATFORM.md](./FISCAL_PLATFORM.md), `backend/services/fiscal/core/` |

---

### 3. Criação do Parser Oficial

| Campo | Conteúdo |
|---|---|
| **Versão** | Parser Oficial `1.0` |
| **Data** | Consolidação do pipeline NF-e de entrada |
| **Resumo** | `NFeParserService` / `NFeParser` como única interpretação oficial de XML de entrada |
| **Arquitetura** | Parse separado de identificação (MIIP) e de persistência comercial (`saveCompra`) |
| **Motivos** | Eliminar parsers ad hoc em Compras e fluxos paralelos de XML |
| **Impacto** | Todo XML de entrada deve usar o Parser Oficial antes de MIIP/Central |
| **Documentos relacionados** | `backend/shared/nfe/README.md`, `tests/shared/nfe/nfe-parser.test.js` |

---

### 4. Criação do MIIP

| Campo | Conteúdo |
|---|---|
| **Versão** | MIIP V1 (construção em sprints) |
| **Data** | Ciclo de implementação pré-RC1 |
| **Resumo** | Motor Inteligente de Identificação de Produtos — fachada `MiipService`, pipeline de engines, Decision/Explain/Learning |
| **Arquitetura** | Motor especializado com Orchestrator + Pipeline + 6 engines + Decision Engine único |
| **Motivos** | Centralizar identificação de produtos com score, explicabilidade e aprendizado controlado |
| **Impacto** | Compras e Central deixam de decidir vínculo de produto de forma ad hoc |
| **Documentos relacionados** | [ARQUITETURA_MIIP.md](./ARQUITETURA_MIIP.md), `backend/motores/miip/` |

---

### 5. Congelamento MIIP RC1

| Campo | Conteúdo |
|---|---|
| **Versão** | `1.0.0-rc1` |
| **Data** | 2026-07-05 |
| **Resumo** | Congelamento arquitetural do MIIP — sem novas features; documentação, health, benchmark e deprecações |
| **Arquitetura** | Pipeline oficial fixo (Canonical → Attribute → Synonyms → GTIN → Fornecedor → Similarity → Decision → Explain) |
| **Motivos** | Estabilizar contrato público antes da evolução da plataforma |
| **Impacto** | Alterações de comportamento exigem nova versão e revisão formal |
| **Documentos relacionados** | [MIIP_RC1_RELEASE_NOTES.md](./MIIP_RC1_RELEASE_NOTES.md), [MIIP_RC1_BENCHMARK.md](./MIIP_RC1_BENCHMARK.md), [MIIP_READINESS_REPORT.md](./MIIP_READINESS_REPORT.md) |

---

### 6. Criação da Central Inteligente

| Campo | Conteúdo |
|---|---|
| **Versão** | Central Inteligente (sprints iniciais → RC1) |
| **Data** | Ciclo Central de Entradas |
| **Resumo** | Caixa de entrada fiscal oficial — sync DF-e, inbox, processamento, revisão, bridge para Compras |
| **Arquitetura** | Facade → Orchestrator → Services → Repositories; porta única de documentos de entrada |
| **Motivos** | Eliminar entrada fiscal espalhada (rotas DF-e/Compras) |
| **Impacto** | Rotas legadas de upload/sync passam a HTTP 410; fluxo oficial via `/api/central-entradas` |
| **Documentos relacionados** | [CENTRAL_ENTRADAS_ARQUITETURA.md](./CENTRAL_ENTRADAS_ARQUITETURA.md), `backend/motores/central-entradas/` |

---

### 7. Pipeline Único

| Campo | Conteúdo |
|---|---|
| **Versão** | Central RC1–RC3 (consolidação) |
| **Data** | Consolidação de integridade |
| **Resumo** | Um único pipeline: SEFAZ/Upload/Chave → Central → Parser → MIIP → Revisão → Compras → `saveCompra` → ERP |
| **Arquitetura** | Proibição explícita de fluxos paralelos de entrada/identificação |
| **Motivos** | Garantir rastreabilidade, estados e reutilização |
| **Impacto** | Upload Compras e sync DF-e legado descontinuados como porta de entrada |
| **Documentos relacionados** | [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md) Cap. 6, [CENTRAL_ENTRADAS_ARQUITETURA.md](./CENTRAL_ENTRADAS_ARQUITETURA.md) |

---

### 8. Upload Enterprise

| Campo | Conteúdo |
|---|---|
| **Versão** | Upload Enterprise `1.0` (Central) |
| **Data** | Sprint de upload na Central |
| **Resumo** | `CentralUploadService` como único upload oficial de XML de entrada |
| **Arquitetura** | Upload → persistência inbox → mesmo pipeline de processamento |
| **Motivos** | Substituir upload em Compras e unificar validação/eventos |
| **Impacto** | `POST` de upload em Compras retorna **410 Gone** |
| **Documentos relacionados** | `CentralUploadService.js`, `backend/rotas/compras.js` (410) |

---

### 9. Central Configuração RC4

| Campo | Conteúdo |
|---|---|
| **Versão** | `1.0.0-rc4` |
| **Data** | 2026-07-10 |
| **Resumo** | Central de Configuração Enterprise — `CentralConfiguracaoService` como único provider operacional |
| **Arquitetura** | Tela 6 abas → Controller → Service → Repository → Sync com `contextoCentral` (sem URLs espalhadas / sem 502 genérico) |
| **Motivos** | Independência operacional da Central em relação ao Motor Fiscal para config de sync/SEFAZ/timeouts |
| **Impacto** | Diagnóstico e sync consomem contexto oficial; certificado físico permanece no cadastro fiscal via adapter |
| **Documentos relacionados** | [CENTRAL_ENTRADAS_ARQUITETURA.md](./CENTRAL_ENTRADAS_ARQUITETURA.md), `tests/central-entradas/rc4-configuracao.test.js` |

---

### 10. Arquitetura Oficial v1.0

| Campo | Conteúdo |
|---|---|
| **Versão** | Arquitetura Oficial **1.0** |
| **Data** | 2026-07-10 |
| **Resumo** | Publicação da Constituição Arquitetural do CDS Sistemas |
| **Arquitetura** | Plataforma Inteligente de Gestão Empresarial — motores, pipelines, orchestrators, contratos e regras normativas |
| **Motivos** | Encerrar a fase estrutural V1 e orientar toda evolução futura |
| **Impacto** | Nenhuma Sprint estrutural pode contrariar o documento sem revisão arquitetural formal |
| **Documentos relacionados** | [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md), este changelog, auditoria final V1 |

---

### 11. Hardening Final RC5

| Campo | Conteúdo |
|---|---|
| **Versão** | Plataforma CDS **V1** (hardening) |
| **Data** | 2026-07-10 |
| **Resumo** | Eliminação das pendências da Auditoria Final: README RC4, provider único de config, Diagnóstico via Fiscal Platform, readiness regenerado, inventário deprecated/TODO |
| **Arquitetura** | Sem novas features; consistência documental e de wiring |
| **Motivos** | Elevar V1 ao máximo de consistência antes do ciclo 2.0 |
| **Impacto** | Divergências conhecidas da auditoria eliminadas ou classificadas |
| **Documentos relacionados** | [AUDITORIA_FINAL_CDS_V1.md](./AUDITORIA_FINAL_CDS_V1.md), [RC5_HARDENING_INVENTARIO.md](./RC5_HARDENING_INVENTARIO.md), [RC5_PARECER.md](./RC5_PARECER.md) |

---

### 12. Núcleo Transacional da Venda V1.0 (Sprint 1 — Fase 1)

| Campo | Conteúdo |
|---|---|
| **Versão** | Núcleo Transacional Venda **1.0** |
| **Data** | 2026-07-11 |
| **Resumo** | Consolidação documental do pipeline oficial de venda (`POST /api/vendas` → `VendaPagamentoService` → motores F×NF / pagamento / estoque / financeiro / NFC-e) |
| **Arquitetura** | PDV deixa de ser descrito como centro; núcleo = agregado Venda + `VendaPagamentoService`; origens futuras documentadas sem implementação |
| **Motivos** | Preparar Pedidos, Faturamento NF-e, Compra Fácil e API sem alterar regras congeladas |
| **Impacto** | Nenhuma alteração de código, banco, rotas, payload ou regras (F×NF, financeiro, estoque, TEF, PIX, NFC-e) |
| **Documentos relacionados** | [NUCLEO_TRANSACIONAL_VENDA_V1.md](./NUCLEO_TRANSACIONAL_VENDA_V1.md), [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md) |

---

### 13. Porta de Aplicação do Núcleo Transacional (Sprint 2.0)

| Campo | Conteúdo |
|---|---|
| **Versão** | Núcleo Transacional Venda **1.1** |
| **Data** | 2026-07-11 |
| **Resumo** | Introdução de `VendaApplicationService` como fachada oficial entre Controller e `VendaPagamentoService` |
| **Arquitetura** | `Controller → VendaApplicationService → VendaPagamentoService` (delegação integral, sem regras na fachada) |
| **Motivos** | Impedir que Pedido, Faturamento, Compra Fácil, Marketplace e API acessem o núcleo diretamente |
| **Impacto** | Comportamento idêntico; apenas wiring de entrada. Núcleo, F×NF, financeiro, estoque, TEF, PIX e NFC-e **inalterados** |
| **Documentos relacionados** | [NUCLEO_TRANSACIONAL_VENDA_V1.md](./NUCLEO_TRANSACIONAL_VENDA_V1.md), [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md) |

---

### 14. Unificação da Configuração Fiscal (RC3.1)

| Campo | Conteúdo |
|---|---|
| **Versão** | RC3.1 |
| **Data** | 2026-07-14 |
| **Resumo** | Eliminação da duplicação `fiscal_ambiente` × `central_ambiente` — **existe apenas uma configuração fiscal** |
| **Arquitetura** | Configurações Avançadas → `getFiscalConfig()` → Central (somente leitura) / Emissão / DF-e / Plataforma (por parâmetro) |
| **Motivos** | Auditoria confirmou risco operacional silencioso (Central em Homologação e emissão em Produção) |
| **Impacto** | Central deixa de gravar ambiente/UF; aba Ambiente vira somente leitura; timeouts/sync permanecem editáveis; Plataforma Fiscal/XML/SOAP/runtimes **inalterados** |
| **Documentos relacionados** | [CENTRAL_ENTRADAS_ARQUITETURA.md](./CENTRAL_ENTRADAS_ARQUITETURA.md), [ARQUITETURA_OFICIAL_CDS_V1.md](./ARQUITETURA_OFICIAL_CDS_V1.md), `tests/central-entradas/rc31-fonte-fiscal-unica.test.js` |

---

### 15. Centro de Configurações CDS (RC3.2)

| Campo | Conteúdo |
|---|---|
| **Versão** | RC3.2 |
| **Data** | 2026-07-14 |
| **Resumo** | Modernização UX das Configurações Avançadas → **Centro de Configurações do CDS Sistemas** |
| **Arquitetura** | Shell lateral + painel executivo + cards; Fiscal permanece fonte oficial (RC3.1); sem mudança de APIs/regras |
| **Motivos** | Alinhar identidade visual à Central / Dashboard / Diagnóstico e consolidar navegação enterprise |
| **Impacto** | Somente frontend (CSS/JS/HTML); Central ganha atalho UX “Abrir Configuração Fiscal” |
| **Documentos relacionados** | [RC3.2_CENTRO_CONFIGURACOES.md](./RC3.2_CENTRO_CONFIGURACOES.md) |

---

### RC3.4 — Homologação Assistida (observabilidade)

| Campo | Conteúdo |
|---|---|
| **Versão** | Central Inteligente — RC3.4 |
| **Data** | 2026-07-15 |
| **Resumo** | Painel somente leitura de telemetria do ciclo DF-e para homologação SEFAZ (monitor, timeline, diagnóstico, métricas, inspeção, exportação) |
| **Arquitetura** | Sem mudança de regras fiscais; agregação de eventos/NSU/documentos existentes via `CentralHomologacaoService` |
| **Motivos** | Validar comportamento real junto à SEFAZ após RC3.3 / RC3.3.3 |
| **Impacto** | APIs `/homologacao/*` + view Monitor de Ciclo DF-e; Plataforma Fiscal / Parser / MIIP intactos |
| **Documentos relacionados** | [RC3.4_HOMOLOGACAO_ASSISTIDA.md](./RC3.4_HOMOLOGACAO_ASSISTIDA.md) |

---

### RC4.1 — UX Endpoints SEFAZ

| Campo | Conteúdo |
|---|---|
| **Versão** | Central Inteligente — RC4.1 |
| **Data** | 2026-07-15 |
| **Resumo** | Campos Manifestação exibem URL resolvida (Registry→UrlResolver); badges de política únicos; tooltip e card Plataforma Fiscal |
| **Arquitetura** | Sem mudança na Plataforma Fiscal; painel da Central apenas consome `resolve()` para apresentação |
| **Motivos** | Campos vazios e badges contraditórios geravam falsa impressão de erro de configuração |
| **Impacto** | Somente `CentralConfiguracaoService` + UI/CSS da aba SEFAZ |
| **Documentos relacionados** | [RC4.1_ENDPOINTS_UX.md](./RC4.1_ENDPOINTS_UX.md) |

---

### RC4.3 — Consolidação UX Manifestação

| Campo | Conteúdo |
|---|---|
| **Versão** | Central / Centro Config — RC4.3 |
| **Data** | 2026-07-15 |
| **Resumo** | Interface oficial de edição da política de Manifestação no Centro → Fiscal; Central somente leitura |
| **Arquitetura** | Mesma tabela/chave/API; sem duplicidade de persistência |
| **Motivos** | Usuário buscava a config no Centro Fiscal; ela estava aninhada na Central |
| **Impacto** | Somente frontend (cds-centro-configuracoes + central-entradas) |
| **Documentos relacionados** | [RC4.3_CONSOLIDACAO_MANIFESTACAO.md](./RC4.3_CONSOLIDACAO_MANIFESTACAO.md) |

---

### RC4.3.1 — HotFix alinhamento arquitetural

| Campo | Conteúdo |
|---|---|
| **Versão** | HotFix RC4.3.1 |
| **Data** | 2026-07-15 |
| **Resumo** | Consulta chave RO + UrlResolver; feedback unificado; nomenclatura Centro de Configurações |
| **Arquitetura** | Endpoints SEFAZ não editáveis/persistidos pela Central; resolução = Plataforma Fiscal |
| **Motivos** | Fechar divergências da auditoria final de consistência |
| **Impacto** | CentralConfiguracaoService (painel) + UI Central/Centro/core; sem mudança Plataforma Fiscal |
| **Documentos relacionados** | [RC4.3.1_HOTFIX_ALINHAMENTO.md](./RC4.3.1_HOTFIX_ALINHAMENTO.md) |

---

## Linha do tempo (resumo)

```mermaid
timeline
  title Evolução Arquitetural CDS Sistemas
  section Fundação
    Arquitetura Inicial : ERP/PDV monolítico
  section Especialização
    Motor Fiscal : FiscalWebServices F1–F10
    Parser Oficial : NFeParserService 1.0
    MIIP : Pipeline + Decision
  section Congelamentos
    MIIP RC1 : 1.0.0-rc1 congelado
    Central : Porta única + Pipeline único
    Upload Enterprise : 410 em Compras
    Central RC4 : Configuração Enterprise
  section Constituição
    Arquitetura Oficial v1.0 : OFICIAL
    Hardening RC5 : Consistência final V1
  section Núcleo Venda
    Núcleo Transacional V1.0 : Documentação oficial Sprint 1
    Porta Aplicação V1.1 : VendaApplicationService Sprint 2.0
```
