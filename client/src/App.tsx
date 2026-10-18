
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import {
  generateReminder,
  getInvoices,
  markInvoicePaid,
  type Invoice,
  type ReminderResponse,
} from "./api";

import { rankRecoveryInvoices } from "./recovery";
import "./App.css";

type View =
  | "Overview"
  | "Invoices"
  | "Recovery Intelligence"
  | "AI Reminders"
  | "Analytics";

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatShortMoney = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatMoney(amount);
};

function getInitials(name: string) {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const className = status.toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`status-badge status-${className}`}>
      <span />
      {status}
    </span>
  );
}

function AreaChart() {
  return (
    <div className="chart-wrap">
      <div className="chart-y-labels">
        <span>₹1.5L</span>
        <span>₹1.0L</span>
        <span>₹50K</span>
        <span>₹0</span>
      </div>

      <svg
        className="area-chart"
        viewBox="0 0 620 220"
        preserveAspectRatio="none"
        role="img"
        aria-label="Illustrative payment trend, not historical transaction data"
      >
        <defs>
          <linearGradient id="areaViolet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b7cff" stopOpacity=".30" />
            <stop offset="100%" stopColor="#8b7cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaCyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#49d9e8" stopOpacity=".22" />
            <stop offset="100%" stopColor="#49d9e8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[24, 78, 132, 186].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="620"
            y2={y}
            className="chart-grid"
          />
        ))}

        <path
          d="M0 183 C45 174 61 154 102 160 S167 132 207 140 S280 116 318 128 S381 92 423 100 S488 61 526 76 S578 42 620 30 L620 205 L0 205Z"
          fill="url(#areaViolet)"
        />
        <path
          d="M0 194 C45 183 68 174 102 177 S165 154 207 165 S278 145 318 152 S379 128 423 137 S485 100 526 112 S579 79 620 69 L620 205 L0 205Z"
          fill="url(#areaCyan)"
        />
        <path
          d="M0 183 C45 174 61 154 102 160 S167 132 207 140 S280 116 318 128 S381 92 423 100 S488 61 526 76 S578 42 620 30"
          className="chart-line violet-line"
        />
        <path
          d="M0 194 C45 183 68 174 102 177 S165 154 207 165 S278 145 318 152 S379 128 423 137 S485 100 526 112 S579 79 620 69"
          className="chart-line cyan-line"
        />

        {[102, 207, 318, 423, 526, 620].map((x, index) => (
          <circle
            key={x}
            cx={x}
            cy={[160, 140, 128, 100, 76, 30][index]}
            r="3.5"
            className="chart-dot violet-dot"
          />
        ))}
      </svg>

      <div className="chart-x-labels">
        <span>May</span>
        <span>Jun</span>
        <span>Jul</span>
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
      </div>
    </div>
  );
}

function BarsChart({ invoices }: { invoices: Invoice[] }) {
  const months = useMemo(() => {
    const now = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - 5 + index,
        1,
      );

      return {
        label: date.toLocaleDateString("en-IN", { month: "short" }),
        value: 0,
      };
    });
  }, []);

  const collected = useMemo(() => {
    const buckets = months.map((month) => ({ ...month }));

    invoices
      .filter((invoice) => invoice.status === "Paid")
      .forEach((invoice) => {
        const date = new Date(`${invoice.dueDate.slice(0, 10)}T00:00:00`);
        if (Number.isNaN(date.getTime())) return;

        const label = date.toLocaleDateString("en-IN", {
          month: "short",
        });

        const bucket = buckets.find((item) => item.label === label);
        if (bucket) bucket.value += invoice.amount;
      });

    return buckets;
  }, [invoices, months]);

  const max = Math.max(...collected.map((item) => item.value), 1);

  return (
    <div className="bars-chart" aria-label="Paid invoices grouped by due-date month">
      {collected.map((item, index) => (
        <div className="bar-column" key={`${item.label}-${index}`}>
          <span className="bar-value">
            {item.value ? formatShortMoney(item.value) : ""}
          </span>
          <div className="bar-track">
            <div
              className={`bar-fill ${
                index === collected.length - 1 ? "bar-highlight" : ""
              }`}
              style={{
                height: `${Math.max(5, (item.value / max) * 100)}%`,
              }}
            />
          </div>
          <span className="bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<View>("Overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [reminder, setReminder] = useState<ReminderResponse | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  async function loadInvoices() {
    setLoading(true);
    setError("");

    try {
      setInvoices(await getInvoices());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load invoices.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, []);

  const totals = useMemo(() => {
    const outstanding = invoices
      .filter((item) => item.status !== "Paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const overdue = invoices
      .filter((item) => item.status === "Overdue")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const collected = invoices
      .filter((item) => item.status === "Paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const overdueCount = invoices.filter(
      (item) => item.status === "Overdue",
    ).length;

    const totalValue = outstanding + collected;

    return {
      outstanding,
      overdue,
      collected,
      overdueCount,
      totalValue,
      recoveryRate:
        totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0,
    };
  }, [invoices]);

  const recoveryQueue = useMemo(
    () => rankRecoveryInvoices(invoices),
    [invoices],
  );

  const priorities = useMemo(
    () =>
      recoveryQueue
        .filter((item) => item.invoice.status === "Overdue")
        .slice(0, 3)
        .map((item) => item.invoice),
    [recoveryQueue],
  );

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => {
        const query = search.trim().toLowerCase();

        const matchesSearch = [
          invoice.id,
          invoice.client,
          invoice.project,
          invoice.email,
        ].some((value) => String(value ?? "").toLowerCase().includes(query));

        return matchesSearch && (filter === "All" || invoice.status === filter);
      })
      .sort((a, b) => {
        const rank: Record<string, number> = {
          Overdue: 0,
          "Due soon": 1,
          Open: 2,
          Paid: 3,
        };

        return rank[a.status] - rank[b.status];
      });
  }, [invoices, search, filter]);

  async function handlePaid(invoice: Invoice) {
    if (invoice.status === "Paid" || actionLoading) return;

    setActionLoading(invoice.id);
    setNotice("");

    try {
      const updated = await markInvoicePaid(invoice.id);

      setInvoices((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      setSelectedInvoice(updated);
      setReminder(null);

      setNotice(
        `${updated.id} marked as paid. This is a manual status update, not bank-verified.`,
      );
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Could not update the invoice.",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function handleReminder(invoice: Invoice) {
    if (invoice.status === "Paid") {
      setNotice("This invoice is marked as paid. No reminder was generated.");
      return;
    }

    setSelectedInvoice(invoice);
    setReminder(null);
    setReminderLoading(true);
    setCopied(false);
    setNotice("");

    try {
      setReminder(await generateReminder(invoice.id));
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "Could not generate the reminder.",
      );
    } finally {
      setReminderLoading(false);
    }
  }

  async function copyReminder() {
    if (!reminder?.reminder) return;

    try {
      await navigator.clipboard.writeText(reminder.reminder);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice(
        "Clipboard access was blocked. Select the draft text and copy it manually.",
      );
    }
  }

  function downloadReminder() {
    if (!reminder?.reminder) return;

    const blob = new Blob([reminder.reminder], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `DuePilot-${selectedInvoice?.id ?? "reminder"}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const navItems: {
    label: View;
    icon: typeof LayoutDashboard;
  }[] = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Invoices", icon: FileText },
    { label: "Recovery Intelligence", icon: Activity },
    { label: "AI Reminders", icon: Sparkles },
    { label: "Analytics", icon: TrendingUp },
  ];

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const headingCopy: Record<View, { title: string; subtitle: string }> = {
    Overview: {
      title: "Good morning, let's get paid.",
      subtitle: "Your money at a glance. Your next move, made clearer.",
    },
    Invoices: {
      title: "Your invoices",
      subtitle: "Every invoice, one clear view. Stay on top of every payment.",
    },
    "Recovery Intelligence": {
      title: "Recovery intelligence",
      subtitle: "Know which payment needs your attention first.",
    },
    "AI Reminders": {
      title: "Follow up, thoughtfully.",
      subtitle: "Polite, professional follow-ups drafted in seconds.",
    },
    Analytics: {
      title: "Your financial insights",
      subtitle: "Understand your collections and outstanding payments.",
    },
  };

  const heading = headingCopy[activeView];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Zap size={21} fill="currentColor" />
          </div>

          <div>
            <span className="brand-name">
              duepilot<span className="brand-period">.</span>
            </span>
            <span className="brand-caption">PAYMENTS, ON AUTOPILOT</span>
          </div>

          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">D</div>
          <div className="workspace-copy">
            <strong>Demo workspace</strong>
            <span>Freelancer account</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav className="main-nav">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeView === label ? "nav-active" : ""}`}
              onClick={() => {
                setActiveView(label);
                setMobileMenu(false);
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>

              {label === "Recovery Intelligence" && priorities.length > 0 && (
                <span className="nav-count">{priorities.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon">
              <Sparkles size={17} />
            </div>
            <strong>Your money deserves a follow-up.</strong>
            <p>Let AI help you write the next one.</p>
            <button onClick={() => setActiveView("AI Reminders")}>
              Explore AI reminders <ArrowUpRight size={14} />
            </button>
          </div>

          <button
            className="nav-item settings-item"
            onClick={() => setNotice("Settings are not yet connected in this demo.")}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </button>

          <div className="profile-row">
            <div className="profile-avatar">DP</div>
            <div className="profile-copy">
              <strong>Demo User</strong>
              <span>Workspace owner</span>
            </div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setMobileMenu(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{activeView}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="date-chip">
              <Clock3 size={14} /> {today}
            </span>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() =>
                setNotice(`${totals.overdueCount} overdue invoice(s) need attention.`)
              }
            >
              <Bell size={18} />
              {totals.overdueCount > 0 && <i />}
            </button>

            <div className="topbar-profile">
              <div className="profile-avatar">DP</div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => void loadInvoices()}>
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          )}

          {notice && (
            <div className="notice-banner">
              <CheckCircle2 size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notification">
                <X size={15} />
              </button>
            </div>
          )}

          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="live-dot" />
                YOUR FINANCIAL COMMAND CENTER
              </div>
              <h1>{heading.title}</h1>
              <p>{heading.subtitle}</p>
            </div>

            <div className="heading-actions">
              <button
                className="button-secondary"
                onClick={() => void loadInvoices()}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />
                Refresh
              </button>

              <button
                className="button-primary"
                onClick={() => setActiveView("Invoices")}
              >
                <Plus size={17} /> View invoices
              </button>
            </div>
          </section>

          <section className="metric-grid">
            <article className="metric-card metric-featured">
              <div className="metric-top">
                <span>Outstanding balance</span>
                <span className="metric-icon violet-icon">
                  <Wallet size={18} />
                </span>
              </div>
              <div className="metric-number">
                {loading ? "—" : formatMoney(totals.outstanding)}
              </div>
              <div className="metric-foot">
                <span className="metric-pill violet-pill">
                  <Activity size={13} /> To be collected
                </span>
                <span className="metric-caption">Across unpaid invoices</span>
              </div>
              <div className="metric-glow" />
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>Overdue payments</span>
                <span className="metric-icon orange-icon">
                  <Clock3 size={18} />
                </span>
              </div>
              <div className="metric-number">
                {loading ? "—" : formatMoney(totals.overdue)}
              </div>
              <div className="metric-foot">
                <span className="metric-pill orange-pill">
                  {totals.overdueCount} invoice{totals.overdueCount === 1 ? "" : "s"}
                </span>
                <span className="metric-caption">Need a follow-up</span>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>Total collected</span>
                <span className="metric-icon green-icon">
                  <CircleDollarSign size={18} />
                </span>
              </div>
              <div className="metric-number">
                {loading ? "—" : formatMoney(totals.collected)}
              </div>
              <div className="metric-foot">
                <span className="metric-pill green-pill">
                  <Check size={13} /> Marked paid
                </span>
                <span className="metric-caption">Recorded in DuePilot</span>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>Collection ratio</span>
                <span className="metric-icon cyan-icon">
                  <TrendingUp size={18} />
                </span>
              </div>
              <div className="metric-number">
                {loading ? "—" : `${totals.recoveryRate}%`}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${totals.recoveryRate}%` }}
                />
              </div>
              <div className="metric-foot">
                <span className="metric-caption">Paid ÷ total invoice value</span>
              </div>
            </article>
          </section>

          {activeView === "Overview" && (
            <>
              <section className="analytics-grid">
                <article className="panel trend-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Cash flow overview</h2>
                      <p>Visual snapshot of payment momentum</p>
                    </div>
                    <button
                      className="select-chip"
                      onClick={() => setActiveView("Analytics")}
                    >
                      View analytics <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="chart-legend">
                    <span><i className="legend-violet" /> Payment activity</span>
                    <span><i className="legend-cyan" /> Collection trend</span>
                    <span className="chart-period">Illustrative trend</span>
                  </div>

                  <AreaChart />

                  <div className="chart-footnote">
                    <span><span className="footnote-dot" /> Keep your cash flow moving</span>
                    <span>Review overdue invoices below <ArrowDownRight size={14} /></span>
                  </div>
                </article>

                <article className="panel collection-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Collection health</h2>
                      <p>Your current invoice mix</p>
                    </div>
                    <div className="panel-icon"><ShieldCheck size={17} /></div>
                  </div>

                  <div className="health-center">
                    <div
                      className="donut"
                      style={{ "--paid": `${totals.recoveryRate}%` } as CSSProperties}
                    >
                      <div className="donut-inner">
                        <strong>{loading ? "—" : `${totals.recoveryRate}%`}</strong>
                        <span>paid ratio</span>
                      </div>
                    </div>
                  </div>

                  <div className="health-legend">
                    <div>
                      <span className="health-dot paid-dot" />
                      <span>Paid</span>
                      <strong>{invoices.filter((i) => i.status === "Paid").length}</strong>
                    </div>
                    <div>
                      <span className="health-dot overdue-dot" />
                      <span>Overdue</span>
                      <strong>{totals.overdueCount}</strong>
                    </div>
                    <div>
                      <span className="health-dot open-dot" />
                      <span>Pending / due soon</span>
                      <strong>
                        {invoices.filter(
                          (i) => i.status === "Open" || i.status === "Due soon",
                        ).length}
                      </strong>
                    </div>
                  </div>

                  <div className="health-total">
                    <span>Total invoice value</span>
                    <strong>{formatMoney(totals.totalValue)}</strong>
                  </div>
                </article>
              </section>

              <section className="lower-grid">
                <article className="panel monthly-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Collections by month</h2>
                      <p>Paid invoices grouped by due-date month</p>
                    </div>
                    <span className="panel-icon"><TrendingUp size={17} /></span>
                  </div>

                  <BarsChart invoices={invoices} />

                  <div className="chart-disclaimer">
                    Based on invoice due dates; this is not a bank transaction feed.
                  </div>
                </article>

                <article className="panel intelligence-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="ai-heading">
                        <Sparkles size={16} />
                        <h2>Recovery intelligence</h2>
                      </div>
                      <p>Your next best follow-up</p>
                    </div>
                    <span className="ai-live-tag">RULE-BASED</span>
                  </div>

                  {priorities.length === 0 ? (
                    <div className="empty-state">
                      <CheckCircle2 size={24} />
                      <strong>You're all caught up</strong>
                      <span>No overdue invoices found.</span>
                    </div>
                  ) : (
                    <div className="priority-list">
                      {priorities.slice(0, 2).map((invoice, index) => (
                        <div className="priority-item" key={invoice.id}>
                          <div className={`priority-rank rank-${index + 1}`}>
                            {index + 1}
                          </div>
                          <div className="priority-copy">
                            <strong>{invoice.client}</strong>
                            <span>
                              {invoice.id} · {invoice.daysOverdue} day
                              {invoice.daysOverdue === 1 ? "" : "s"} overdue
                            </span>
                            <b>{formatMoney(invoice.amount)}</b>
                          </div>
                          <button
                            className="mini-action"
                            onClick={() => void handleReminder(invoice)}
                            aria-label={`Draft reminder for ${invoice.client}`}
                          >
                            <Mail size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="intelligence-link"
                    onClick={() => setActiveView("Recovery Intelligence")}
                  >
                    Open recovery intelligence <ArrowUpRight size={15} />
                  </button>
                </article>
              </section>
            </>
          )}

          {activeView === "Recovery Intelligence" && (
            <section className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h2>Prioritized recovery queue</h2>
                  <p>
                    Scores use overdue status, days overdue, and invoice amount.
                    They are prioritization heuristics, not payment predictions.
                  </p>
                </div>
                <span className="ai-live-tag">EXPLAINABLE RULES</span>
              </div>

              {recoveryQueue.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={24} />
                  <strong>No unpaid invoices</strong>
                  <span>You're all caught up for now.</span>
                </div>
              ) : (
                <div className="recovery-cards">
                  {recoveryQueue.map((assessment, index) => {
                    const invoice = assessment.invoice;

                    return (
                      <div className="recovery-card" key={invoice.id}>
                        <div className="recovery-card-top">
                          <span className={`priority-rank rank-${Math.min(index + 1, 3)}`}>
                            {index + 1}
                          </span>
                          <StatusBadge status={invoice.status} />
                        </div>

                        <h3>{invoice.client}</h3>
                        <p>{invoice.id} · {invoice.project}</p>

                        <div className="recovery-amount">
                          {formatMoney(invoice.amount)}
                        </div>

                        <div className="recovery-reason">
                          <Clock3 size={15} />
                          {assessment.daysOverdue > 0
                            ? `${assessment.daysOverdue} days overdue`
                            : invoice.status === "Due soon"
                              ? "Payment due soon"
                              : "Payment pending"}
                        </div>

                        <div className="recovery-score">
                          <div className="recovery-score-header">
                            <span>Priority score</span>
                            <strong>{assessment.score}/100</strong>
                          </div>

                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${assessment.score}%` }}
                            />
                          </div>

                          <span className="recovery-priority-label">
                            {assessment.priority} priority
                          </span>
                        </div>

                        <div className="recovery-explanation">
                          <strong>Why this invoice?</strong>
                          <p>{assessment.reason}</p>
                        </div>

                        <div className="recovery-explanation">
                          <strong>Recommended next step</strong>
                          <p>{assessment.nextAction}</p>
                        </div>

                        <button
                          className="button-primary wide-button"
                          onClick={() => void handleReminder(invoice)}
                        >
                          <Sparkles size={15} /> Draft AI reminder
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeView === "Analytics" && (
            <section className="analytics-grid analytics-page">
              <article className="panel trend-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Cash flow overview</h2>
                    <p>Illustrative chart, not historical transaction data</p>
                  </div>
                </div>
                <AreaChart />
              </article>

              <article className="panel collection-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Collection health</h2>
                    <p>Calculated from current invoice statuses</p>
                  </div>
                </div>

                <div className="health-center">
                  <div
                    className="donut"
                    style={{ "--paid": `${totals.recoveryRate}%` } as CSSProperties}
                  >
                    <div className="donut-inner">
                      <strong>{totals.recoveryRate}%</strong>
                      <span>paid ratio</span>
                    </div>
                  </div>
                </div>

                <div className="health-total">
                  <span>Outstanding</span>
                  <strong>{formatMoney(totals.outstanding)}</strong>
                </div>
                <div className="health-total">
                  <span>Collected</span>
                  <strong>{formatMoney(totals.collected)}</strong>
                </div>
              </article>

              <article className="panel monthly-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Collections by month</h2>
                    <p>Grouped by invoice due date</p>
                  </div>
                </div>
                <BarsChart invoices={invoices} />
                <div className="chart-disclaimer">
                  The current demo dataset is small. Add more real invoices for
                  meaningful month-to-month analysis.
                </div>
              </article>
            </section>
          )}

          {(activeView === "Invoices" || activeView === "AI Reminders") && (
            <section className="panel invoice-panel">
              <div className="panel-heading invoice-heading">
                <div>
                  <h2>
                    {activeView === "AI Reminders"
                      ? "Create a payment follow-up"
                      : "All invoices"}
                  </h2>
                  <p>
                    {activeView === "AI Reminders"
                      ? "Choose an unpaid invoice to draft a polite reminder."
                      : `${filteredInvoices.length} invoice${
                          filteredInvoices.length === 1 ? "" : "s"
                        } in your workspace`}
                  </p>
                </div>

                <div className="invoice-tools">
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search invoices..."
                      aria-label="Search invoices"
                    />
                  </label>

                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    aria-label="Filter invoices"
                  >
                    <option>All</option>
                    <option>Overdue</option>
                    <option>Due soon</option>
                    <option>Open</option>
                    <option>Paid</option>
                  </select>
                </div>
              </div>

              <div className="table-scroll">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>CLIENT / INVOICE</th>
                      <th>PROJECT</th>
                      <th>AMOUNT</th>
                      <th>DUE DATE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="table-message">
                          <LoaderCircle className="spin" size={20} />
                          Loading invoices...
                        </td>
                      </tr>
                    ) : filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-message">
                          No invoices match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>
                            <div className="client-cell">
                              <div className={`client-avatar avatar-${invoice.client.length % 5}`}>
                                {invoice.initials || getInitials(invoice.client)}
                              </div>
                              <div>
                                <strong>{invoice.client}</strong>
                                <span>{invoice.id}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="project-name">{invoice.project}</span>
                          </td>

                          <td>
                            <strong className="amount-cell">
                              {formatMoney(invoice.amount)}
                            </strong>
                          </td>

                          <td>
                            <span className="due-date">
                              {new Date(
                                `${invoice.dueDate.slice(0, 10)}T00:00:00`,
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </td>

                          <td><StatusBadge status={invoice.status} /></td>

                          <td>
                            <div className="row-actions">
                              {invoice.status !== "Paid" && (
                                <button
                                  className="table-action"
                                  title="Generate AI reminder"
                                  aria-label={`Generate reminder for ${invoice.id}`}
                                  onClick={() => void handleReminder(invoice)}
                                >
                                  <Sparkles size={15} />
                                </button>
                              )}

                              {invoice.status !== "Paid" && (
                                <button
                                  className="table-action"
                                  title="Mark as paid"
                                  aria-label={`Mark ${invoice.id} as paid`}
                                  disabled={actionLoading === invoice.id}
                                  onClick={() => void handlePaid(invoice)}
                                >
                                  {actionLoading === invoice.id ? (
                                    <LoaderCircle size={15} className="spin" />
                                  ) : (
                                    <CheckCircle2 size={15} />
                                  )}
                                </button>
                              )}

                              <button
                                className="table-action"
                                title="Invoice details"
                                aria-label={`View ${invoice.id} details`}
                                onClick={() => setSelectedInvoice(invoice)}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span><ShieldCheck size={14} /> Connected to your DuePilot database</span>
                <span>Showing {filteredInvoices.length} of {invoices.length}</span>
              </div>
            </section>
          )}

          <footer className="app-footer">
            <span>© 2026 DuePilot</span>
            <span><span className="footer-status" /> API-connected workspace</span>
            <span>Built for clearer cash flow <span className="footer-heart">✦</span></span>
          </footer>
        </div>
      </main>

      {(selectedInvoice || reminderLoading) && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reminderLoading) {
              setSelectedInvoice(null);
              setReminder(null);
            }
          }}
        >
          <section
            className="reminder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div className="modal-icon"><Sparkles size={19} /></div>

              <div>
                <h2 id="modal-title">
                  {reminderLoading
                    ? "Writing your reminder..."
                    : reminder
                      ? "Your reminder draft"
                      : "Invoice details"}
                </h2>
                <p>
                  {selectedInvoice
                    ? `${selectedInvoice.id} · ${selectedInvoice.client}`
                    : "DuePilot assistant"}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => {
                  if (!reminderLoading) {
                    setSelectedInvoice(null);
                    setReminder(null);
                  }
                }}
                aria-label="Close dialog"
                disabled={reminderLoading}
              >
                <X size={19} />
              </button>
            </div>

            {selectedInvoice && (
              <div className="modal-invoice-summary">
                <div>
                  <span>Invoice amount</span>
                  <strong>{formatMoney(selectedInvoice.amount)}</strong>
                </div>
                <div>
                  <span>Current status</span>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </div>
            )}

            {reminderLoading ? (
              <div className="modal-loading">
                <LoaderCircle size={28} className="spin" />
                <strong>Preparing a professional follow-up</strong>
                <span>Asking the AI to keep it clear, polite, and specific.</span>
              </div>
            ) : reminder ? (
              <>
                <div className="draft-source">
                  <span className={reminder.source === "gemini" ? "source-ai" : "source-template"}>
                    {reminder.source === "gemini" ? (
                      <Sparkles size={13} />
                    ) : (
                      <FileText size={13} />
                    )}
                    {reminder.source === "gemini" ? "Gemini AI draft" : "Fallback template"}
                  </span>
                  <span>Review before sending</span>
                </div>

                <div className="draft-text">{reminder.reminder}</div>

                <div className="draft-note">
                  <ShieldCheck size={15} />
                  <span>
                    {reminder.note} DuePilot generates drafts only; it does
                    not send emails or verify bank payments.
                  </span>
                </div>

                <div className="modal-actions">
                  <button className="button-secondary" onClick={() => void copyReminder()}>
                    <Copy size={15} /> {copied ? "Copied!" : "Copy draft"}
                  </button>
                  <button className="button-primary" onClick={downloadReminder}>
                    <Download size={15} /> Download draft
                  </button>
                </div>
              </>
            ) : selectedInvoice ? (
              <>
                <div className="detail-list">
                  <div>
                    <span>Client email</span>
                    <strong>{selectedInvoice.email}</strong>
                  </div>
                  <div>
                    <span>Project</span>
                    <strong>{selectedInvoice.project}</strong>
                  </div>
                  <div>
                    <span>Due date</span>
                    <strong>
                      {new Date(
                        `${selectedInvoice.dueDate.slice(0, 10)}T00:00:00`,
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </div>
                  <div>
                    <span>Days overdue</span>
                    <strong>
                      {selectedInvoice.daysOverdue > 0
                        ? `${selectedInvoice.daysOverdue} days`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    className="button-secondary"
                    onClick={() => setSelectedInvoice(null)}
                  >
                    Close
                  </button>

                  {selectedInvoice.status !== "Paid" && (
                    <button
                      className="button-primary"
                      onClick={() => void handleReminder(selectedInvoice)}
                    >
                      <Sparkles size={15} /> Generate reminder
                    </button>
                  )}

                  {selectedInvoice.status !== "Paid" && (
                    <button
                      className="button-secondary"
                      disabled={actionLoading === selectedInvoice.id}
                      onClick={() => void handlePaid(selectedInvoice)}
                    >
                      <CheckCircle2 size={15} /> Mark paid
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
