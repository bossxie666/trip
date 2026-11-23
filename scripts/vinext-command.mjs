import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const selfHosted = args.includes("--self-hosted");
const vinextArgs = args.filter((value) => value !== "--self-hosted");
if (vinextArgs[0] === "build") {
  const output = resolve(root, "dist");
  if (!output.startsWith(`${root}\\`) && !output.startsWith(`${root}/`)) throw new Error("Refusing to clean outside the project root.");
  rmSync(output, { recursive: true, force: true });
}
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
if (result.status === 0 && vinextArgs[0] === "build") {
  // vinext beta.2 injects this sidecar import relative to the output root.
  // A lazy app-router entry lives in _next/static instead, so relocate only
  // that generated import; the rendered-page suite verifies it is loadable.
  const server = resolve(root, "dist/server");
  const sidecar = join(server, "vinext-client-assets.js");
  if (existsSync(sidecar)) {
    const pending = [server];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) { pending.push(file); continue; }
        if (!entry.name.endsWith(".js") || existsSync(join(dirname(file), "vinext-client-assets.js"))) continue;
        const source = readFileSync(file, "utf8");
        const target = relative(dirname(file), sidecar).split(sep).join("/");
        const updated = source.replace(/((?:import|from)\s*["'])\.\/vinext-client-assets\.js(["'])/g, `$1${target}$2`);
        if (updated !== source) writeFileSync(file, updated);
      }
    }
  }
}
process.exit(result.status ?? 1);
