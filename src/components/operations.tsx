"use client";
import { useEffect, useState, type FormEvent } from "react";
type Process = {
  id: string;
  leadId: string;
  name: string;
  plan: string;
  workflow: string;
  stage: number;
  situation: string;
  version: number;
  ownerId: string | null;
  ownerName?: string;
};
type Task = {
  id: string;
  title: string;
  completed: boolean;
  version: number;
  dueAt: string | null;
};
type Detail = Process & {
  stages: [string, string][];
  returnStage: number | null;
  events: {
    id: string;
    fromStage: number;
    toStage: number;
    reason: string;
    createdAt: string;
  }[];
  tasks: Task[];
  evidence: { id: string; kind: string; filename: string }[];
};
const situations: Record<string, string> = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  WAITING_AGENCY: "Aguardando órgão",
  REQUIREMENT: "Em exigência",
  DONE: "Concluído",
  CANCELED: "Cancelado",
};
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`/api/internal/${path}`, {
    ...options,
    cache: "no-store",
    headers: { "content-type": "application/json" },
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error?.message ?? "Não foi possível concluir.");
  return data;
}
export function Operations({
  openLead,
  canCreate,
}: {
  openLead: (id: string) => void;
  canCreate: boolean;
}) {
  const [rows, setRows] = useState<Process[]>([]),
    [workflows, setWorkflows] = useState<Record<string, [string, string][]>>(
      {},
    ),
    [workflow, setWorkflow] = useState("JUCESP"),
    [offset, setOffset] = useState(0),
    [next, setNext] = useState<number | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<{ id: string; target?: number } | null>(
      null,
    ),
    [refresh, setRefresh] = useState(0),
    [paid, setPaid] = useState<{ id: string; name: string; plan: string }[]>(
      [],
    ),
    [leadId, setLeadId] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{
      items: Process[];
      nextOffset: number | null;
      workflows: Record<string, [string, string][]>;
    }>(`processes?workflow=${workflow}&offset=${offset}`)
      .then((d) => {
        if (active) {
          setRows(d.items);
          setNext(d.nextOffset);
          setWorkflows(d.workflows);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workflow, offset, refresh]);
  useEffect(() => {
    if (canCreate)
      api<{ items: { id: string; name: string; plan: string }[] }>(
        "leads?paymentStatus=PAID&limit=100",
      )
        .then((d) => setPaid(d.items))
        .catch((e) => setError(e.message));
  }, [canCreate, refresh]);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api<Process>("processes", {
        method: "POST",
        body: JSON.stringify({ leadId, workflow }),
      });
      setSelected({ id: p.id });
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO</span>
          <h1>Aberturas</h1>
          <p>Etapas, documentos, tarefas e histórico do processo.</p>
        </div>
        <button
          className="page-button"
          onClick={() => setRefresh((v) => v + 1)}
        >
          Atualizar
        </button>
      </div>
      <div className="filters">
        <label>
          Fluxo
          <select
            value={workflow}
            onChange={(e) => {
              setWorkflow(e.target.value);
              setOffset(0);
            }}
          >
            <option value="JUCESP">Pequenas empresas · SP/JUCESP</option>
            <option value="MEI">MEI</option>
          </select>
        </label>
      </div>
      {canCreate && (
        <form className="operation-create" onSubmit={create}>
          <label>
            Encaminhar cadastro pago (até 100 recentes)
            <select
              required
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">Selecione um cadastro</option>
              {paid
                .filter((l) => (l.plan === "mei") === (workflow === "MEI"))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="primary" disabled={busy || !leadId}>
            Encaminhar à operação
          </button>
          <p className="fine">
            Exige cadastro concluído e responsável atribuído. A rota é
            confirmada pela equipe.
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando processos…</p>
      ) : (
        <>
          <p className="fine">
            {rows.length} processos nesta página. Arraste para solicitar mudança
            ou use “Abrir processo”. A mudança só ocorre após confirmação e
            validação.
          </p>
          <div className="kanban" aria-label="Quadro operacional">
            {(workflows[workflow] ?? []).map(([title], i) => (
              <section
                className="kanban-column"
                key={title}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (rows.some((p) => p.id === id))
                    setSelected({ id, target: i + 1 });
                }}
              >
                <h2>
                  <span>{i + 1}</span>
                  {title}
                </h2>
                {rows
                  .filter((p) => p.stage === i + 1)
                  .map((p) => (
                    <article
                      className="process-card"
                      key={p.id}
                      draggable={!["DONE", "CANCELED"].includes(p.situation)}
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", p.id)
                      }
                    >
                      <strong>{p.name}</strong>
                      <small>
                        Processo {p.id.slice(0, 8)} · {p.plan}
                      </small>
                      <small>
                        Responsável: {p.ownerName ?? "Não informado"}
                      </small>
                      <span className="badge">{situations[p.situation]}</span>
                      <button
                        className="text-button"
                        onClick={() => setSelected({ id: p.id })}
                      >
                        Abrir processo
                      </button>
                      <button
                        className="text-button"
                        onClick={() => openLead(p.leadId)}
                      >
                        Ficha e documentos
                      </button>
                    </article>
                  ))}
                {!rows.some((p) => p.stage === i + 1) && (
                  <p className="fine">Nenhum processo nesta página.</p>
                )}
              </section>
            ))}
          </div>
          <div className="review-actions">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Anterior
            </button>
            <button disabled={next === null} onClick={() => setOffset(next!)}>
              Próxima
            </button>
          </div>
        </>
      )}
      {selected && (
        <ProcessEditor
          key={`${selected.id}-${selected.target}`}
          id={selected.id}
          initialTarget={selected.target}
          close={() => setSelected(null)}
          changed={() => setRefresh((v) => v + 1)}
          openLead={(leadId) => {
            setSelected(null);
            openLead(leadId);
          }}
        />
      )}
    </main>
  );
}
function ProcessEditor({
  id,
  initialTarget,
  close,
  changed,
  openLead,
}: {
  id: string;
  initialTarget?: number;
  close: () => void;
  changed: () => void;
  openLead: (id: string) => void;
}) {
  const [p, setP] = useState<Detail | null>(null),
    [target, setTarget] = useState(0),
    [status, setStatus] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState(false),
    [protocol, setProtocol] = useState(""),
    [cnpj, setCnpj] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [task, setTask] = useState(""),
    [due, setDue] = useState(""),
    [kind, setKind] = useState("OTHER"),
    [file, setFile] = useState<File | null>(null);
  async function load() {
    const d = await api<Detail>(`processes/${id}`);
    setP(d);
    setTarget(initialTarget ?? d.stage);
    setStatus(d.situation);
    setChecked(false);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [id]);
  async function action(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await api(`processes/${id}/${path}`, {
        method,
        body: JSON.stringify(body),
      });
      await load();
      changed();
      setReason("");
      setTask("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Envie um anexo de até 2 MB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    if (
      await action("evidence", {
        kind,
        filename: file.name,
        mime: file.type,
        data,
      })
    )
      setFile(null);
  }
  async function download(evidenceId: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ url: string }>(
        `processes/${id}/evidence/${evidenceId}/download`,
        { method: "POST", body: "{}" },
      );
      const url = new URL(r.url, window.location.origin);
      if (url.protocol !== "https:" && url.origin !== window.location.origin)
        throw Error("Link inválido");
      window.open(url.href, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operation-overlay">
      <section
        className="operation-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Processo de abertura"
      >
        <header>
          <h2>Processo {id.slice(0, 8)}</h2>
          <button autoFocus onClick={close} aria-label="Fechar processo">
            Fechar
          </button>
        </header>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {!p ? (
          <p>Carregando…</p>
        ) : (
          <>
            <button className="text-button" onClick={() => openLead(p.leadId)}>
              Abrir ficha e revisar documentos
            </button>
            <h3>
              {p.stage}. {p.stages[p.stage - 1][0]}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action("transitions", {
                  targetStage: target,
                  expectedVersion: p.version,
                  situation: status,
                  reason,
                  checked,
                  protocol,
                  cnpj,
                });
              }}
            >
              <label>
                Etapa de destino
                <select
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                >
                  {p.stages.map(([title], i) => (
                    <option key={title} value={i + 1}>
                      {i + 1}. {title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="fine">
                Avanço sequencial.{" "}
                {p.returnStage
                  ? `Retorno previsto à etapa ${p.returnStage}.`
                  : ""}
              </p>
              <label>
                Situação
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(situations).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="operation-check">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                {p.stages[p.stage - 1][1]}
              </label>
              <label>
                Protocolo / recibo
                <input
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label>
                CNPJ (na etapa de conferência)
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  maxLength={24}
                />
              </label>
              <label>
                Registro da etapa / motivo / próxima ação
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Registre o resultado e as pendências; em entregas, canal, data e destinatário. Nunca informe senhas."
                />
              </label>
              <button
                className="primary"
                disabled={busy || ["DONE", "CANCELED"].includes(p.situation)}
              >
                Salvar transição
              </button>
            </form>
            <h3>Tarefas</h3>
            {p.tasks.map((t) => (
              <div className="operation-task" key={t.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={t.completed}
                    disabled={busy}
                    onChange={(e) =>
                      action(
                        `tasks/${t.id}`,
                        {
                          completed: e.target.checked,
                          expectedVersion: t.version,
                        },
                        "PATCH",
                      )
                    }
                  />
                  {t.title}
                </label>
                <small>
                  {t.dueAt
                    ? new Date(t.dueAt).toLocaleString("pt-BR")
                    : "Sem vencimento"}
                </small>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action("tasks", {
                  title: task,
                  dueAt: due ? new Date(due).toISOString() : null,
                });
              }}
            >
              <label>
                Nova tarefa · responsável do cadastro
                <input
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  minLength={3}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Vencimento interno opcional
                <input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <button disabled={busy}>Criar tarefa</button>
            </form>
            <h3>Comprovantes do processo</h3>
            {p.evidence.map((e) => (
              <div className="operation-task" key={e.id}>
                <span>
                  {e.kind} · {e.filename}
                </span>
                <button disabled={busy} onClick={() => download(e.id)}>
                  Baixar
                </button>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void upload().catch(() =>
                  setError("Não foi possível ler o arquivo."),
                );
              }}
            >
              <label>
                Tipo
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries({
                    DARE: "Comprovante DARE",
                    SIGNED_CONTRACT: "Contrato assinado",
                    CNPJ: "Comprovante CNPJ",
                    CCMEI: "CCMEI",
                    DELIVERY: "Comprovante de entrega",
                    OTHER: "Outro comprovante",
                  }).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                PDF, PNG ou JPG · até 2 MB
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button disabled={busy || !file}>Anexar comprovante</button>
            </form>
            <h3>Histórico · últimos 100 eventos</h3>
            {p.events.map((e) => (
              <article className="operation-event" key={e.id}>
                <small>
                  {new Date(e.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {e.fromStage ?? "Entrada"} → {e.toStage}
                </small>
                <p>{e.reason}</p>
              </article>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

export function CommercialFunnel({
  openLead,
}: {
  openLead: (id: string) => void;
}) {
  const columns: Record<string, string> = {
    STARTED: "Cadastro iniciado",
    REGISTERED: "Cadastro concluído",
    WAITING_PAYMENT: "Aguardando pagamento",
    PAID: "Pagamento confirmado",
    OPERATION: "Encaminhado à operação",
  };
  const [items, setItems] = useState<
      { id: string; name: string; commercialStage: string; plan: string }[]
    >([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ items: typeof items; nextCursor: string | null }>(
      `leads?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((d) => {
        if (active) {
          setItems(d.items);
          setNext(d.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cursor, refresh]);
  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RELACIONAMENTO</span>
          <h1>Funil comercial</h1>
          <p>
            Etapas calculadas a partir dos cadastros, pagamentos e
            encaminhamentos persistidos.
          </p>
        </div>
        <button
          className="page-button"
          onClick={() => setRefresh((v) => v + 1)}
        >
          Atualizar
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {loading ? (
        <p>Carregando cadastros…</p>
      ) : (
        <>
          <p className="fine">
            {items.length} cadastros nesta página. O pagamento é confirmado pela
            integração financeira; o encaminhamento é feito em Aberturas.
          </p>
          <div className="kanban">
            {Object.entries(columns).map(([key, label]) => (
              <section className="kanban-column" key={key}>
                <h2>{label}</h2>
                {items
                  .filter((l) => l.commercialStage === key)
                  .map((l) => (
                    <article className="process-card" key={l.id}>
                      <strong>{l.name || "Cadastro incompleto"}</strong>
                      <small>{l.plan || "Plano ainda não escolhido"}</small>
                      <button
                        className="text-button"
                        onClick={() => openLead(l.id)}
                      >
                        Abrir ficha
                      </button>
                    </article>
                  ))}
                {!items.some((l) => l.commercialStage === key) && (
                  <p className="fine">Nenhum cadastro nesta página.</p>
                )}
              </section>
            ))}
          </div>
          <div className="review-actions">
            <button
              disabled={!history.length}
              onClick={() => {
                setCursor(history.at(-1) ?? null);
                setHistory((h) => h.slice(0, -1));
              }}
            >
              Anterior
            </button>
            <button
              disabled={!next}
              onClick={() => {
                setHistory((h) => [...h, cursor]);
                setCursor(next);
              }}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </main>
  );
}
