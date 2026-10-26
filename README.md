# ConCloud — painel interno

Painel exclusivo da equipe ConCloud, integrado ao portal e ao banco existente. Entrega 1 implementada: login/MFA, permissões, lista de cadastros parciais e não pagos, ficha, documentos privados, cobrança inicial e atribuição persistida de responsável.

[Acessar painel publicado](https://concloud-backend.vercel.app).

Administrador inicial: `grupomeeteat@gmail.com`, vinculado no banco. Use a senha já existente dessa conta e configure o autenticador no primeiro acesso. Nenhuma senha foi criada ou alterada.

## Executar

Node >=22.12. Copie `.env.example` para `.env.local` e configure apenas as variáveis públicas Supabase e `CONCLOUD_API_ORIGIN` do portal com a API interna implantada.

```sh
npm ci
npm run dev
```

Painel local: `http://localhost:3200`. Não usa credencial PostgreSQL, service_role ou token PagBank. Chamadas passam pelo servidor do painel e propagam o token validável do operador. Sessão em cookie próprio; banco, Storage, APIs e migrations continuam no portal.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

## Documentação

- [Estado da entrega e implantação](docs/IMPLANTACAO.md)
- [Critérios e evidências de verificação](docs/VERIFICACAO.md)
- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Plano e contratos iniciais](docs/ENTREGA-1.md)
- [Inventário original](docs/INVENTARIO.md)
- [Manual de negócio recebido](docs/referencias/MANUAL-DO-SISTEMA.md)
- [Esteira de referência](docs/referencias/esteira-abertura-referencia.jpeg)

Contrato implementado no portal: `docs/internal-api.openapi.yaml`. Kanban operacional, revisões por versão e SLAs continuam nas próximas entregas; não há simulações dessas funções no painel.
