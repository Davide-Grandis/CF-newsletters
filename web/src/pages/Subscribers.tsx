import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Page, Subscriber } from '../api';
import { useAuth } from '../auth';

export default function Subscribers() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState<number>(0);

  const list = useQuery({
    queryKey: ['subs', status, q, cursor],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: '50', cursor: String(cursor) });
      if (status) sp.set('status', status);
      if (q) sp.set('q', q);
      return api<Page<Subscriber>>(token!, `/api/subscribers?${sp.toString()}`);
    },
  });

  const add = useMutation({
    mutationFn: (vars: { email: string; name?: string }) =>
      api(token!, '/api/subscribers', { method: 'POST', body: JSON.stringify(vars) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subs'] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(token!, `/api/subscribers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subs'] }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return api<{ inserted: number }>(token!, '/api/subscribers/import', {
        method: 'POST',
        body: JSON.stringify({ csv: text }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subs'] }),
  });

  function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim() || undefined;
    if (!email) return;
    add.mutate({ email, name });
    e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Subscribers</h1>
        <label className="ml-auto text-sm cursor-pointer bg-white border rounded px-3 py-1.5 hover:bg-slate-50">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
        </label>
      </div>

      {upload.data && (
        <div className="text-xs text-emerald-700">Imported {upload.data.inserted} rows.</div>
      )}

      <form onSubmit={onAdd} className="bg-white border rounded p-3 flex gap-2">
        <input name="email" type="email" required placeholder="email@example.com" className="border rounded px-2 py-1 text-sm flex-1" />
        <input name="name" placeholder="name (optional)" className="border rounded px-2 py-1 text-sm w-48" />
        <button className="bg-slate-900 text-white text-sm rounded px-3 py-1">Add</button>
      </form>

      <div className="flex gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(0); }} className="border rounded px-2 py-1 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setCursor(0); }}
          placeholder="Search email or name"
          className="border rounded px-2 py-1 text-sm flex-1"
        />
      </div>

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Bounces</th>
              <th className="text-left p-2">Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 font-mono text-xs">{s.email}</td>
                <td className="p-2">{s.name ?? '—'}</td>
                <td className="p-2">
                  <StatusPill status={s.status} />
                </td>
                <td className="p-2 text-right">{s.bounce_count}</td>
                <td className="p-2 text-slate-500">{s.subscribed_at}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => remove.mutate(s.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    unsubscribe
                  </button>
                </td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No results.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 justify-end text-sm">
        <button
          onClick={() => setCursor(0)}
          disabled={cursor === 0}
          className="border rounded px-3 py-1 disabled:opacity-40"
        >First</button>
        <button
          onClick={() => list.data?.nextCursor && setCursor(Number(list.data.nextCursor))}
          disabled={!list.data?.nextCursor}
          className="border rounded px-3 py-1 disabled:opacity-40"
        >Next →</button>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    unsubscribed: 'bg-slate-100 text-slate-700',
    bounced: 'bg-amber-100 text-amber-800',
    complained: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cls[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}
