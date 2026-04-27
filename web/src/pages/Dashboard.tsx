import { useQuery } from '@tanstack/react-query';
import { api, Overview } from '../api';
import { useAuth } from '../auth';

export default function Dashboard() {
  const { token } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api<Overview>(token!, '/api/stats/overview'),
  });

  if (isLoading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (error) return <div className="text-sm text-red-600">{(error as Error).message}</div>;
  if (!data) return null;

  const subTotals = Object.fromEntries(data.subscribers.map((s) => [s.status, s.n]));
  const evt = Object.fromEntries(data.events_last_7d.map((e) => [e.type, e.n]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Active subscribers" value={subTotals.active ?? 0} />
        <Card label="Unsubscribed" value={subTotals.unsubscribed ?? 0} />
        <Card label="Bounced" value={subTotals.bounced ?? 0} />
        <Card label="Total campaigns" value={data.campaigns?.total ?? 0} />
      </div>
      <h2 className="text-base font-medium">Last 7 days</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card label="Opens" value={evt.open ?? 0} />
        <Card label="Clicks" value={evt.click ?? 0} />
        <Card label="Bounces" value={evt.bounce ?? 0} />
        <Card label="Unsubs" value={evt.unsubscribe ?? 0} />
        <Card label="Downloads" value={evt.download ?? 0} />
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
