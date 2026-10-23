const base = (process.env.SMOKE_BASE_URL || "https://trip.bossxie.win").replace(/\/$/, "");
const checks = [
  { path: "/", statuses: [302, 307] },
  { path: "/unlock", statuses: [200] },
  { path: "/manifest.webmanifest", statuses: [200] },
  { path: "/robots.txt", statuses: [200] },
];

async function check({ path, statuses }) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      if (!statuses.includes(response.status)) throw new Error(`expected ${statuses.join("/")}, received ${response.status}`);
      console.log(`${path} ${response.status} ${Date.now() - started}ms`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new Error(`${path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

for (const item of checks) await check(item);
