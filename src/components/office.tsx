"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { browserAuth } from "@/lib/supabase";

type Me = {
  user: { id: string; email: string; name: string };
  permissions: {
    readAll: boolean;
    documents: boolean;
    assign: boolean;
    admin: boolean;
  };
};
type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string | null;
  status: string;
  funnelStep: number;
  lastActivityAt: string;
  createdAt: string;
  paymentStatus: string;
  paymentAmount: number | null;
  paidAt: string | null;
  pagbankCheckoutId: string | null;
  ownerId: string | null;
  version: number;
  cpf?: string;
  activity?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  addressType?: string;
  partners?: { name: string; cpf: string; percentage: number }[];
  documentsSubmittedAt?: string | null;
  pagbankPaymentId?: string;
  pagbankSubscriptionId?: string;
  paymentUpdatedAt?: string;
  events?: { id: string; action: string; createdAt: string }[];
};
type Doc = {
  id: string;
  kind: string;
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
};
type Member = { userId: string; displayName: string };
const plans: Record<string, string> = {
  mei: "MEI",
  essencial: "Essencial",
  gestao: "Gestão",
  proximo: "Próximo",
};
const payments: Record<string, string> = {
  PENDING: "Pendente",
  WAITING: "Aguardando pagamento",
  IN_ANALYSIS: "Em análise",
  PAID: "Pago",
  DECLINED: "Recusado",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
};
const statuses: Record<string, string> = {
  DRAFT: "Incompleto",
  NEW: "Cadastro concluído",
  CONTACTED: "Em contato",
  QUALIFIED: "Qualificado",
  CLOSED: "Encerrado",
};
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Não informado";
const money = (value: number | null | undefined) =>
  value == null
    ? "Não registrado"
    : (value / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/internal/${path}`, {
    ...options,
    cache: "no-store",
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.code ?? "ERROR",
      result.error?.message ?? "Não foi possível completar a solicitação.",
    );
  return result;
}
function Brand() {
  return (
    <div className="brand">
      <img
        src="/concloud.png"
        alt="ConCloud — contabilidade em nuvem"
        width="204"
        height="75"
      />
    </div>
  );
}
function Payment({ lead }: { lead: Lead }) {
  return (
    <span
      className={`badge ${lead.paymentStatus === "PAID" ? "green" : lead.paymentStatus === "DECLINED" ? "red" : "amber"}`}
    >
      {lead.paymentStatus === "PENDING" && !lead.pagbankCheckoutId
        ? "Sem checkout"
        : (payments[lead.paymentStatus] ?? lead.paymentStatus)}
    </span>
  );
}
export function Office() {
  const [mode, setMode] = useState<
    "loading" | "login" | "mfa" | "office" | "denied"
  >("loading");
  const [me, setMe] = useState<Me | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [code, setCode] = useState("");
  async function initialize() {
    try {
      const auth = browserAuth();
      const {
        data: { user },
      } = await auth.auth.getUser();
      if (!user) {
        setMode("login");
        return;
      }
      const { data: assurance, error: assuranceError } =
        await auth.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel !== "aal2") {
        const { data, error } = await auth.auth.mfa.listFactors();
        if (error) throw error;
        setFactor(data.totp.find((f) => f.status === "verified")?.id ?? "");
        setMode("mfa");
        return;
      }
      const identity = await api<Me>("me");
      setMe(identity);
      setMode("office");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Acesso indisponível.");
      setMode("denied");
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const { error } = await browserAuth().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw new Error("E-mail ou senha inválidos.");
      await initialize();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const auth = browserAuth();
      const factors = await auth.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      // Remove only unfinished TOTP enrollments before replacing a setup QR code.
      for (const f of factors.data.all.filter(
        (f) =>
          f.factor_type === "totp" &&
          f.status === "unverified" &&
          f.friendly_name === "Painel ConCloud",
      )) {
        const result = await auth.auth.mfa.unenroll({ factorId: f.id });
        if (result.error) throw result.error;
      }
      const { data, error } = await auth.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Painel ConCloud",
      });
      if (error) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
    } catch {
      setError("Não foi possível configurar a autenticação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await browserAuth().auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      setQr("");
      setCode("");
      await initialize();
    } catch {
      setError(
        "Código inválido ou expirado. Confira seu aplicativo autenticador.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await browserAuth().auth.signOut({ scope: "local" });
    setMe(null);
    setError("");
    setFactor("");
    setQr("");
    setMode("login");
  }
  if (mode === "office" && me) return <Dashboard me={me} logout={logout} />;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">ESPAÇO DA EQUIPE</span>
          <h1>
            Mais clareza.
            <br />
            Mais tempo para
            <br />
            <em>fazer acontecer.</em>
          </h1>
          <p>
            Cadastros, documentos e responsáveis.
            <br />
            Toda a operação começa com uma boa visão.
          </p>
        </div>
        <span className="auth-footer">ConCloud · Contabilidade em nuvem</span>
      </section>
      <section className="auth-form">
        <div className="auth-box">
          <div className="lock-icon">
            <ShieldCheck size={26} />
          </div>
          <span className="eyebrow">PAINEL INTERNO</span>
          <h2>
            {mode === "mfa"
              ? "Confirme seu acesso"
              : mode === "denied"
                ? "Acesso à equipe"
                : mode === "loading"
                  ? "Preparando seu acesso"
                  : "Bem-vindo de volta"}
          </h2>
          <p className="muted">
            {mode === "mfa"
              ? "Use seu aplicativo autenticador para continuar com segurança."
              : "Entre com sua conta da equipe ConCloud."}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {mode === "loading" && <p role="status">Verificando sua sessão…</p>}
          {mode === "login" && (
            <form onSubmit={login}>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu@email.com"
                  required
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Sua senha"
                />
              </label>
              <button className="primary wide" disabled={busy}>
                {busy ? "Entrando…" : "Entrar no painel"}
                <ArrowRight size={17} />
              </button>
              <p className="fine">
                Acesso exclusivo à equipe autorizada. Utilize a senha da sua
                conta ConCloud.
              </p>
            </form>
          )}
          {mode === "mfa" && (
            <>
              {qr && (
                <div className="qr">
                  <img
                    src={qr}
                    width="200"
                    height="200"
                    alt="QR Code para configurar o autenticador"
                  />
                  <p className="fine">
                    Escaneie no seu aplicativo autenticador.
                  </p>
                </div>
              )}
              {!factor ? (
                <button
                  className="primary wide"
                  onClick={enroll}
                  disabled={busy}
                >
                  Configurar autenticação em duas etapas
                </button>
              ) : (
                <form onSubmit={verify}>
                  <label>
                    Código de 6 dígitos
                    <input
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      required
                    />
                  </label>
                  <button
                    className="primary wide"
                    disabled={busy || code.length !== 6}
                  >
                    {busy ? "Verificando…" : "Confirmar acesso"}
                  </button>
                </form>
              )}
            </>
          )}
          {mode === "denied" && (
            <button className="primary wide" onClick={initialize}>
              Tentar novamente
            </button>
          )}
          {(mode === "mfa" || mode === "denied") && (
            <button className="text-button" onClick={logout}>
              Sair desta conta
            </button>
          )}
          <div className="secure-note">
            <ShieldCheck size={14} /> Ambiente privado da ConCloud
          </div>
        </div>
      </section>
    </main>
  );
}
function Dashboard({ me, logout }: { me: Me; logout: () => Promise<void> }) {
  const [rows, setRows] = useState<Lead[]>([]),
    [staff, setStaff] = useState<Member[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [history, setHistory] = useState<(string | null)[]>([]);
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [plan, setPlan] = useState(""),
    [status, setStatus] = useState(""),
    [payment, setPayment] = useState(""),
    [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [updated, setUpdated] = useState(""),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (me.permissions.assign)
      api<{ items: Member[] }>("staff")
        .then((v) => setStaff(v.items))
        .catch(() => setError("Não foi possível carregar os responsáveis."));
  }, [me.permissions.assign]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      search,
      plan,
      status,
      paymentStatus: payment,
      ownerId: owner,
      limit: "25",
    });
    if (cursor) params.set("cursor", cursor);
    api<{ items: Lead[]; nextCursor: string | null; observedAt: string }>(
      `leads?${params}`,
    )
      .then((data) => {
        if (active) {
          setRows(data.items);
          setNext(data.nextCursor);
          setUpdated(data.observedAt);
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
  }, [search, plan, status, payment, owner, cursor, refresh]);
  function reset() {
    setCursor(null);
    setHistory([]);
  }
  function filter(setter: (v: string) => void, value: string) {
    reset();
    setter(value);
  }
  function changed() {
    setRefresh((v) => v + 1);
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <div className="workspace-icon">C</div>
          <div>
            <strong>ConCloud</strong>
            <small>Operação do escritório</small>
          </div>
          <ShieldCheck size={16} />
        </div>
        <span className="nav-caption">OPERAÇÃO</span>
        <nav>
          <a href="#cadastros" className="active">
            <Users size={19} />
            Cadastros
            <ChevronRight size={15} />
          </a>
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <ClipboardList size={21} />
          </div>
          <strong>Um cadastro, uma história.</strong>
          <p>
            Consulte as informações enviadas pelo portal e acompanhe cada
            próximo passo.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">
            {me.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{me.user.name}</strong>
            <small>
              {me.permissions.admin ? "Administrador" : "Equipe ConCloud"}
            </small>
          </div>
          <button onClick={logout} aria-label="Sair" title="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>
            <LayoutDashboard size={16} />
            Painel interno <ChevronRight size={13} /> <b>Cadastros</b>
          </span>
          <div>
            <span className="private">
              <span /> Acesso privado
            </span>
            <button
              className="mobile-logout"
              onClick={logout}
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="cadastros" className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">RELACIONAMENTO & OPERAÇÃO</span>
              <h1>Cadastros</h1>
              <p>Do primeiro contato à próxima etapa. Tudo começa aqui.</p>
            </div>
            <button
              className="secondary"
              onClick={() => setRefresh((v) => v + 1)}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Atualizar
            </button>
          </div>
          <div className="summary-strip">
            <div>
              <span className="summary-icon blue">
                <Users size={21} />
              </span>
              <div>
                <small>Nesta página</small>
                <strong>
                  {loading ? "—" : rows.length}
                  <em> cadastros</em>
                </strong>
              </div>
            </div>
            <div>
              <span className="summary-icon orange">
                <ClipboardList size={21} />
              </span>
              <div>
                <small>Cadastros incompletos</small>
                <strong>
                  {loading
                    ? "—"
                    : rows.filter((r) => r.status === "DRAFT").length}
                  <em> nesta página</em>
                </strong>
              </div>
            </div>
            <div>
              <span className="summary-icon mint">
                <Wallet size={21} />
              </span>
              <div>
                <small>Pagamento inicial confirmado</small>
                <strong>
                  {loading
                    ? "—"
                    : rows.filter((r) => r.paymentStatus === "PAID").length}
                  <em> nesta página</em>
                </strong>
              </div>
            </div>
          </div>
          <section className="list-card">
            <div className="list-title">
              <div>
                <h2>Todos os cadastros</h2>
                <p>
                  Inclui cadastros parciais e sem pagamento no seu escopo de
                  acesso.
                </p>
              </div>
              <span className="live-label">PORTAL CONCLOUD</span>
            </div>
            <div className="filters">
              <form
                className="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  reset();
                  setSearch(query);
                }}
              >
                <Search size={18} />
                <input
                  aria-label="Buscar nome, e-mail ou CPF"
                  placeholder="Buscar nome, e-mail ou CPF"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit">Buscar</button>
              </form>
              <select
                aria-label="Plano"
                value={plan}
                onChange={(e) => filter(setPlan, e.target.value)}
              >
                <option value="">Todos os planos</option>
                {Object.entries(plans).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Cadastro"
                value={status}
                onChange={(e) => filter(setStatus, e.target.value)}
              >
                <option value="">Todos os cadastros</option>
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Pagamento inicial"
                value={payment}
                onChange={(e) => filter(setPayment, e.target.value)}
              >
                <option value="">Todos os pagamentos</option>
                {Object.entries(payments).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Responsável"
                value={owner}
                onChange={(e) => filter(setOwner, e.target.value)}
              >
                <option value="">Todos os responsáveis</option>
                <option value="unassigned">Sem responsável</option>
                {staff.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <div className="empty error" role="alert">
                <strong>Não foi possível atualizar os cadastros</strong>
                <p>{error}</p>
                <button
                  className="secondary"
                  onClick={() => setRefresh((v) => v + 1)}
                >
                  Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className="empty" role="status">
                <RefreshCw className="spin" />
                <p>Carregando os cadastros…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="empty">
                <Users size={32} />
                <strong>Nenhum cadastro encontrado</strong>
                <p>
                  Os cadastros do portal aparecerão aqui. Confira os filtros
                  selecionados.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CLIENTE / CONTATO</th>
                      <th>PLANO</th>
                      <th>CADASTRO</th>
                      <th>PAGAMENTO INICIAL</th>
                      <th>RESPONSÁVEL</th>
                      <th>ÚLTIMA ATIVIDADE</th>
                      <th>
                        <span className="sr-only">Abrir ficha</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button
                            className="person"
                            onClick={() => setSelected(row.id)}
                          >
                            <span className="avatar">
                              {row.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>
                              <strong>{row.name}</strong>
                              <small>{row.email}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className="plan-pill">
                            {row.plan ? plans[row.plan] : "Não selecionado"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${row.status === "DRAFT" ? "gray" : "blue-text"}`}
                          >
                            {statuses[row.status] ?? row.status}
                          </span>
                          <small className="cell-note">
                            Formulário · etapa {row.funnelStep}
                          </small>
                        </td>
                        <td>
                          <Payment lead={row} />
                        </td>
                        <td>
                          {row.ownerId ? (
                            (staff.find((s) => s.userId === row.ownerId)
                              ?.displayName ??
                            (row.ownerId === me.user.id ? "Você" : "Atribuído"))
                          ) : (
                            <span className="muted">Não atribuído</span>
                          )}
                        </td>
                        <td className="date-cell">
                          {date(row.lastActivityAt)}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Abrir ficha de ${row.name}`}
                            onClick={() => setSelected(row.id)}
                          >
                            <ChevronRight size={19} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="list-footer">
              <span>
                {updated
                  ? `Última consulta: ${date(updated)}`
                  : "Aguardando consulta"}
              </span>
              <div>
                <button
                  className="page-button"
                  disabled={!history.length || loading}
                  onClick={() => {
                    setCursor(history.at(-1) ?? null);
                    setHistory((v) => v.slice(0, -1));
                  }}
                >
                  <ArrowLeft size={14} />
                  Anterior
                </button>
                <span>Página {history.length + 1}</span>
                <button
                  className="page-button"
                  disabled={!next || loading}
                  onClick={() => {
                    setHistory((v) => [...v, cursor]);
                    setCursor(next);
                  }}
                >
                  Próxima
                  <ArrowRight size={14} />
                </button>
              </div>
            </footer>
          </section>
          <div className="page-foot">
            <ShieldCheck size={14} />
            Os dados e documentos são acessíveis somente à equipe autorizada.
          </div>
        </main>
      </div>
      {selected && (
        <LeadDrawer
          id={selected}
          me={me}
          staff={staff}
          close={() => setSelected(null)}
          changed={changed}
        />
      )}
    </div>
  );
}
function LeadDrawer({
  id,
  me,
  staff,
  close,
  changed,
}: {
  id: string;
  me: Me;
  staff: Member[];
  close: () => void;
  changed: () => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null),
    [docs, setDocs] = useState<Doc[]>([]),
    [error, setError] = useState(""),
    [docError, setDocError] = useState(""),
    [tab, setTab] = useState("resumo"),
    [owner, setOwner] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLead(null);
    setError("");
    api<Lead>(`leads/${id}`)
      .then((v) => {
        if (active) {
          setLead(v);
          setOwner(v.ownerId ?? "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    if (me.permissions.documents)
      api<{ items: Doc[] }>(`leads/${id}/documents`)
        .then((v) => {
          if (active) setDocs(v.items);
        })
        .catch((e) => {
          if (active) setDocError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, me.permissions.documents]);
  async function assign() {
    if (!lead) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`leads/${id}/assignment`, {
        method: "PATCH",
        body: JSON.stringify({
          ownerId: owner || null,
          expectedVersion: lead.version,
        }),
      });
      setLead(await api<Lead>(`leads/${id}`));
      setMessage("Responsável atualizado.");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atribuir.");
      try {
        const latest = await api<Lead>(`leads/${id}`);
        setLead(latest);
        setOwner(latest.ownerId ?? "");
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: Doc) {
    setBusy(true);
    setDocError("");
    try {
      const result = await api<{ url: string }>(
        `leads/${id}/documents/${doc.id}/download`,
        { method: "POST", body: "{}" },
      );
      const link = document.createElement("a");
      link.href = result.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "Arquivo indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        tabIndex={-1}
        ref={panel}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const elements = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input, select, a[href]",
            );
            if (!elements?.length) return;
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className="drawer-header">
          <div>
            <span className="eyebrow">FICHA DO CADASTRO</span>
            <h2 id="lead-title">{lead?.name ?? "Carregando…"}</h2>
            <small>{id}</small>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Fechar ficha"
          >
            <X size={22} />
          </button>
        </header>
        <div className="tabs">
          {[
            ["resumo", "Resumo"],
            ["cadastro", "Cadastro e sócios"],
            ["documentos", "Documentos"],
            ["pagamento", "Pagamento"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              {message}
            </div>
          )}
          {!lead && !error && <p>Carregando ficha…</p>}
          {lead && (
            <>
              {tab === "resumo" && (
                <>
                  <div className="detail-heading">
                    <span className="plan-pill">
                      {lead.plan ? plans[lead.plan] : "Plano não selecionado"}
                    </span>
                    <Payment lead={lead} />
                  </div>
                  <h3>Visão do cadastro</h3>
                  <dl className="detail-grid">
                    <Field label="Situação" value={statuses[lead.status]} />
                    <Field
                      label="Progresso do formulário"
                      value={`Etapa ${lead.funnelStep}`}
                    />
                    <Field label="Recebido em" value={date(lead.createdAt)} />
                    <Field
                      label="Última atividade"
                      value={date(lead.lastActivityAt)}
                    />
                  </dl>
                  <div className="assignment">
                    <h3>Responsável pelo cadastro</h3>
                    <p className="muted">
                      Organize o acompanhamento comercial pela equipe.
                    </p>
                    {me.permissions.assign ? (
                      <>
                        <select
                          value={owner}
                          onChange={(e) => setOwner(e.target.value)}
                          aria-label="Responsável pelo cadastro"
                        >
                          <option value="">Sem responsável</option>
                          {staff.map((s) => (
                            <option key={s.userId} value={s.userId}>
                              {s.displayName}
                            </option>
                          ))}
                        </select>
                        <button
                          className="primary"
                          onClick={assign}
                          disabled={busy || owner === (lead.ownerId ?? "")}
                        >
                          {busy ? "Salvando…" : "Salvar responsável"}
                        </button>
                      </>
                    ) : (
                      <p>
                        {lead.ownerId === me.user.id
                          ? "Você"
                          : lead.ownerId
                            ? "Atribuído"
                            : "Não atribuído"}
                      </p>
                    )}
                  </div>
                  <h3>Histórico do painel</h3>
                  {lead.events?.length ? (
                    <ul className="timeline">
                      {lead.events.map((e) => (
                        <li key={e.id}>
                          <span />
                          <div>
                            <strong>
                              {e.action === "lead.assigned"
                                ? "Responsável atualizado"
                                : e.action === "document.download_authorized"
                                  ? "Download autorizado"
                                  : e.action}
                            </strong>
                            <small>{date(e.createdAt)}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      Nenhuma atividade registrada no painel.
                    </p>
                  )}
                </>
              )}
              {tab === "cadastro" && (
                <>
                  <h3>Contato e atividade</h3>
                  <dl className="detail-grid">
                    <Field label="Nome" value={lead.name} />
                    <Field label="CPF" value={lead.cpf} />
                    <Field label="E-mail" value={lead.email} />
                    <Field label="Telefone" value={lead.phone} />
                    <Field label="Atividade" value={lead.activity} />
                    <Field label="CEP" value={lead.zipCode} />
                    <Field label="Cidade" value={lead.city} />
                    <Field label="UF" value={lead.state} />
                    <Field
                      label="Endereço indicado"
                      value={
                        lead.addressType === "residencial"
                          ? "Residencial"
                          : lead.addressType === "orientacao"
                            ? "Precisa de orientação"
                            : lead.addressType
                      }
                    />
                  </dl>
                  <h3>Titular e sócios informados</h3>
                  {lead.partners?.length ? (
                    lead.partners.map((p, i) => (
                      <div className="partner" key={i}>
                        <span className="avatar">{i + 1}</span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            CPF {p.cpf} · Participação {p.percentage}%
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">
                      Dados de sócios ainda não informados.
                    </p>
                  )}
                </>
              )}
              {tab === "documentos" && (
                <>
                  <h3>Documentos enviados</h3>
                  <p className="muted">
                    Arquivos atuais do cadastro. Envio não representa aprovação
                    pela equipe.
                  </p>
                  {!me.permissions.documents ? (
                    <div className="notice">
                      Seu perfil não possui acesso aos documentos pessoais.
                    </div>
                  ) : (
                    <>
                      {docError && (
                        <div className="notice error" role="alert">
                          {docError}
                        </div>
                      )}
                      <p className="fine">
                        Finalização pelo cliente:{" "}
                        {lead.documentsSubmittedAt
                          ? date(lead.documentsSubmittedAt)
                          : "Ainda não finalizada"}
                      </p>
                      {docs.map((doc) => (
                        <div className="document" key={doc.id}>
                          <FileText size={23} />
                          <div>
                            <strong>{doc.filename}</strong>
                            <small>
                              {doc.kind.replaceAll("-", " ")} ·{" "}
                              {(doc.size / 1024).toFixed(0)} KB
                            </small>
                            <small>{date(doc.uploadedAt)}</small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Baixar ${doc.filename}`}
                            disabled={busy}
                            onClick={() => download(doc)}
                          >
                            <ArrowDownToLine size={19} />
                          </button>
                        </div>
                      ))}
                      {!docs.length && !docError && (
                        <div className="empty">
                          <FileText />
                          <p>Nenhum arquivo enviado.</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {tab === "pagamento" && (
                <>
                  <h3>Cobrança inicial</h3>
                  <Payment lead={lead} />
                  <dl className="detail-grid payment-details">
                    <Field
                      label="Plano selecionado"
                      value={lead.plan ? plans[lead.plan] : undefined}
                    />
                    <Field
                      label="Valor contratado"
                      value={money(lead.paymentAmount)}
                    />
                    <Field
                      label="Pagamento confirmado em"
                      value={date(lead.paidAt)}
                    />
                    <Field
                      label="Atualizado em"
                      value={date(lead.paymentUpdatedAt)}
                    />
                    <Field
                      label="Referência do checkout"
                      value={lead.pagbankCheckoutId}
                    />
                    <Field
                      label="Referência do pagamento"
                      value={lead.pagbankPaymentId}
                    />
                    <Field
                      label="Referência da assinatura"
                      value={lead.pagbankSubscriptionId}
                    />
                  </dl>
                  <div className="notice">
                    Esta situação corresponde à cobrança inicial. Não confirma a
                    quitação de mensalidades futuras.
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "Não informado"}</dd>
    </div>
  );
}
