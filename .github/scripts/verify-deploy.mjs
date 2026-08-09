// Post-deploy smoke test: confirms the live repository index is valid and that
// one published plugin's artifact actually matches the sha256 the index claims for it.
// Run with: bun .github/scripts/verify-deploy.mjs

const BASE_URL = process.env.VERIFY_BASE_URL ?? "https://next.jarviscli.dev";

const idx = await (await fetch(`${BASE_URL}/index.json`)).json();
const ids = Object.keys(idx.plugins ?? {});
if (!ids.length) throw new Error("index.json has no plugins");

const [id, plugin] = Object.entries(idx.plugins)[0];
const version = plugin.channels.latest;
const v = plugin.versions[version];

const buf = await (await fetch(v.url)).arrayBuffer();
const hash = Buffer.from(await crypto.subtle.digest("SHA-256", buf)).toString("hex");

if (hash !== v.sha256) {
    throw new Error(`sha256 mismatch for ${id}: expected ${v.sha256} got ${hash}`);
}

console.log(`Verified ${id}@${version}: sha256 OK`);
