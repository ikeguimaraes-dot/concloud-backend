# Verificação e critérios de aceite

> Atualização: a Entrega 1 foi implementada após autorização do usuário. Consulte [estado atual e implantação](IMPLANTACAO.md); este documento preserva o levantamento/plano inicial quando houver diferenças.
## Executado nesta etapa de desenho — 26/10/2026

- Estado local/GitHub dos dois repositórios conferido; portal em `d2d2253e28138bd78fcdd88f66fa9d3bb23751af`.
- Leitura de instruções, manual, desenho, autenticação, permissões, rotas de abertura/pagamento/documentos, modelagem e migrations relacionadas.
- Manual colado comparado byte a byte com o arquivo local: idêntico.
- Reprodução isolada em PGlite, exclusivamente em memória: 11 migrations de abertura aplicadas, cadastro parcial sintético novo falhou em `OpeningLead_partners_check` (23514); índice único CPF permanece presente.
- Isso verifica incompatibilidade da cadeia de abertura, não testa RLS de produção, integração HTTP, Supabase remoto ou PagBank.
- Não executados: suíte completa do portal, build, E2E, migrations remotas, login real, download de arquivo real ou testes de produção. Não há aplicação neste repositório para compilar nesta etapa.
- Documentação oficial RLS/MFA consultada. Changelog Markdown não pôde ser obtido (leitor web rejeitou content-type; shell sem resolução DNS). Revisar changelog relevante antes da implementação Supabase.

## Testes requeridos para a Entrega 1 (ainda pendentes)

| ID | Cenário e resultado exigido |
| --- | --- |
| E1-01 | Criar draft pelo portal; verificar persistência e mesmo ID no painel, sem duplicação; repetir após atualizar página |
| E1-02 | Cadeia completa de migrations com drafts antes/depois da migration de sócios, MEI, vários sócios e submissão final; nenhuma incompatibilidade silenciosa |
| E1-03 | Simular falha de banco/ausência de função; UI não comunica salvamento que não aconteceu; cadastro final continua compatível |
| E1-04 | Listar drafts, completos, pagos e não pagos da organização; nenhum filtro padrão exclui incompletos; paginação estável e busca sem vazamento |
| E1-05 | Cliente, sem vínculo, vínculo inativo e token expirado não acessam endpoints internos; AAL1 e AAL2 com concessão funcionam |
| E1-06 | Dois funcionários de organizações distintas não acessam IDs, busca, documentos ou atribuições alheios, inclusive com parâmetros forjados |
| E1-07 | Revogar membership/permissão; próximo request falha mesmo com token ainda válido; negar acesso por user_metadata/headers forjados |
| E1-08 | Documento existente abre só com permissão; objectKey arbitrário recusado; URL expira; bucket privado; sem URL em cache/log |
| E1-09 | Portal mantém upload/acesso autorizado do titular; MEI exige cinco documentos sem IPTU, demais planos mantêm requisitos; PDF/JPG/PNG até 4 MB |
| E1-10 | Atribuição persiste após reload, destino ativo e mesma organização; cliente/outro funcionário não altera sem concessão; auditoria imutável |
| E1-11 | Duas atribuições com mesma versão: uma vence, outra retorna 409; nenhum histórico parcial em falha de transação |
| E1-12 | Pagamento inicial exibe status/valor real ou ausência; PENDING sem checkout distinguível; catálogo não vira receita; não há edição manual de PAID |
| E1-13 | Regressão do webhook em sandbox/test doubles: assinatura inválida, duplicado, ordem invertida e falha de notificação; registrar defeitos existentes antes de qualquer automação |
| E1-14 | Backfill preserva quantidade/IDs/arquivos e mapeia todos os leads; ambiente compartilhado não tem estruturas alheias alteradas |
| E1-15 | RLS com role real NOBYPASSRLS, isolamento entre transações/pool e acesso sem empresa; tests não podem passar só como owner privilegiado |
| E1-16 | Sem sessão demo em produção; erro de API visível; loading/vazio/erro distintos; desktop/mobile e teclado; nenhum mock como dado real |
| E1-17 | Typecheck/lint/test/build dos projetos afetados; ensaio de rollback da aplicação mantendo migrations aditivas e dados |

Fixtures sintéticas devem ficar em banco descartável e nunca disparar e-mail, webhook real ou cobrança. Homologação de Auth/Storage requer ambiente isolado autorizado e é evidência separada de testes locais.

## Continuidade

Próximo passo: confirmar arquitetura, organização, equipe/permissões e domínio/ambiente. Depois preparar correção de drafts no portal e contratos internos. Atualizar este arquivo a cada entrega com comando, resultado, ambiente e limitações; não marcar critérios como cumpridos apenas por existir teste planejado.
