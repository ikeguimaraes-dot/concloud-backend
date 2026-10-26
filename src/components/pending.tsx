"use client";
import { useEffect, useState } from "react";
import { ProcessEditor } from "./operations";
type Pending = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  processId: string | null;
  requiredDocs: number | null;
  missingDocs: number | null;
  overdueTasks: number;
  oldestDueAt: string | null;
  testPayment: boolean;
  total: number;
};
export function PendingWork({
  openLead,
  staff,
  user,
  allowed,
  revision,
}: {
  openLead: (id: string) => void;
  staff: { userId: string; displayName: string }[];
  user: { id: string; name: string };
  allowed: boolean;
  revision: number;
}) {
  const [ownerId, setOwner] = useState("");
  const [kind, setKind] = useState("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{
    items: Pending[];
    nextOffset: number | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [process, setProcess] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/internal/pending?${new URLSearchParams({ ownerId, kind, search: query, offset: String(offset) })}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok)
          throw Error(
            d.error?.message ?? "Não foi possível carregar as pendências.",
          );
        return d;
      })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ownerId, kind, query, offset, refresh, allowed, revision]);
  const owners = [...staff];
  if (!owners.some((s) => s.userId === user.id))
    owners.unshift({ userId: user.id, displayName: user.name || "Você" });
  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TRABALHO DO DIA</span>
          <h1>Pendências</h1>
          <p>
            Documentos faltantes e tarefas vencidas, por cliente e responsável.
          </p>
        </div>
        <button
          className="page-button"
          onClick={() => setRefresh((v) => v + 1)}
        >
          Atualizar
        </button>
      </div>
      {!allowed ? (
        <p role="alert">
          Seu perfil não permite consultar pendências documentais e tarefas.
        </p>
      ) : (
        <>
          <div className="filters">
            <label>
              Responsável
              <select
                aria-label="Responsável pelas pendências"
                value={ownerId}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Todos no meu acesso</option>
                <option value="unassigned">Sem responsável</option>
                {owners.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pendência
              <select
                aria-label="Tipo de pendência"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="ALL">Todas as pendências</option>
                <option value="DOCUMENTS">Documentos faltantes</option>
                <option value="OVERDUE">Tarefas vencidas</option>
                <option value="DETAILS">Plano ou sócios indefinidos</option>
              </select>
            </label>
            <label>
              Buscar cliente
              <input
                type="search"
                maxLength={120}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, e-mail ou CPF"
              />
            </label>
          </div>
          <p className="fine">
            Tarefas vencidas aparecem primeiro. Prazos são internos. Arquivos
            enviados ainda podem precisar de aprovação; consulte a ficha.
          </p>
          {error ? (
            <p role="alert" className="notice error">
              {error}
            </p>
          ) : loading ? (
            <p role="status">Carregando pendências…</p>
          ) : (
            data && (
              <>
                <p role="status">
                  {data.items.length
                    ? `${data.items[0].total} clientes com pendências neste filtro · ${data.items.length} nesta página`
                    : "Nenhuma pendência encontrada neste filtro."}
                </p>
                <div className="pending-list">
                  {data.items.map((row) => (
                    <article className="pending-card" key={row.id}>
                      <div>
                        <h2>{row.name || "Cadastro incompleto"}</h2>
                        <p>
                          Responsável:{" "}
                          {row.ownerName ??
                            (row.ownerId ? "Atribuído" : "Não atribuído")}
                        </p>
                        {row.testPayment && (
                          <span className="badge">Pagamento de teste</span>
                        )}
                      </div>
                      <div>
                        <strong>
                          {row.missingDocs === null
                            ? "Plano ou sócios indefinidos"
                            : row.missingDocs > 0
                              ? `Faltam ${row.missingDocs} de ${row.requiredDocs} documentos`
                              : "Todos os documentos enviados"}
                        </strong>
                        <p>
                          {row.overdueTasks
                            ? `${row.overdueTasks} tarefa(s) vencida(s)`
                            : "Nenhuma tarefa vencida"}
                        </p>
                        {row.oldestDueAt && (
                          <small>
                            Vencimento mais antigo:{" "}
                            {new Date(row.oldestDueAt).toLocaleString("pt-BR", {
                              timeZone: "America/Sao_Paulo",
                            })}{" "}
                            (Brasília)
                          </small>
                        )}
                      </div>
                      <div className="review-actions">
                        <button onClick={() => openLead(row.id)}>
                          Ficha e documentos
                        </button>
                        {row.processId && (
                          <button onClick={() => setProcess(row.processId)}>
                            Processo e tarefas
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="review-actions">
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    Anterior
                  </button>
                  <button
                    disabled={data.nextOffset === null}
                    onClick={() => setOffset(data.nextOffset!)}
                  >
                    Próxima
                  </button>
                </div>
              </>
            )
          )}
        </>
      )}
      {process && (
        <ProcessEditor
          id={process}
          close={() => {
            setProcess(null);
            setRefresh((v) => v + 1);
          }}
          changed={() => setRefresh((v) => v + 1)}
          openLead={(id) => {
            setProcess(null);
            openLead(id);
          }}
        />
      )}
    </main>
  );
}
