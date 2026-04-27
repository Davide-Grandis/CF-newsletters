import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, BounceEvent } from '../api';
import { useAuth } from '../auth';

export default function Bounces() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['bounces'],
    queryFn: () => api<{ items: BounceEvent[] }>(token!, '/api/bounces?limit=200'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Recent bounces (7d)</h1>
      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Campaign</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2 text-slate-500">{b.ts}</td>
                  <td className="p-2 font-mono text-xs">{b.email ?? `#${b.subscriber_id}`}</td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      b.status_code?.startsWith('5') ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>{b.status_code ?? '—'}</span>
                  </td>
                  <td className="p-2">
                    <Link to={`/campaigns/${b.campaign_id}`} className="text-xs text-slate-500 hover:underline font-mono">
                      {b.campaign_id?.slice(0, 8)}…
                    </Link>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">No bounces in the last 7 days. </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
