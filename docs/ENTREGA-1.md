# Entrega 1 — plano executável após decisões

> Atualização: a Entrega 1 foi implementada após autorização do usuário. Consulte [estado atual e implantação](IMPLANTACAO.md); este documento preserva o levantamento/plano inicial quando houver diferenças.
Objetivo: equipe autorizada encontra todos os leads persistidos, inclusive incompletos e não pagos, consulta ficha/documentos/cobrança inicial e atribui responsável sem recadastrar cliente.

## Sequência e dependências

| Passo | Repositório | Trabalho | Saída verificável |
| --- | --- | --- | --- |
| 1 | Ambos | Fechar ADRs 001–004, organização e matriz de acesso; definir ambiente | Decisões registradas com responsável e data |
| 2 | Portal | Inventário somente leitura de migrations, funções, constraints, roles e bucket no ambiente autorizado | Comparação versionado/aplicado; nenhum dado pessoal em relatório |
| 3 | Portal | Corrigir persistência de draft e tratamento de `persisted:false`; testar cadeia completa | Novo cadastro parcial realmente persistido; falha visível sem falso sucesso |
| 4 | Portal | Migrations aditivas para escopo, acesso de equipe, atribuição/versão e auditoria pré-empresa | Backfill validado e RLS testado em duas organizações |
| 5 | Portal | Adaptador Bearer/AAL2, serviços e contratos internos | API integrada real sem depender de Company ou pagamento |
| 6 | Painel | Login/MFA, sessão, tabela paginada, ficha, documentos e atribuição | Interface conectada, com estados vazios/erro/sem acesso reais |
| 7 | Ambos | Testes de integração e regressão; homologação isolada | Evidências de todos os aceites e plano de rollback |

Não implementar Kanban, revisão documental, novas cobranças, mensageria ou automação de órgãos nesta entrega. Reparar o webhook deve ser trabalho coordenado próprio antes de automatizar efeitos; não é necessário duplicá-lo para consulta da situação persistida.

## Contrato proposto `/api/internal/v1`

Não implementado. Versionar OpenAPI no portal antes dos consumidores; verificar compatibilidade em CI dos dois repositórios. API é autoridade, sem copiar modelos Prisma para o navegador.

| Método e rota | Conteúdo/semântica |
| --- | --- |
| GET `/me` | Identidade validada, vínculos autorizados, capacidades; sem segredos |
| GET `/leads` | cursor, limit (padrão 25/máximo 100), search, plan, registrationStatus, paymentStatus, ownerId, datas |
| GET `/leads/:id` | Cadastro captado, campos ausentes explícitos, sócios, progresso do formulário, resumo de pagamento, responsável e versão |
| GET `/leads/:id/documents` | IDs, tipo, titular/índice legado, nome, MIME, tamanho e data; sem storage key ou URL pública |
| POST `/leads/:id/documents/:documentId/download` | Autorizar e auditar; emitir URL temporária e expiresAt; no-store |
| GET `/staff?capability=lead_assignment` | Somente membros elegíveis da organização validada |
| PATCH `/leads/:id/assignment` | `{ownerId, expectedVersion}`; null remove atribuição se permitido; mudança + auditoria atômicas |

Downloads usam o documento atual na Entrega 1. Endpoint de `document-versions` pertence à evolução com versões reais, evitando inventar entidades inexistentes.

Lista retorna `{items,nextCursor,observedAt}` com ordenação estável `createdAt DESC, id DESC`; cursor inclui chave de ordenação e contexto dos filtros. Filtros nunca ampliam escopo autorizado. Busca parametrizada por nome/e-mail/CPF normalizado, sem registrar busca/PII em logs. Não prometer busca de CNPJ/número de processo ainda inexistente no lead.

Ficha preserva ID; plano pode ser null em draft; separar registrationStatus, formProgress, payment e assignment. Não transformar DRAFT/NEW em estágio operacional. Payment inclui status, amountCents nullable, paidAt/paymentUpdatedAt e referências disponíveis; nunca apresentar o preço do catálogo como valor recebido.

Erros estruturados `{error:{code,message,correlationId}}`: 401 sessão inválida; 403 MFA/permissão; 404 ID inexistente ou fora de escopo; 409 versão concorrente; 422 entrada inválida; 429 limite; 503 integração indisponível. Sem SQL, credenciais ou detalhes de cliente nas mensagens. Indisponibilidade não retorna lista vazia fictícia.

## Telas

1. Login → MFA → cadastros. Usuário autenticado sem vínculo recebe acesso negado.
2. Cadastros: nome/contato permitido, plano, progresso, última atividade, pagamento inicial, responsável; filtros e paginação de servidor; data da consulta e ação de atualizar.
3. Ficha: resumo, cadastro/sócios, documentos atuais e pagamento. Campo ausente mostra “não informado”. Evitar abas de jornada/tarefas sem implementação.
4. Atribuição: seletor de membros elegíveis; sucesso somente após persistência. Conflito pede atualização e mostra responsável atual.
5. Arquivo: botão solicita autorização específica. “Enviado” e “finalizado pelo cliente” não significam “aprovado”.

## Migração e reversibilidade

Autoridade única: `concloud/packages/database/migrations`, Prisma Migrate. Não criar migrations paralelas no painel. Desenhar SQL só após escopo aprovado; revisar todas as sobrecargas SQL de abertura, não só Prisma. Não executar reset/db push/seed no projeto compartilhado.

Ordem: alteração aditiva compatível → atualização de gravações → backfill explícito → validação de vínculos/contagens e grants → endpoints → painel. Sem acesso amplo transitório. Ensaiar em banco descartável; rollout remoto é etapa posterior autorizada. Rollback do painel/API mantém dados e campos aditivos; não apagar histórico/arquivos. Confirmar compatibilidade de rollback do portal com a nova escrita antes da liberação.
