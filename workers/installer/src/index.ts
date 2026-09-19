import { ADMIN_ASSETS, DATABASE_SCHEMA, WORKER_ARTIFACTS } from './generated/artifacts';

type InstallRequest = {
  accountId: string;
  adminEmail: string;
  domain: string;
  fromAddress: string;
  installToken: string;
  readToken?: string;
  routingToken?: string;
  teamName: string;
  turnstileSecret?: string;
  zeroTrustToken?: string;
};

type Resource = { id?: string; name?: string; queue_id?: string; queue_name?: string; uuid?: string };
type ApiResult<T> = { errors?: Array<{ message?: string }>; result?: T; success?: boolean };
type Binding = Record<string, unknown>;

const API = 'https://api.cloudflare.com/client/v4';
const workerNames = ['ingest', 'consumer', 'tracker', 'bounce', 'cleanup', 'admin'] as const;

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cf-newsletter installer</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033;background:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:32px 16px}.shell{max-width:840px;margin:auto}.card{background:#fff;border:1px solid #dce2ec;border-radius:14px;padding:26px;box-shadow:0 8px 30px #1720330d;margin-bottom:18px}h1{margin:0 0 8px;font-size:30px}h2{font-size:19px;margin:0 0 14px}p,li{line-height:1.55;color:#4b5568}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.wide{grid-column:1/-1}label{display:block;font-size:13px;font-weight:650;color:#344054}input{width:100%;margin-top:6px;padding:11px 12px;border:1px solid #cbd3df;border-radius:8px;font:inherit}button{border:0;border-radius:8px;padding:12px 18px;background:#f48120;color:#fff;font-weight:700;font-size:15px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.note{font-size:13px}.progress{display:none}.row{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #eef1f5}.state{width:92px;font-weight:700;color:#667085}.ok{color:#16803c}.error{color:#b42318}code{background:#f1f4f8;padding:2px 5px;border-radius:4px}@media(max-width:650px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><main class="shell"><section class="card"><h1>Install cf-newsletter</h1><p>This setup Worker provisions and deploys the isolated newsletter services into your Cloudflare account. The installation token is used only for this request and is not stored.</p></section>
<section class="card"><h2>Cloudflare account requirements</h2><ul><li>A Cloudflare zone using the selected domain.</li><li>Workers, D1, R2 and Queues enabled.</li><li>Zero Trust Access enabled; the installer can create its organization, email list, application and policy.</li><li>Email Routing entitlement. The installer enables it and creates Worker routes.</li><li>Email Sending entitlement. After installation, verify domain onboarding and DKIM in <strong>Compute → Email Service</strong>.</li></ul><p class="note">Installation token permissions: Account — Workers Scripts Write, D1 Write, Queues Write, Workers R2 Storage Write, Access Organizations/Identity Providers/Groups Write, Access Apps and Policies Write, Zero Trust Write, Email Read. Zone — Zone Read, Zone Settings Write, Workers Routes Write, Email Routing Rules Write, Analytics Read.</p></section>
<form class="card" id="form"><h2>Deployment details</h2><div class="grid"><label>Cloudflare account ID<input name="accountId" required pattern="[a-fA-F0-9]{32}"></label><label>Cloudflare zone domain<input name="domain" required placeholder="example.com"></label><label>Cloudflare administrator email<input name="adminEmail" required type="email"></label><label>Default sender address<input name="fromAddress" required type="email" placeholder="newsletter@example.com"></label><label>Zero Trust team name<input name="teamName" required placeholder="my-newsletter"></label><label class="wide">Short-lived installation API token<input name="installToken" required type="password" autocomplete="off"></label><label class="wide">Routing/analytics runtime token <span class="note">(optional)</span><input name="routingToken" type="password" autocomplete="off"></label><label class="wide">Read-only runtime token <span class="note">(optional)</span><input name="readToken" type="password" autocomplete="off"></label><label class="wide">Zero Trust runtime token <span class="note">(optional)</span><input name="zeroTrustToken" type="password" autocomplete="off"></label><label class="wide">Turnstile secret <span class="note">(optional)</span><input name="turnstileSecret" type="password" autocomplete="off"></label><label class="wide note"><input required type="checkbox" style="width:auto;margin-right:8px">I understand that this deploy replaces existing <code>newsletter-*</code> Worker scripts and the zone catch-all Email Routing rule.</label><div class="wide"><button type="submit">Deploy to this Cloudflare account</button></div></div></form>
<section class="card progress" id="progress"><h2>Installation progress</h2><div id="rows"></div></section></main><script>
const form=document.querySelector('#form'),progress=document.querySelector('#progress'),rows=document.querySelector('#rows'),button=form.querySelector('button');
form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;progress.style.display='block';rows.innerHTML='';const data=Object.fromEntries(new FormData(form)),payload=JSON.stringify(data);form.querySelectorAll('input[type=password]').forEach(input=>input.value='');try{const response=await fetch('/api/install',{method:'POST',headers:{'content-type':'application/json'},body:payload});if(!response.ok||!response.body)throw new Error(await response.text());const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer='';for(;;){const {value,done}=await reader.read();buffer+=value||'';const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){if(!line)continue;const item=JSON.parse(line),row=document.createElement('div');row.className='row';row.innerHTML='<span class="state '+(item.state==='complete'?'ok':item.state==='error'?'error':'')+'"></span><span></span>';row.children[0].textContent=item.state;row.children[1].textContent=item.message;rows.append(row);row.scrollIntoView({behavior:'smooth',block:'nearest'});}if(done)break;}}catch(error){const row=document.createElement('div');row.className='row';row.innerHTML='<span class="state error">error</span><span></span>';row.children[1].textContent=error.message;rows.append(row);}finally{button.disabled=false;}});
</script></body></html>`;

function responseJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function validInput(value: InstallRequest): string | null {
  if (!/^[a-f0-9]{32}$/i.test(value.accountId)) return 'Invalid Cloudflare account ID';
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.domain)) return 'Invalid zone domain';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.adminEmail)) return 'Invalid administrator email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.fromAddress)) return 'Invalid sender address';
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(value.teamName)) return 'Invalid Zero Trust team name';
  if (!value.installToken) return 'Installation token is required';
  return null;
}

async function api<T>(token: string, path: string, init: RequestInit = {}, allowNotFound = false): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({})) as ApiResult<T>;
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
    throw new Error(`${path}: ${message}`);
  }
  return payload.result ?? null;
}

async function ensureD1(input: InstallRequest): Promise<string> {
  const databases = await api<Resource[]>(input.installToken, `/accounts/${input.accountId}/d1/database?name=newsletter_db`);
  let database = databases?.find((item) => item.name === 'newsletter_db');
  if (!database) database = await api<Resource>(input.installToken, `/accounts/${input.accountId}/d1/database`, { method: 'POST', body: JSON.stringify({ name: 'newsletter_db', jurisdiction: 'eu' }) }) ?? undefined;
  const id = database?.uuid ?? database?.id;
  if (!id) throw new Error('Could not resolve newsletter_db ID');
  return id;
}

async function ensureQueue(input: InstallRequest, name: string): Promise<Resource> {
  const queues = await api<Resource[]>(input.installToken, `/accounts/${input.accountId}/queues`);
  const existing = queues?.find((item) => item.queue_name === name || item.name === name);
  if (existing) return existing;
  const created = await api<Resource>(input.installToken, `/accounts/${input.accountId}/queues`, { method: 'POST', body: JSON.stringify({ queue_name: name }) });
  if (!created) throw new Error(`Could not create ${name}`);
  return created;
}

async function ensureBucket(input: InstallRequest, name: string, jurisdiction?: string): Promise<void> {
  const headers = jurisdiction ? { 'cf-r2-jurisdiction': jurisdiction } : undefined;
  const result = await api<{ buckets?: Resource[] }>(input.installToken, `/accounts/${input.accountId}/r2/buckets`, { headers });
  if (result?.buckets?.some((bucket) => bucket.name === name)) return;
  await api(input.installToken, `/accounts/${input.accountId}/r2/buckets`, { method: 'POST', headers, body: JSON.stringify({ name }) });
}

async function ensureAccess(input: InstallRequest): Promise<string> {
  const organization = await api<{ auth_domain?: string }>(input.installToken, `/accounts/${input.accountId}/access/organizations`, {}, true);
  if (!organization?.auth_domain) await api(input.installToken, `/accounts/${input.accountId}/access/organizations`, { method: 'POST', body: JSON.stringify({ name: 'cf-newsletter', auth_domain: `${input.teamName}.cloudflareaccess.com` }) });
  const lists = await api<Array<Resource & { type?: string }>>(input.installToken, `/accounts/${input.accountId}/gateway/lists`);
  let list = lists?.find((item) => item.name === 'cf-newsletter administrators' && item.type === 'EMAIL');
  if (!list) list = await api<Resource>(input.installToken, `/accounts/${input.accountId}/gateway/lists`, { method: 'POST', body: JSON.stringify({ name: 'cf-newsletter administrators', type: 'EMAIL', items: [{ value: input.adminEmail }] }) }) ?? undefined;
  if (!list?.id) throw new Error('Could not resolve Access email list');
  const items = await api<Array<{ value?: string }>>(input.installToken, `/accounts/${input.accountId}/gateway/lists/${list.id}/items?per_page=1000`);
  if (!items?.some((item) => item.value?.toLowerCase() === input.adminEmail)) await api(input.installToken, `/accounts/${input.accountId}/gateway/lists/${list.id}`, { method: 'PATCH', body: JSON.stringify({ append: [{ value: input.adminEmail }] }) });
  const apps = await api<Array<Resource & { domain?: string }>>(input.installToken, `/accounts/${input.accountId}/access/apps`);
  let app = apps?.find((item) => item.domain === `console.${input.domain}`);
  if (!app) app = await api<Resource>(input.installToken, `/accounts/${input.accountId}/access/apps`, { method: 'POST', body: JSON.stringify({ name: 'cf-newsletter console', domain: `console.${input.domain}`, type: 'self_hosted', session_duration: '24h' }) }) ?? undefined;
  if (!app?.id) throw new Error('Could not resolve Access application');
  const policies = await api<Array<Resource>>(input.installToken, `/accounts/${input.accountId}/access/apps/${app.id}/policies`);
  if (!policies?.some((policy) => policy.name === 'cf-newsletter administrators')) await api(input.installToken, `/accounts/${input.accountId}/access/apps/${app.id}/policies`, { method: 'POST', body: JSON.stringify({ name: 'cf-newsletter administrators', decision: 'allow', precedence: 1, include: [{ email_list: { id: list.id } }] }) });
  return list.id;
}

function baseBindings(databaseId: string): Binding[] {
  return [{ type: 'd1', name: 'DB', id: databaseId }];
}

function secrets(input: InstallRequest, name: typeof workerNames[number], linkKey: string, attachmentKey: string): Binding[] {
  const values: Binding[] = [];
  if (name === 'consumer' || name === 'tracker') values.push({ type: 'secret_text', name: 'LINK_SIGNING_KEY', text: linkKey }, { type: 'secret_text', name: 'ATTACHMENT_SIGNING_KEY', text: attachmentKey });
  if ((name === 'admin' || name === 'bounce') && input.routingToken) values.push({ type: 'secret_text', name: 'CF_API_TOKEN', text: input.routingToken });
  if ((name === 'admin' || name === 'consumer') && input.readToken) values.push({ type: 'secret_text', name: 'CF_READ_API_TOKEN', text: input.readToken });
  if (name === 'admin' && input.zeroTrustToken) values.push({ type: 'secret_text', name: 'CF_ZT_API_TOKEN', text: input.zeroTrustToken });
  if (name === 'tracker' && input.turnstileSecret) values.push({ type: 'secret_text', name: 'TURNSTILE_SECRET_KEY', text: input.turnstileSecret });
  return values;
}

function bindingsFor(input: InstallRequest, name: typeof workerNames[number], databaseId: string, linkKey: string, attachmentKey: string): Binding[] {
  const bindings = baseBindings(databaseId);
  if (name !== 'admin' && name !== 'bounce') bindings.push({ type: 'r2_bucket', name: 'ARCHIVE', bucket_name: 'newsletter-archive' });
  if (name === 'bounce') bindings.push({ type: 'r2_bucket', name: 'ARCHIVE', bucket_name: 'newsletter-archive' });
  if (name === 'ingest' || name === 'consumer') bindings.push({ type: 'queue', name: 'QUEUE', queue_name: 'newsletter-queue' });
  if (name === 'consumer' || name === 'tracker' || name === 'admin') bindings.push({ type: 'send_email', name: 'SEND_EMAIL' });
  if (name === 'admin') bindings.push({ type: 'r2_bucket', name: 'ASSETS_R2', bucket_name: 'newsletter-admin', jurisdiction: 'eu' }, { type: 'r2_bucket', name: 'ARCHIVE', bucket_name: 'newsletter-archive' }, { type: 'assets', name: 'ASSETS' });
  return [...bindings, ...secrets(input, name, linkKey, attachmentKey)];
}

async function uploadAssets(input: InstallRequest): Promise<string> {
  const manifest = Object.fromEntries(Object.entries(ADMIN_ASSETS).map(([path, asset]) => [path, { hash: asset.hash, size: asset.size }]));
  const session = await api<{ buckets?: string[][]; jwt?: string }>(input.installToken, `/accounts/${input.accountId}/workers/scripts/newsletter-admin/assets-upload-session`, { method: 'POST', body: JSON.stringify({ manifest }) });
  if (!session?.jwt) throw new Error('Could not start admin asset upload');
  let jwt = session.jwt;
  for (const bucket of session.buckets ?? []) {
    const form = new FormData();
    for (const hash of bucket) {
      const asset = Object.values(ADMIN_ASSETS).find((item) => item.hash === hash);
      if (!asset) throw new Error(`Missing generated asset ${hash}`);
      form.append(hash, new Blob([asset.base64], { type: asset.contentType }), hash);
    }
    const response = await fetch(`${API}/accounts/${input.accountId}/workers/assets/upload?base64=true`, { method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body: form });
    const payload = await response.json() as ApiResult<{ jwt?: string }>;
    if (!response.ok || payload.success === false || !payload.result?.jwt) throw new Error(`Asset upload failed: ${payload.errors?.map((error) => error.message).join('; ') || response.status}`);
    jwt = payload.result.jwt;
  }
  return jwt;
}

async function uploadWorker(input: InstallRequest, name: typeof workerNames[number], databaseId: string, linkKey: string, attachmentKey: string, assetsJwt?: string): Promise<void> {
  const form = new FormData();
  const metadata: Record<string, unknown> = {
    main_module: 'main.js',
    compatibility_date: '2026-09-10',
    compatibility_flags: ['nodejs_compat'],
    bindings: bindingsFor(input, name, databaseId, linkKey, attachmentKey),
    workers_dev: true,
  };
  if (name === 'admin' && assetsJwt) metadata.assets = { jwt: assetsJwt, config: { not_found_handling: 'single-page-application', run_worker_first: ['/api/*', '/media/*'] } };
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('main.js', new Blob([WORKER_ARTIFACTS[name]], { type: 'application/javascript+module' }), 'main.js');
  await api(input.installToken, `/accounts/${input.accountId}/workers/scripts/newsletter-${name}`, { method: 'PUT', body: form });
}

async function configureQueue(input: InstallRequest, queue: Resource): Promise<void> {
  const id = queue.queue_id ?? queue.id;
  if (!id) throw new Error('Could not resolve queue ID');
  const consumers = await api<Array<Resource & { script_name?: string }>>(input.installToken, `/accounts/${input.accountId}/queues/${id}/consumers`);
  if (consumers?.some((consumer) => consumer.script_name === 'newsletter-consumer')) return;
  await api(input.installToken, `/accounts/${input.accountId}/queues/${id}/consumers`, { method: 'POST', body: JSON.stringify({ script_name: 'newsletter-consumer', type: 'worker', dead_letter_queue: 'newsletter-dlq', settings: { batch_size: 10, max_wait_time_ms: 5000, max_concurrency: 5, max_retries: 3 } }) });
}

async function configureDomains(input: InstallRequest, zoneId: string): Promise<void> {
  const domains = await api<Array<{ hostname?: string }>>(input.installToken, `/accounts/${input.accountId}/workers/domains`);
  for (const [hostname, service] of [[`console.${input.domain}`, 'newsletter-admin'], [`track.${input.domain}`, 'newsletter-tracker']]) {
    if (!domains?.some((item) => item.hostname === hostname)) await api(input.installToken, `/accounts/${input.accountId}/workers/domains`, { method: 'PUT', body: JSON.stringify({ hostname, service, zone_id: zoneId }) });
  }
}

async function configureRouting(input: InstallRequest, zoneId: string): Promise<void> {
  await api(input.installToken, `/zones/${zoneId}/email/routing/enable`, { method: 'POST', body: '{}' });
  const address = `newsletter@${input.domain}`;
  const rules = await api<Array<{ matchers?: Array<{ field?: string; value?: string }> }>>(input.installToken, `/zones/${zoneId}/email/routing/rules`);
  if (!rules?.some((rule) => rule.matchers?.some((matcher) => matcher.field === 'to' && matcher.value === address))) await api(input.installToken, `/zones/${zoneId}/email/routing/rules`, { method: 'POST', body: JSON.stringify({ name: 'cf-newsletter inbound', enabled: true, matchers: [{ type: 'literal', field: 'to', value: address }], actions: [{ type: 'worker', value: ['newsletter-ingest'] }] }) });
  await api(input.installToken, `/zones/${zoneId}/email/routing/rules/catch_all`, { method: 'PUT', body: JSON.stringify({ name: 'cf-newsletter unsubscribe and bounce handling', enabled: true, matchers: [{ type: 'all' }], actions: [{ type: 'worker', value: ['newsletter-bounce'] }] }) });
}

function sqlValue(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runInstall(input: InstallRequest, update: (state: string, message: string) => void): Promise<void> {
  update('checking', 'Validating API token and Cloudflare zone');
  const verification = await api<{ status?: string }>(input.installToken, '/user/tokens/verify');
  if (verification?.status !== 'active') throw new Error('Installation token is not active');
  const zones = await api<Resource[]>(input.installToken, `/zones?name=${encodeURIComponent(input.domain)}&account.id=${input.accountId}`);
  const zoneId = zones?.[0]?.id;
  if (!zoneId) throw new Error(`Zone ${input.domain} was not found in this account`);

  update('creating', 'D1 database, queues and R2 buckets');
  const databaseId = await ensureD1(input);
  const queue = await ensureQueue(input, 'newsletter-queue');
  await ensureQueue(input, 'newsletter-dlq');
  await ensureBucket(input, 'newsletter-archive');
  await ensureBucket(input, 'newsletter-admin', 'eu');

  update('configuring', 'D1 schema');
  await api(input.installToken, `/accounts/${input.accountId}/d1/database/${databaseId}/query`, { method: 'POST', body: JSON.stringify({ sql: DATABASE_SCHEMA }) });

  update('configuring', 'Zero Trust organization, administrator list and Access policy');
  const accessListId = await ensureAccess(input);
  const settings = { BASE_DOMAIN: input.domain, EMAIL_ROUTING_ZONE_ID: zoneId, ACCESS_ACCOUNT_ID: input.accountId, ACCESS_LIST_ID: accessListId, FROM_ADDRESS: input.fromAddress, TRACKING_BASE_URL: `https://track.${input.domain}`, INGEST_WORKER_NAME: 'newsletter-ingest' };
  const values = Object.entries(settings).map(([key, value]) => `(${sqlValue(key)},${sqlValue(value)})`).join(',');
  const seed = `INSERT INTO settings(key,value) VALUES ${values} ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now'); INSERT INTO admins(email,role) VALUES(${sqlValue(input.adminEmail)},'super_admin') ON CONFLICT(email) DO UPDATE SET role='super_admin',updated_at=datetime('now');`;
  await api(input.installToken, `/accounts/${input.accountId}/d1/database/${databaseId}/query`, { method: 'POST', body: JSON.stringify({ sql: seed }) });

  update('uploading', 'Admin console static assets');
  const assetsJwt = await uploadAssets(input);
  const keyBytes = new Uint8Array(48);
  crypto.getRandomValues(keyBytes);
  const linkKey = btoa(String.fromCharCode(...keyBytes));
  crypto.getRandomValues(keyBytes);
  const attachmentKey = btoa(String.fromCharCode(...keyBytes));

  for (const name of workerNames) {
    update('deploying', `newsletter-${name}`);
    await uploadWorker(input, name, databaseId, linkKey, attachmentKey, name === 'admin' ? assetsJwt : undefined);
  }

  update('configuring', 'Queue consumer and cron triggers');
  await configureQueue(input, queue);
  await api(input.installToken, `/accounts/${input.accountId}/workers/scripts/newsletter-bounce/schedules`, { method: 'PUT', body: JSON.stringify([{ cron: '*/30 * * * *' }]) });
  await api(input.installToken, `/accounts/${input.accountId}/workers/scripts/newsletter-cleanup/schedules`, { method: 'PUT', body: JSON.stringify([{ cron: '0 4 * * *' }]) });

  update('configuring', 'Custom domains and Email Routing rules');
  await configureDomains(input, zoneId);
  await configureRouting(input, zoneId);

  update('complete', `Installation complete. Open https://console.${input.domain}. Verify Email Sending and DKIM, then delete the cf-newsletter-installer Worker.`);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' } });
    if (request.method !== 'POST' || url.pathname !== '/api/install') return responseJson({ error: 'not found' }, 404);
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 20_000) return responseJson({ error: 'request too large' }, 413);
    const input = await request.json<InstallRequest>().catch(() => null);
    if (!input) return responseJson({ error: 'invalid JSON' }, 400);
    input.accountId = String(input.accountId ?? '').trim();
    input.domain = String(input.domain ?? '').trim().toLowerCase();
    input.adminEmail = String(input.adminEmail ?? '').trim().toLowerCase();
    input.fromAddress = String(input.fromAddress ?? '').trim().toLowerCase();
    input.teamName = String(input.teamName ?? '').trim().toLowerCase();
    const error = validInput(input);
    if (error) return responseJson({ error }, 400);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const update = (state: string, message: string) => controller.enqueue(encoder.encode(`${JSON.stringify({ state, message })}\n`));
        try {
          await runInstall(input, update);
        } catch (installError) {
          update('error', installError instanceof Error ? installError.message : 'Installation failed');
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  },
} satisfies ExportedHandler<Env>;
