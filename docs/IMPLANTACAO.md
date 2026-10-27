# Entrega 1 — implementação e implantação

Atualização: 26/10/2026. O usuário autorizou implementação, commits, push e implantação. Esse pedido substitui a restrição de publicação da etapa inicial de desenho. Envios a clientes continuam fora do escopo.

## Implementado

- Next.js 16.4.3, React 19.3.0 e TypeScript; painel exclusivo ConCloud, identidade visual própria, desktop/mobile.
- Login na identidade Supabase existente, sessão própria do painel, login com e-mail e senha, sem segundo fator. Administrador confirmado vinculado sem alterar senha ou criar nova conta.
- API no portal `/api/internal/v1`; servidor do painel encaminha token do operador, nunca service_role. Proteção CSRF nas mutações e allowlist de rotas.
- Lista paginada por cursor com nome/e-mail/CPF, plano, situação de cadastro/pagamento e responsável. Contagens da tela explicitamente referentes à página atual.
- Ficha e sócios captados pelo portal, campos ausentes explícitos, documentos atuais e downloads privados de 60 segundos com auditoria.
- Cobrança inicial e referências PagBank, sem inferir adimplência de mensalidades futuras.
- Atribuição com versionamento otimista e histórico. Privilégios da equipe consultados no servidor e RLS; funcionário desativado perde acesso.
- Correção no portal: draft persiste mesmo antes de informar sócios e erro de persistência não avança silenciosamente o formulário.

## Banco

Projeto confirmado: `peuqfdgkxkiaszrvpgmq`; somente domínio `concloud`. A inspeção real encontrou histórico Supabase preexistente, contrariando a documentação antiga sobre Prisma remoto. Não foi criado histórico concorrente no painel.

Lote remoto `concloud_opening_internal_rollout` aplicado com fontes do portal: `20261016120000_opening_partners`, `20261026120000_opening_mei`, `20261026200458_opening_internal_panel`. Administração inicial provisionada pelo SQL idempotente versionado `scripts/sql/bootstrap-opening-admin.sql`.

Verificação pós-migration: 4 cadastros, 12 referências documentais; hashes de IDs/objectKeys iguais antes/depois; nenhum lead sem organização; um administrador ativo. A exigência inicial de MFA foi substituída por login com senha por solicitação do responsável. Nenhum arquivo de cliente foi aberto para essa conferência.

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

Kanban/16 etapas e MEI separado, revisões documentais por versão e tarefas evoluem na [Entrega 2](ENTREGA-2.md). SLAs e entrega final vinculada à empresa continuam pendentes. Gestão visual de novos funcionários também não está nesta entrega; concessão é explícita, não automática. Não há aprovação documental, etapas ou métricas de receita fictícias.

Preservar índice único CPF até revisar a retomada/deduplicação. Corrigir idempotência/ordenação/efeitos do webhook antes de automatizar criação de processos. O rollout não dispara mensagens por conta própria; o portal mantém suas rotinas já existentes.

Rollback: reimplantar a versão anterior da aplicação preservando o schema aditivo e os arquivos. Não executar DROP/reset nem apagar histórico. Consulte a documentação do portal para a compatibilidade das funções legadas.

## Correção de dependência detectada no build

O audit apontou advisories críticos na versão Next herdada. Ambos os projetos foram atualizados para Next 16.4.3, versão corretiva oficial: https://github.com/vercel/next.js/releases/tag/v16.4.3. Referência do alerta: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw.

## Endereços publicados

Painel: https://concloud-backend.vercel.app · Portal/API: https://concloud.vercel.app. Primeiros deploys confirmados READY; correções finais seguem os commits de cada repositório.

Testes de navegador versionados em `tests/browser-smoke.cjs`: login, bloqueios 401/403, listagem, ficha, atribuição, documentos vazios, valor ausente e Escape em desktop/mobile, com fixtures sintéticas interceptadas apenas no navegador local. Executar após o build com `npm run test:browser` (Chromium instalado pelo Playwright). Esses testes não gravam dados reais.

## Resultado verificado em produção

- Portal: commit `da8c6b5a3e98378ea705604d968e5cf1a9c98d7d`, deployment `dpl_12kYhxmeWtvc1AXT9tWWebZHN5Rj`, READY.
- Painel: commit de aplicação `8b775eaa1ba767399d0ae56b2b6b1da24b8dab0c`, deployment `dpl_5Lr57y15k2r2Bd1N9EoUhYWoyAs6`, READY.
- URL pública do painel respondeu HTTP 200; login renderizado em 1440px e 390px, sem erro JavaScript ou overflow. API do painel recusou sessão ausente com 401. API do portal também respondeu 401 e Cache-Control privado/no-store.
- Testes locais de navegador passaram em desktop/mobile para login, ficha, atribuição, documentos vazios, pagamento sem valor e navegação por teclado, com fixtures sintéticas. Nenhuma dessas fixtures integra a aplicação publicada.
- Audit final: zero vulnerabilidades reportadas nos dois projetos após as correções compatíveis.
- Checkout local do portal atualizado por fast-forward, preservando `docs/backend/` não versionado; dependências sincronizadas com npm ci.
- Consulta de logs dos dois deployments, nível error, janela de 10 minutos: nenhum evento retornado. É uma observação inicial, não uma homologação de uso autenticado.

## Ajuste solicitado em 26/10/2026

Login interno apenas com e-mail e senha, sem configuração ou desafio de segundo fator. Esta decisão substitui a exigência de MFA do manual de referência. API e RLS aceitam AAL1 e AAL2, mantendo vínculo ativo e concessões. Migration aditiva `20261026203402_opening_password_login` no portal. Logo transparente reutilizado do portal, ampliado para 360px no login e responsivo. Smoke de navegador usa sessão sintética AAL1; a suite RLS valida leitura, atribuição, documentos e revogação com AAL1.

## 26/10/2026 — pagamento automático, busca e Kanban

Portal compartilhado publicado em `87a67ba` (Vercel READY). Migration canônica `20261026212320_opening_automatic_dispatch` aplicada no Supabase compartilhado somente em `concloud`; criação de três processos em Recepção e triagem a partir de pagamentos TEST_BYPASS, com origem de teste explícita. Quatro cadastros e doze documentos preservados. O cadastro PENDING não entrou no quadro. Nenhuma mensagem foi disparada na implantação.

Painel: Todos os fluxos como padrão, busca de cliente no servidor com etapa atual, arrastar com persistência validada e alternativa por botão no celular. Atualização de quadro/funil a cada 15 segundos enquanto visíveis. Checklist salvo só pode ser reaproveitado na mesma versão; requisitos pendentes abrem o diálogo sem mover o card. Plano/UF sem rota suportada permanece em triagem de rota a definir.

Validação: 49 testes no portal aprovados (13 dependentes de PostgreSQL nativo ignorados; PGlite executado), teste do proxy, builds/TypeScript dos dois projetos, lint do portal e smoke de navegador desktop/celular. Testes usam dados sintéticos locais, sem documentos reais. Advisors mantêm somente os seis avisos legados de search_path.

## 26/10/2026 — favicon

Painel reutiliza o ícone transparente oficial já presente no portal (`concloud-icon-2026.png`), declarado como icon, shortcut e apple-touch-icon. Build aprovado e tags conferidas no HTML gerado.

## 27/10/2026 — administrador Igor Borges

Por solicitação explícita do administrador, `igor.borges@oscpaulistana.com.br` passou de ASSISTANT para ORG_ADMIN somente no escritório ConCloud. Vínculos ativos; OpeningStaff com readAll, documents e canAssign habilitados. Atualização transacional com verificação de um único vínculo e confirmação de opening_access para leitura, documentos e atribuição em AAL1. Senha e demais organizações preservadas. A mudança de acesso é imediata no banco; atualizar a página recarrega as permissões no painel.
