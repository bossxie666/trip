import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const selfHosted = args.includes("--self-hosted");
const vinextArgs = args.filter((value) => value !== "--self-hosted");
const result = spawnSync(process.execPath, [resolve(root, "node_modules/vinext/dist/cli.js"), ...vinextArgs], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log",
    ...(selfHosted ? { TRIP_SELF_HOSTED_BUILD: "1" } : {}),
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
