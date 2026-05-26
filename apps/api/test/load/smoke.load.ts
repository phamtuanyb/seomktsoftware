/* eslint-disable no-console */
import autocannon, { type Instance } from 'autocannon';

/**
 * Sprint 14.3 — load smoke. Runs autocannon against `/health` and an authed
 * endpoint to catch regressions in baseline latency / throughput on each
 * deploy. CI runs this against a freshly-booted prod build with seeded data;
 * locally point it at your running dev server.
 *
 * Targets (Section 14):
 *   - p99 < 500ms for /health
 *   - p99 < 1.5s for authed read endpoints
 *   - 0 non-2xx responses for the duration of the run
 *
 * Tune via env:
 *   BASE_URL=https://api.staging.example.com pnpm load:smoke
 *   DURATION=30 CONNECTIONS=50 pnpm load:smoke
 */
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3010';
const DURATION = Number(process.env.DURATION ?? 10);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 20);
const TOKEN = process.env.LOAD_TEST_TOKEN ?? '';

interface Scenario {
  name: string;
  options: autocannon.Options;
  thresholds: { p99Ms: number };
}

const scenarios: Scenario[] = [
  {
    name: 'GET /health',
    options: {
      url: `${BASE_URL}/health`,
      duration: DURATION,
      connections: CONNECTIONS,
      pipelining: 1,
    },
    thresholds: { p99Ms: 500 },
  },
];

if (TOKEN) {
  scenarios.push({
    name: 'GET /api/v1/users/me',
    options: {
      url: `${BASE_URL}/api/v1/users/me`,
      duration: DURATION,
      connections: CONNECTIONS,
      pipelining: 1,
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
    thresholds: { p99Ms: 1500 },
  });
} else {
  console.log('[load] LOAD_TEST_TOKEN not set — skipping authed scenarios.');
}

interface ScenarioResult {
  name: string;
  p99Ms: number;
  p99Threshold: number;
  non2xx: number;
  rps: number;
  passed: boolean;
}

async function runOne(s: Scenario): Promise<ScenarioResult> {
  return new Promise((resolve, reject) => {
    const instance: Instance = autocannon(s.options, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      const p99 = result.latency.p99;
      const non2xx = result.non2xx;
      const passed = p99 <= s.thresholds.p99Ms && non2xx === 0;
      resolve({
        name: s.name,
        p99Ms: p99,
        p99Threshold: s.thresholds.p99Ms,
        non2xx,
        rps: result.requests.average,
        passed,
      });
    });
    // Print progress to stderr so structured stdout stays clean.
    autocannon.track(instance, { renderProgressBar: false });
  });
}

(async () => {
  console.log(`[load] base=${BASE_URL} duration=${DURATION}s connections=${CONNECTIONS}`);
  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    console.log(`[load] running: ${s.name}`);
    results.push(await runOne(s));
  }

  console.log('\n=== Load smoke summary ===');
  for (const r of results) {
    const verdict = r.passed ? 'PASS' : 'FAIL';
    console.log(
      `${verdict} ${r.name}: p99=${r.p99Ms}ms (<=${r.p99Threshold}ms), non2xx=${r.non2xx}, rps=${r.rps.toFixed(1)}`,
    );
  }

  const anyFailed = results.some((r) => !r.passed);
  if (anyFailed) {
    console.error('[load] one or more scenarios failed thresholds');
    process.exit(1);
  }
  console.log('[load] all scenarios within thresholds');
})().catch((err: Error) => {
  console.error('[load] crashed:', err.message);
  process.exit(1);
});
