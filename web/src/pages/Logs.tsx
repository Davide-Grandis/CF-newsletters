import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api, LogRow, Page } from '../api';
import { RefreshIcon } from './Dashboard';

const SOURCES = ['', 'ingest', 'consumer', 'tracker', 'bounce', 'admin'];
const LEVELS = ['', 'info', 'warn', 'error'];
const PAGE_SIZE = 20;

// Cloudflare-style page window: up to 5 numbered buttons centred on the current
// page, clamped to the available range.
function pageWindow(page: number, pageCount: number): number[] {
  const span = 5;
  let start = Math.max(0, page - Math.floor(span / 2));
  const end = Math.min(pageCount, start + span);
  start = Math.max(0, end - span);
  return Array.from({ length: end - start }, (_, i) => start + i);
}

function PagerButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="min-w-[2rem] h-8 px-2 rounded text-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

export default function Logs() {
  // `input` is the live text box; `q` is the applied search (on submit).
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(0);

  const logs = useQuery({
    queryKey: ['logs', q, source, level, page],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(PAGE_SIZE), cursor: String(page * PAGE_SIZE) });
      if (q) sp.set('q', q);
      if (source) sp.set('source', source);
      if (level) sp.set('level', level);
      return api<Page<LogRow>>(`/api/logs?${sp.toString()}`);
    },
  });

  const items = logs.data?.items ?? [];
  const total = logs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lastPage = pageCount - 1;

  // Any filter/search change resets back to the first page.
  const resetTo = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setQ(input.trim());
    setPage(0);
  };

  const [exporting, setExporting] = useState(false);
  async function onExport() {
    setExporting(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (source) sp.set('source', source);
      if (level) sp.set('level', level);
      const res = await fetch(`/api/logs/export?${sp.toString()}`);
      if (!res.ok) throw new Error(`export failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Logs</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="text-sm bg-white border border-slate-200 rounded px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => logs.refetch()}
              disabled={logs.isFetching}
              className="inline-flex items-center gap-1.5 text-sm border border-slate-200 rounded px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshIcon spinning={logs.isFetching} />
              Refresh
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
          Unified activity feed across the whole pipeline: the ingest worker firing on inbound
          email, queue enqueue details, and consumer send activity — merged with recipient
          engagement events (open, click, bounce, unsubscribe, download).
        </p>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search event, message, email, campaign…"
          className="flex-1 min-w-[16rem] border border-slate-300 rounded px-3 py-1.5 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        />
        <select
          value={source}
          onChange={(e) => resetTo(setSource)(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s ? s : 'All sources'}</option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => resetTo(setLevel)(e.target.value)}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l ? l : 'All levels'}</option>
          ))}
        </select>
        <button
          type="submit"
          className="text-sm border border-slate-200 rounded px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Search
        </button>
      </form>

      {logs.isLoading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      ) : logs.error ? (
        <div className="text-sm text-red-600">{(logs.error as Error).message}</div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Time (UTC)</th>
                  <th className="text-left px-3 py-2">Level</th>
                  <th className="text-left px-3 py-2">Newsletter</th>
                  <th className="text-left px-3 py-2 min-w-[16rem]">Campaign</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">Event</th>
                  <th className="text-left px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="px-3 py-1 whitespace-nowrap text-slate-500 dark:text-slate-400">{r.ts}</td>
                    <td className="px-3 py-1"><LevelBadge level={r.level} /></td>
                    <td className="px-3 py-1 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.newsletter_name ?? '—'}</td>
                    <td className="px-3 py-1">
                      {r.campaign_id ? (
                        <Link to={`/campaigns/${r.campaign_id}`} className="text-slate-500 hover:underline dark:text-slate-400">
                          {r.campaign_subject || '(no subject)'}
                        </Link>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1 text-slate-500 dark:text-slate-400">{r.source}</td>
                    <td className="px-3 py-1">{r.event}</td>
                    <td className="px-3 py-1 text-slate-700 dark:text-slate-200">
                      {r.message ?? (r.kind === 'event' ? [r.email, r.detail].filter(Boolean).join(' — ') : '—')}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-500 dark:text-slate-400">No log entries match.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>
              {total > 0
                ? `Showing ${page * PAGE_SIZE + 1} - ${page * PAGE_SIZE + items.length} of ${total}`
                : 'No results'}
            </span>
            <div className="flex items-center gap-1">
              <PagerButton label="First page" onClick={() => setPage(0)} disabled={page === 0 || logs.isFetching}>
                «
              </PagerButton>
              <PagerButton label="Previous page" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || logs.isFetching}>
                ‹
              </PagerButton>
              {pageWindow(page, pageCount).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  disabled={logs.isFetching}
                  aria-current={n === page ? 'page' : undefined}
                  className={`min-w-[2rem] h-8 px-2 rounded border text-center ${
                    n === page
                      ? 'border-slate-300 bg-slate-100 text-slate-900 font-medium dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
                      : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {n + 1}
                </button>
              ))}
              <PagerButton label="Next page" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage || logs.isFetching}>
                ›
              </PagerButton>
              <PagerButton label="Last page" onClick={() => setPage(lastPage)} disabled={page >= lastPage || logs.isFetching}>
                »
              </PagerButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const cls: Record<string, string> = {
    debug: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cls[level] ?? cls.info}`}>{level}</span>
  );
}
