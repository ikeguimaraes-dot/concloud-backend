# Inventário verificado em 26/10/2026

> Atualização: a Entrega 1 foi implementada após autorização do usuário. Consulte [estado atual e implantação](IMPLANTACAO.md); este documento preserva o levantamento/plano inicial quando houver diferenças.
## Evidências e limites

- GitHub de `concloud-backend`: coleção de branches vazia. Checkout local sem commits e sem arquivos de aplicação antes deste levantamento.
- Portal local e último commit remoto: `d2d2253e28138bd78fcdd88f66fa9d3bb23751af`. Código versionado local sem modificações; `docs/backend/` já estava não versionado e foi preservado.
- Instruções: `apps/web/AGENTS.md`, também referenciado por `apps/web/CLAUDE.md`, exige ler a documentação Next instalada antes de escrever código. Nenhum AGENTS encontrado no novo repositório.
- Manual colado idêntico a `concloud/docs/backend/MANUAL-DO-SISTEMA.md`. Imagem da esteira encontrada nessa pasta e inspecionada visualmente. A imagem originalmente anexada ao chat é o logotipo.
- Nenhum dado de cliente, credencial ou schema remoto foi consultado. Estado versionado não comprova estado implantado.

Os caminhos de código abaixo são relativos ao portal, no commit acima.

## O que existe e o que falta

| Área | Evidência | Consequência para o painel |
| --- | --- | --- |
| Stack | `package.json`: Next 16.3.8, React 19.3.0, TS, Prisma 7.10.0, Supabase Auth/Storage, BullMQ | Reutilizar padrões; painel separado é proposta, não backend novo independente |
| Identidade | `apps/web/src/lib/auth.ts`: `getUser`, AAL; `packages/database/client.ts`: membership ativa e MFA no `scoped` | Login não concede vínculo de funcionário; criar autorização sem depender de Company |
| Banco | `prisma.config.ts`, `packages/database/client.ts` | Migrations em `concloud`; runtime rejeita SUPERUSER/BYPASSRLS, contexto transacional |
| Leads | 11 migrations de abertura a partir de `20261005120500`; SQL direto nas rotas | Não constam como models Prisma; não usar geração de schema como inventário completo |
| Escopo | OpeningLead sem organizationId/responsável; `scoped` exige Company | Bloqueador da listagem interna: vínculo organizacional, concessões e RLS próprios |
| Captura | `api/opening-leads/draft/route.ts` e `abrir-empresa/page.tsx` | Só registros persistidos podem aparecer; há falha reproduzida abaixo |
| Documentos | `api/opening-leads/[id]/documents/route.ts`, migrations de documentos/sócios/MEI | Contexto atual exige dono + PAID; acesso interno precisa caminho próprio |
| Downloads | `packages/integrations/src/storage.ts`, `service.ts:downloadDocument` | Adaptador privado com assinatura de 60 s existe; serviço atual é de documentos de Company, não de OpeningLead |
| Arquivos de abertura | `save_opening_lead_document` usa upsert por lead/kind | Metadados anteriores são substituídos. Não anunciar histórico/aprovação por versão na Entrega 1 |
| Limites | Endpoint de abertura 4 MB; SQL aceita até 10 MB | Preservar 4 MB na abertura; não confundir com limite geral |
| Pagamentos | `lib/pagbank.ts`, checkout e webhook | Valores 3990/9900/14900/19900 centavos confirmados; mostrar cobrança inicial e referências existentes |
| Auditoria/filas | Models AuditEvent, OutboxEvent, WebhookEvent exigem companyId | Não reutilizar diretamente para lead sem empresa nem inventar Company para satisfazer FK |
| Equipe | Roles SUPER_ADMIN, ORG_ADMIN, ACCOUNTANT, ASSISTANT, CLIENT_OWNER, CLIENT_MEMBER | Comercial/paralegal/fiscal/financeiro não são papéis existentes; permissões amplas atuais não bastam |
| Esteiras | Sem API interna ou processo de abertura implementado encontrado | Kanban, revisões, SLA e transições ficam para Entregas 2/3 |

## Divergências e riscos concretos

### Draft novo falha após migration de sócios — reproduzido

`20261016120000_opening_partners` adiciona `partners NOT NULL DEFAULT '[]'` e uma constraint de 1 a 21 sócios. Faz backfill dos registros já existentes, mas `save_opening_lead_draft` continua inserindo sem `partners`. Resultado em PGlite, aplicando as 11 migrations de abertura em ordem: SQLSTATE `23514`, constraint `OpeningLead_partners_check`.

O endpoint de draft transforma falha de banco em HTTP 202 `{ok:true,persisted:false}`. `advance()` verifica apenas `response.ok`, portanto avança sem garantia de persistência. O teste existente `tests/opening-mei.test.ts` usa tabelas mínimas e não exercita essa cadeia completa.

Correção planejada: distinguir validação de draft e cadastro final, preservar titular parcial sem inventar participação definitiva, tratar `persisted:false` explicitamente na UI e cobrir todas as sobrecargas legadas de gravação. Falha aqui impede o aceite de captura da Entrega 1. Não é afirmação de incidente em produção: migrations remotas não foram verificadas.

### Uma pessoa ainda não pode ter vários leads

`20261009140000_opening_checkout` cria índice único parcial `OpeningLead_cpf_key`, ainda presente após toda a cadeia. A função final de submissão também reutiliza cadastro por CPF/e-mail. O requisito futuro de múltiplos processos não está atendido. Não remover só o índice: revisar retomada, deduplicação, checkout e identidade do processo juntos. A Entrega 1 lista todos os registros existentes sem reagrupá-los por CPF; política de nova abertura fica pendente.

### Documentação geral de segurança ficou desatualizada

`docs/arquitetura.md` diz que não existe SECURITY DEFINER. As migrations de abertura usam essas funções, com search_path fixado, revogação de PUBLIC e grants ao runtime. Isso não prova exposição pública, mas a descrição geral não vale para todo o produto. Inspecionar funções/grants/políticas efetivos no ambiente autorizado antes de liberar acesso interno; não copiar consultas privilegiadas como solução de listagem.

### Pagamento não equivale a assinatura reconciliada

Webhook valida assinatura e chama notificação antes de persistir pagamento. A função SQL mantém PAID contra regressão de status, mas isso não substitui registro idempotente de evento e tratamento de ordem/efeitos. O caminho não persiste WebhookEvent. Não inferir adimplência recorrente nem criar processos automáticos nesta entrega. Estado PENDING também pode existir sem checkout; exibir essa distinção.

### Dados disponíveis são mais limitados que a ficha proposta

Faltam campos estruturados de várias informações da triagem e endereços separados. `funnelStep` é progresso de formulário, não etapa operacional; `documentsSubmittedAt` é envio, não aprovação. Sócios/documentos usam índices `socio-N`; não permitir reordenação pelo painel sem identidade estável e migração própria.

## Referência operacional preservada

Imagem confirma 16 etapas em quatro fases, travas nas etapas 2 e 11 e retornos 4→2, 6→5, 8→7, 10→9 e 13→10. Não é especificação legal. Rota inicial SP/JUCESP/VRE, municípios, SLAs e etapa 15 continuam sujeitos à decisão do escritório.

MEI tem fluxo separado. Migration `20261026120000_opening_mei` exige um titular e cinco documentos: identidade, título de eleitor, estado civil, endereço residencial e endereço do empreendimento; não exige IPTU. Presença no código não confirma aplicação em produção.
