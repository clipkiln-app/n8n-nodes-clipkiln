/* Plays n8n's part around the built nodes and runs them against a real Clipkiln
 * (CLIPKILN_TEST_BASE, default preview) with real API keys. Not shipped (files: ["dist"]). */
const assert = require('node:assert/strict');
const { Clipkiln } = require('../dist/nodes/Clipkiln/Clipkiln.node.js');
const { ClipkilnTrigger } = require('../dist/nodes/ClipkilnTrigger/ClipkilnTrigger.node.js');
const { ClipkilnApi } = require('../dist/credentials/ClipkilnApi.credentials.js');

const BASE = process.env.CLIPKILN_TEST_BASE || 'https://clipkiln.com/preview';
const KEY = process.env.CLIPKILN_TEST_KEY;
const PLAN_KEY = process.env.CLIPKILN_TEST_PLAN_KEY;

function ctx(params, key = KEY, staticData = {}) {
  const node = { name: 'Clipkiln', type: 'test' };
  return {
    getNode: () => node,
    getNodeParameter: (n, _i, d) => (n in params ? params[n] : d),
    getCurrentNodeParameter: (n) => params[n],
    getInputData: () => [{ json: {} }],
    continueOnFail: () => false,
    getWorkflowStaticData: () => staticData,
    getNodeWebhookUrl: () => 'https://example.com/n8n-webhook-test-' + process.pid,
    logger: { warn: () => {} },
    helpers: {
      async httpRequestWithAuthentication(credName, opts) {
        assert.equal(credName, 'clipkilnApi');
        const cred = new ClipkilnApi();
        const header = cred.authenticate.properties.headers.Authorization.replace(/^=/, '').replace('{{$credentials.apiKey}}', key);
        const url = new URL(opts.url.replace('https://clipkiln.com', BASE));
        for (const [k, v] of Object.entries(opts.qs || {})) url.searchParams.set(k, String(v));
        const r = await fetch(url, { method: opts.method, headers: { Authorization: header, 'Content-Type': 'application/json' },
                                     body: opts.body ? JSON.stringify(opts.body) : undefined });
        const text = await r.text();
        const body = text ? JSON.parse(text) : {};
        if (!r.ok) { const e = new Error('HTTP ' + r.status); e.response = { status: r.status, body }; throw e; }
        return body;
      },
      returnJsonArray: (o) => (Array.isArray(o) ? o : [o]).map((json) => ({ json })),
    },
  };
}

(async () => {
  const node = new Clipkiln();
  const trig = new ClipkilnTrigger();
  let n = 0;
  const ok = (m) => console.log(`  ✓ ${m}`) || n++;

  // credential header is "Bearer <key>"
  assert.equal(new ClipkilnApi().authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
  ok('credential sends Authorization: Bearer <key>; test request is GET /api/v1/usage');

  const videos = await node.methods.loadOptions.getRecentVideos.call(ctx({}));
  assert.ok(Array.isArray(videos)); ok(`video dropdown loads (${videos.length} videos)`);
  assert.deepEqual(await node.methods.loadOptions.getVideoClips.call(ctx({})), []); ok('clip dropdown is empty until a video is picked');

  await assert.rejects(node.execute.call(ctx({ resource: 'video', operation: 'createClips', url: 'not a link', category: 'funny' })),
                       (e) => { assert.ok(e.message.length > 3); return true; });
  ok('a non-video link is refused with Clipkiln\'s sentence (nothing charged)');

  await assert.rejects(node.execute.call(ctx({ resource: 'video', operation: 'get', jobId: 'nope' })), /./); ok('an unknown video is an error with a message');

  if (PLAN_KEY) {
    await assert.rejects(node.execute.call(ctx({ resource: 'video', operation: 'get', jobId: 'x' }, PLAN_KEY)), /for API accounts/);
    ok('a plan account key is told Clipkiln on n8n is for API accounts');
  }
  await assert.rejects(node.execute.call(ctx({ resource: 'video', operation: 'get', jobId: 'x' }, 'ck_live_nope')), /Invalid or revoked API key/);
  ok('a wrong key shows "Invalid or revoked API key"');

  // trigger lifecycle: create -> exists -> delete -> gone
  const sd = {};
  const tctx = ctx({ event: 'clipExported' }, KEY, sd);
  assert.equal(await trig.webhookMethods.default.checkExists.call(tctx), false);
  assert.equal(await trig.webhookMethods.default.create.call(tctx), true);
  assert.match(String(sd.webhookId), /^we_/);
  assert.equal(await trig.webhookMethods.default.checkExists.call(tctx), true);
  ok('activating the trigger subscribes a webhook for its event and remembers its id');
  assert.equal(await trig.webhookMethods.default.delete.call(tctx), true);
  assert.equal(sd.webhookId, undefined);
  assert.equal(await trig.webhookMethods.default.checkExists.call(ctx({ event: 'clipExported' }, KEY, { webhookId: 'we_gone' })), false);
  ok('deactivating removes it from Clipkiln');

  const w = await trig.webhook.call({ getBodyData: () => ({ id: 'evt_1', type: 'clip.exported', created: 1795000000,
                                                            data: { job_id: 'j', clip_id: 'c' } }), helpers: ctx({}).helpers });
  assert.deepEqual(w.workflowData[0][0].json, { id: 'evt_1', event: 'clip.exported', created: new Date(1795000000 * 1000).toISOString(), job_id: 'j', clip_id: 'c' });
  ok('a delivery becomes one item: id, event, ISO time and the event data');

  // a real story (cheap): create + render
  const st = await node.execute.call(ctx({ resource: 'story', operation: 'create', script: 'Testing the n8n node. One short line.', voice: 'bf_emma', background: 'slime' }));
  assert.ok(st[0][0].json.id); assert.equal(st[0][0].json.voice, 'bf_emma'); assert.equal(st[0][0].json.background, 'slime');
  ok(`story created and rendering with the chosen voice and background (${st[0][0].json.status})`);
  console.log(`${n} checks passed`);
})().catch((e) => { console.error('FAILED:', e && e.stack || e); process.exit(1); });
