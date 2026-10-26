// Synthetic fixtures are intercepted only in this local test browser. No production writes.
const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const { mkdir } = require("node:fs/promises");
(async () => {
  await mkdir("test-results", { recursive: true });
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3205",
      "-H",
      "127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch("http://127.0.0.1:3205")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready)
      throw Error("Local test server not ready; run npm run build first.");
    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto("http://127.0.0.1:3205");
        await page.getByRole("button", { name: "Entrar no painel" }).waitFor();
        if (
          (await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )) ||
          errors.length
        )
          throw Error("Login overflow or JavaScript error");
        await page.screenshot({
          path: `test-results/login-${viewport.width}.png`,
        });
        const denied = await page.request.get(
          "http://127.0.0.1:3205/api/internal/me",
        );
        if (denied.status() !== 401)
          throw Error("Missing session must return 401");
        const csrf = await page.request.patch(
          "http://127.0.0.1:3205/api/internal/leads/10000000-0000-4000-8000-000000000001/assignment",
          { headers: { origin: "https://other.invalid" }, data: {} },
        );
        if (csrf.status() !== 403)
          throw Error("Cross-origin mutation must return 403");
        console.log(
          `Login ${viewport.width}px and unauthenticated/CSRF boundaries: OK`,
        );
        await page.close();
      }
      const userId = "10000000-0000-4000-8000-000000000001",
        leadId = "20000000-0000-4000-8000-000000000001";
      const payload = {
        sub: userId,
        aal: "aal1",
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const token =
        [{ alg: "HS256", typ: "JWT" }, payload]
          .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
          .join(".") +
        "." +
        Buffer.from("synthetic-signature").toString("base64url");
      const user = {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: "synthetic@example.invalid",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
        factors: [],
      };
      const session = {
        access_token: token,
        refresh_token: "synthetic",
        expires_in: 3600,
        expires_at: payload.exp,
        token_type: "bearer",
        user,
      };
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.context().addCookies([
          {
            name: "concloud-office-auth",
            value:
              "base64-" +
              Buffer.from(JSON.stringify(session)).toString("base64url"),
            domain: "127.0.0.1",
            path: "/",
            sameSite: "Lax",
          },
        ]);
        await page.route("**/auth/v1/**", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(user),
          }),
        );
        const processId = "30000000-0000-4000-8000-000000000001";
        const stages = Array.from({ length: 16 }, (_, i) => [
          `Etapa sintética ${i + 1}`,
          "Checklist sintético",
        ]);
        let processStage = 1,
          processVersion = 1,
          blockTransition = true;
        const processRow = () => ({
          id: processId,
          leadId,
          name: "Processo sintético",
          plan: "essencial",
          workflow: "JUCESP",
          stage: processStage,
          situation: "IN_PROGRESS",
          version: processVersion,
          ownerId: userId,
        });
        let version = 1,
          ownerId = null;
        const lead = () => ({
          id: leadId,
          name: "Teste sintético — homologação local",
          email: "synthetic@example.invalid",
          phone: "000000000",
          plan: "mei",
          status: "DRAFT",
          commercialStage: "STARTED",
          funnelStep: 2,
          lastActivityAt: "2026-10-26T12:00:00Z",
          createdAt: "2026-10-26T12:00:00Z",
          paymentStatus: "PENDING",
          paymentAmount: null,
          paidAt: null,
          pagbankCheckoutId: null,
          ownerId,
          version,
          partners: [],
          events: [],
        });
        await page.route("**/api/internal/**", (route) => {
          const url = new URL(route.request().url());
          const path = url.pathname.replace("/api/internal/", "");
          let data;
          if (path === "processes")
            data = {
              items:
                (!url.searchParams.get("workflow") ||
                  url.searchParams.get("workflow") === "JUCESP") &&
                (!url.searchParams.get("search") ||
                  "Processo sintético".includes(url.searchParams.get("search")))
                  ? [processRow()]
                  : [],
              nextOffset: null,
              workflows: { JUCESP: stages, MEI: stages.slice(0, 7) },
            };
          else if (path === `processes/${processId}`)
            data = {
              ...processRow(),
              stages,
              returnStage: null,
              events: [],
              tasks: [],
              evidence: [],
            };
          else if (path === `processes/${processId}/transitions`) {
            if (blockTransition) {
              blockTransition = false;
              return route.fulfill({
                status: 422,
                contentType: "application/json",
                body: JSON.stringify({
                  error: {
                    code: "BLOCKED",
                    message: "Documento sintético pendente de aprovação",
                  },
                }),
              });
            }
            const body = JSON.parse(route.request().postData());
            processStage = body.targetStage;
            processVersion++;
            data = processRow();
          } else if (path === "me")
            data = {
              user: {
                id: userId,
                email: user.email,
                name: "Operador sintético",
              },
              permissions: {
                admin: true,
                readAll: true,
                documents: true,
                assign: true,
              },
            };
          else if (path === "staff")
            data = { items: [{ userId, displayName: "Operador sintético" }] };
          else if (path === "leads")
            data = {
              items: [lead()],
              nextCursor: null,
              observedAt: new Date().toISOString(),
            };
          else if (path.endsWith("/assignment")) {
            ownerId = JSON.parse(route.request().postData()).ownerId;
            version++;
            data = { id: leadId, version, ownerId };
          } else if (path.endsWith("/documents"))
            data = { items: [], submittedAt: null };
          else data = lead();
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        });
        await page.goto("http://127.0.0.1:3205");
        await page
          .getByRole("heading", { name: "Todos os cadastros" })
          .waitFor({ timeout: 5000 });
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )
        ) {
          await page.screenshot({
            path: "test-results/overflow.png",
            fullPage: true,
          });
          const outside = await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter(
                (el) =>
                  !el.closest(".table-scroll") &&
                  el.getBoundingClientRect().right > window.innerWidth + 1,
              )
              .map((el) => ({
                tag: el.tagName,
                className: el.className,
                width: el.getBoundingClientRect().width,
                right: el.getBoundingClientRect().right,
              }))
              .slice(0, 20),
          );
          throw Error(`Page overflow: ${JSON.stringify(outside)}`);
        }
        await page.screenshot({
          path: `test-results/dashboard-${viewport.width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: "Abrir ficha de Teste sintético — homologação local",
          })
          .click();
        await page.getByRole("dialog").waitFor();
        await page.getByLabel("Responsável pelo cadastro").selectOption(userId);
        await page.getByRole("button", { name: "Salvar responsável" }).click();
        await page
          .getByText("Responsável atualizado.", { exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Documentos", exact: true })
          .click();
        await page.getByText("Nenhum arquivo enviado.").waitFor();
        await page
          .getByRole("button", { name: "Pagamento", exact: true })
          .click();
        await page.getByText("Não registrado", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        if (await page.getByRole("dialog").count())
          throw Error("Escape failed");
        await page
          .getByRole("link", { name: "Funil comercial", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Funil comercial", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Abrir ficha", exact: true })
          .waitFor();
        await page
          .getByRole("link", { name: "Aberturas", exact: true })
          .click();
        await page.getByLabel("Fluxo", { exact: true }).selectOption("");
        await page
          .getByRole("button", { name: "Abrir processo", exact: true })
          .waitFor();
        await page.getByLabel("Buscar cliente").fill("ausente");
        await page
          .getByText("Nenhum cliente encontrado neste filtro.")
          .waitFor();
        await page.getByLabel("Buscar cliente").fill("Processo sintético");
        await page
          .getByRole("button", {
            name: "Processo sintético · Pequenas empresas · SP/JUCESP · Etapa sintética 1",
            exact: true,
          })
          .waitFor();
        const board = page.getByLabel("Quadro operacional JUCESP", {
          exact: true,
        });
        if (viewport.width > 760) {
          await board
            .locator(".process-card")
            .dragTo(board.locator(".kanban-column").nth(1));
          await page
            .getByRole("alert")
            .filter({ hasText: "Documento sintético pendente" })
            .waitFor();
          if (processStage !== 1) throw Error("Blocked drag changed stage");
        } else {
          await page
            .getByRole("button", { name: "Abrir processo", exact: true })
            .click();
        }
        const dialog = page.getByRole("dialog", {
          name: "Processo de abertura",
        });
        await dialog.getByLabel("Etapa de destino").selectOption("2");
        await dialog.getByLabel("Checklist sintético").check();
        await dialog
          .getByLabel("Registro da etapa / motivo / próxima ação")
          .fill("Conferência sintética concluída");
        await dialog.getByRole("button", { name: "Salvar transição" }).click();
        if (viewport.width <= 760) {
          await dialog
            .getByRole("alert")
            .filter({ hasText: "Documento sintético pendente" })
            .waitFor();
          if (processStage !== 1)
            throw Error("Blocked mobile transition changed stage");
          await dialog
            .getByRole("button", { name: "Salvar transição" })
            .click();
        }

        await dialog
          .getByRole("heading", { name: "2. Etapa sintética 2", exact: true })
          .waitFor();
        await dialog.getByRole("button", { name: "Fechar processo" }).click();
        if (viewport.width > 760) {
          await board
            .locator(".kanban-column")
            .nth(1)
            .locator(".process-card")
            .waitFor();
          await board
            .locator(".process-card")
            .dragTo(board.locator(".kanban-column").nth(2));
          await page
            .getByText("Etapa atualizada e salva.", { exact: true })
            .waitFor();
          await board
            .locator(".kanban-column")
            .nth(2)
            .locator(".process-card")
            .waitFor();
          if (processStage !== 3) throw Error("Drag did not persist stage");
          await page
            .getByRole("button", { name: "Atualizar", exact: true })
            .click();
          await board
            .locator(".kanban-column")
            .nth(2)
            .locator(".process-card")
            .waitFor();
        }
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw Error("Operations page overflow");
        await page.screenshot({
          path: `test-results/operations-${viewport.width}.png`,
          fullPage: true,
        });
        if (errors.length) throw Error(errors.join(";"));
        console.log(
          `Synthetic dashboard ${viewport.width}px: list, assignment, documents, payment and keyboard OK`,
        );
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
