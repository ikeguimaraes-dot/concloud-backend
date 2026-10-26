# Arquitetura proposta e registro de decisões

> Atualização: a Entrega 1 foi implementada após autorização do usuário. Consulte [estado atual e implantação](IMPLANTACAO.md); este documento preserva o levantamento/plano inicial quando houver diferenças.
Status: arquitetura adotada para a Entrega 1; detalhes implementados em IMPLANTACAO.md. Data: 26/10/2026.

## Limites confirmados pelo pedido

Uma única fonte de cadastros, pagamentos e documentos; schema privado `concloud`; preservar o outro sistema do Supabase compartilhado. Não publicar nem disparar mensagens nesta etapa. Valores mensais: MEI R$ 39,90; Essencial R$ 99; Gestão R$ 149; Próximo R$ 199.

Projeto Supabase confirmado explicitamente pelo usuário em 26/10/2026: `https://peuqfdgkxkiaszrvpgmq.supabase.co`, o mesmo identificado no portal. Não criar projeto/base independente. Chaves fornecidas na conversa não são reproduzidas nem persistidas neste repositório. O recebimento das chaves não comprova conexão, aplicação de migrations ou configuração de permissões; também não define o organizationId do escritório. A chave service_role não substitui conexão PostgreSQL de runtime/migrations e não deve representar operadores do painel.

## ADR-001 — distribuição dos serviços

Recomendação: Next.js/TypeScript no novo repositório, interface interna e servidor intermediário; regras, APIs internas, Storage, webhook, worker e migrations permanecem inicialmente no portal. O painel não recebe DATABASE_URL, credencial de migrations, token PagBank ou service_role. Isso evita duas autoridades sobre o mesmo estado, ao custo de mudanças coordenadas e dependência da disponibilidade da API do portal.

Fluxo: navegador → servidor do painel → `/api/internal/v1` no portal → serviços autorizados → PostgreSQL/Storage existentes. Não copiar todo o portal nem criar um segundo webhook/cron. Alternativa futura: extrair serviços com migração gradual de contratos, não necessária para Entrega 1.

## ADR-002 — identidade e sessão

Reutilizar Supabase Auth do projeto existente, com sessão própria do painel; não presumir cookies compartilhados entre domínios. Login interno sem cadastro público de privilégios. Servidor do painel encaminha access token do operador; API valida identidade/token (AAL1 ou AAL2), consulta vínculo ativo e permissões atuais e só então abre transação com contexto RLS. Headers com userId/orgId nunca substituem autenticação. Não usar identidade administrativa genérica.

Adicionar adaptador de autenticação Bearer na API compartilhada, pois `currentActor()` atual depende dos cookies do portal. Preservar o fluxo de cookies do portal. Aceitar login com senha nas APIs internas, sem exigir segundo fator; revogação de vínculo deve bloquear a próxima requisição mesmo com JWT ainda válido. Tratar renovação/expiração e impedir sessão demo em integração real. Proteger mutações do servidor do painel contra CSRF; resposta privada com `Cache-Control: no-store` e sem tokens em logs.

Domínio e redirects Auth ainda precisam ser definidos. Consultas oficiais de referência: [MFA](https://supabase.com/docs/guides/auth/auth-mfa) e [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Privilégios de acesso e filtragem de linhas são controles distintos.

## ADR-003 — leads antes de empresa

Decisão confirmada pelo usuário: o painel interno é exclusivo do escritório ConCloud e de sua equipe. Não haverá cadastro ou seletor de escritórios no painel. A organização representa a própria ConCloud, não uma empresa cliente nem outro projeto Supabase. Reutilizar seu registro existente; identificar o UUID e conferir o vínculo dos dados é tarefa técnica de implementação. Não pedir ao usuário um identificador interno nem criar organização duplicada. O servidor fixa e valida esse escopo; manter o isolamento no banco compartilhado não implica oferecer um produto para múltiplos escritórios.

Administrador inicial confirmado pelo usuário: `grupomeeteat@gmail.com`. Na implementação, localizar a identidade Auth confirmada desse e-mail e vinculá-la ao escritório com papel ORG_ADMIN. Não conceder acesso apenas por comparação de e-mail no frontend, não promover contas de outros sistemas e não criar um segundo administrador se o vínculo já existir. Esta decisão foi registrada; conta e vínculo foram verificados e provisionados (ver IMPLANTACAO.md).

Propor vínculo organizationId no OpeningLead, definido pelo servidor na origem do cadastro. Não aceitar organização livre no payload público, nem inferi-la do CPF, e-mail ou primeiro administrador encontrado. Confirmar organização do escritório e regra de origem antes de backfill. Registros ambíguos exigem mapeamento explícito; não desaparecem silenciosamente do relatório de migração.

Migration aditiva no portal: vínculo inicialmente compatível com dados antigos; atualizar todas as funções de criação; backfill conferido por contagens/IDs; validar constraints e políticas; somente então disponibilizar a listagem. O critério de todos os leads exige resolver o mapeamento antes da liberação, não conceder SELECT global.

Reutilizar OrganizationMembership como vínculo ativo da equipe quando compatível; estender convite/ativação no nível de organização, pois os convites atuais são de Company. Adicionar concessões por capacidade e atribuição de lead, sem fabricar empresa/CNPJ. Atribuição comercial do lead é distinta do dono operacional de um processo futuro.

## ADR-004 — permissões e auditoria pré-empresa

Proposta a confirmar:

| Capacidade | Administração | Comercial | Operador designado | Financeiro |
| --- | --- | --- | --- | --- |
| Listar cadastros | Organização | Organização, se aprovado | Atribuídos | Campos financeiros necessários |
| Dados completos | Organização | Contato/comercial | Atribuídos conforme função | Sem identidade pessoal por padrão |
| Documentos pessoais | Concessão explícita | Não por padrão | Concessão explícita + atribuição | Não por padrão |
| Ver cobrança inicial | Sim | Sim | Se concedido | Sim |
| Atribuir responsável | Sim | Não por padrão | Não | Não |

As colunas funcionais não concedem roles automaticamente. Confirmar equipe e matriz antes de implementar políticas. Administração de acessos não precisa implicar leitura de todos os documentos pessoais. Cliente nunca acessa API interna, mesmo que `read`/`finance` atuais o incluam.

Preferir auditoria própria de abertura, com organizationId, leadId, ator, ação, versão, data e mudanças mínimas, append-only. Evita alterar o significado de AuditEvent ligado obrigatoriamente à empresa. Atribuição e evento na mesma transação; membro destino deve estar ativo na mesma organização. Controle otimista por versão, 409 em conflito.

## ADR-005 — arquivos e pagamentos

Entrega 1 consulta metadados atuais e autoriza download pelo ID do documento, nunca por objectKey fornecido pelo navegador. Verificar lead, organização e capacidade antes de assinar objeto do bucket privado. Preservar chaves existentes e acesso do titular; não prometer recuperação de versões que já foram sobrescritas nos metadados. Registrar concessão de download, não declarar que uma URL emitida prova leitura do arquivo. URLs assinadas duram 60 s; revogação não anula uma URL já emitida antes de expirar.

Painel lê valor contratado disponível em paymentAmount; se ausente, mostrar “valor contratado não registrado”. Catálogo atual pode aparecer separadamente, sem reescrever contrato antigo. Mostrar estado bruto da cobrança inicial com tradução, data e referências; não “em dia”. Não editar status de pagamento no painel.

## Decisões necessárias para começar implementação dependente

1. Aceitar serviços/migrations no portal e painel separado? Recomendado.
2. Identificar tecnicamente o registro existente do escritório ConCloud e validar o mapeamento dos leads legados antes do backfill.
3. Administrador inicial definido: `grupomeeteat@gmail.com`. Falta definir o acesso dos demais funcionários a todos os leads, apenas atribuídos e documentos pessoais.
4. Qual domínio interno e ambiente de homologação autorizado?

Podem esperar Entregas 2/3: início operacional antes/depois do pagamento; municípios/rotas; fluxo MEI e serviços incluídos; SLAs/feriados; IRPF condicional; perda/cancelamento; revisão por pessoa distinta; taxas públicas; retenção/exportação; comunicações; validação fiscal de prazos legais. Nada disso será configurado silenciosamente.
