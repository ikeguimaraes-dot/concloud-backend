# Entrega 1 — implementação e implantação

Atualização: 26/10/2026. O usuário autorizou implementação, commits, push e implantação. Esse pedido substitui a restrição de publicação da etapa inicial de desenho. Envios a clientes continuam fora do escopo.

## Implementado

- Next.js 16.3.8, React 19.3.0 e TypeScript; painel exclusivo ConCloud, identidade visual própria, desktop/mobile.
- Login na identidade Supabase existente, sessão própria do painel, MFA obrigatório e configuração de TOTP. Administrador confirmado vinculado sem alterar senha ou criar nova conta.
- API no portal `/api/internal/v1`; servidor do painel encaminha token do operador, nunca service_role. Proteção CSRF nas mutações e allowlist de rotas.
- Lista paginada por cursor com nome/e-mail/CPF, plano, situação de cadastro/pagamento e responsável. Contagens da tela explicitamente referentes à página atual.
- Ficha e sócios captados pelo portal, campos ausentes explícitos, documentos atuais e downloads privados de 60 segundos com auditoria.
- Cobrança inicial e referências PagBank, sem inferir adimplência de mensalidades futuras.
- Atribuição com versionamento otimista e histórico. Privilégios da equipe consultados no servidor e RLS; funcionário desativado perde acesso.
- Correção no portal: draft persiste mesmo antes de informar sócios e erro de persistência não avança silenciosamente o formulário.

## Banco

Projeto confirmado: `peuqfdgkxkiaszrvpgmq`; somente domínio `concloud`. A inspeção real encontrou histórico Supabase preexistente, contrariando a documentação antiga sobre Prisma remoto. Não foi criado histórico concorrente no painel.

Lote remoto `concloud_opening_internal_rollout` aplicado com fontes do portal: `20261016120000_opening_partners`, `20261026120000_opening_mei`, `20261026200458_opening_internal_panel`. Administração inicial provisionada pelo SQL idempotente versionado `scripts/sql/bootstrap-opening-admin.sql`.

Verificação pós-migration: 4 cadastros, 12 referências documentais; hashes de IDs/objectKeys iguais antes/depois; nenhum lead sem organização; um administrador ativo. A conta ainda não tinha fator MFA verificado e deverá configurá-lo no primeiro acesso. Nenhum arquivo de cliente foi aberto para essa conferência.

O projeto remoto usa `supabase_migrations.schema_migrations`; a autoridade de código segue `concloud/packages/database/migrations`. Não executar Prisma deploy no remoto antes de formalizar o baseline. Não alterar entradas do outro sistema. Prisma continua aplicável a bases locais novas.

## Configuração Vercel

Equipe existente: `team_ulJarooO9YnQ8PN054EigvFZ`.

- Portal: projeto `concloud`, origem `https://concloud.vercel.app`.
- Painel: projeto `concloud-backend`, ID `prj_m4ARkeRt4GGeWW7EsdE9UnSabbqN`.
- Painel recebe somente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública publishable) e `CONCLOUD_API_ORIGIN`.
- Chaves administrativas não foram copiadas para o painel. `.env.local` e `.vercel` são ignorados pelo Git.

## Validação e limites

Build dos dois projetos, TypeScript, lint dos arquivos do portal alterados e testes aprovados. Portal: 36 testes aprovados, 13 ignorados por dependerem de PostgreSQL nativo configurado. Os testes RLS/migrations novos rodaram em PGlite com a cadeia completa. Painel: teste da allowlist e smoke do navegador em 1440px/390px, sem erro JS ou overflow, API sem sessão 401 e mutação de outra origem 403.

Login humano com senha e código TOTP, abertura de documento real e atribuição de cliente real não foram executados. Nenhuma credencial pessoal foi solicitada. A conexão administrativa MCP não permite assumir concloud_runtime; não ampliamos privilégios para isso. A homologação autenticada final deve ser feita pelo administrador no painel.

## Próximas entregas

Kanban/16 etapas e MEI separado, revisões documentais por versão, tarefas, SLAs e entregas finais continuam pendentes. Gestão visual de novos funcionários também não está nesta entrega; concessão é explícita, não automática. Não há aprovação documental, etapas ou métricas de receita fictícias.

Preservar índice único CPF até revisar a retomada/deduplicação. Corrigir idempotência/ordenação/efeitos do webhook antes de automatizar criação de processos. O rollout não dispara mensagens por conta própria; o portal mantém suas rotinas já existentes.

Rollback: reimplantar a versão anterior da aplicação preservando o schema aditivo e os arquivos. Não executar DROP/reset nem apagar histórico. Consulte a documentação do portal para a compatibilidade das funções legadas.
