import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, Campaign, Page } from '../api';
import { useAuth } from '../auth';

export default function Campaigns() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<Page<Campaign>>(token!, '/api/campaigns?limit=100'),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Campaigns</h1>
      {isLoading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2">Subject</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Recipients</th>
                <th className="text-right p-2">Sent</th>
                <th className="text-right p-2">Failed</th>
                <th className="text-right p-2">Att.</th>
                <th className="text-left p-2">Sent at</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-2">
                    <Link to={`/campaigns/${c.id}`} className="text-slate-900 hover:underline">
                      {c.subject || '(no subject)'}
                    </Link>
                    {c.link_mode === 1 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1 rounded">link mode</span>
                    )}
                  </td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2 text-right">{c.total_recipients}</td>
                  <td className="p-2 text-right text-emerald-700">{c.sent_count}</td>
                  <td className="p-2 text-right text-red-700">{c.failed_count}</td>
                  <td className="p-2 text-right">{c.attachment_count}</td>
                  <td className="p-2 text-slate-500">{c.created_at}</td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-slate-500">No campaigns yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
