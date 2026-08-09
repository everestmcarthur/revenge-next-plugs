// Post-deploy smoke test: confirms the live repository index is valid and that
// one published plugin's artifact actually matches the sha256 the index claims for it.
// Run with: bun .github/scripts/verify-deploy.mjs

const BASE_URL = process.env.VERIFY_BASE_URL ?? "https://next.jarviscli.dev";

// Cloudflare's edge can take a few seconds to propagate a fresh deploy - the very first run of
// this script (2026-08-09, staff-tags 1.0.5) failed with a raw "Failed to parse JSON" error from
// a non-OK response fetched immediately after `wrangler deploy` returned, even though the deploy
// itself had succeeded (confirmed live seconds later). Retrying with a short backoff instead of
// failing on the first transient response avoids that false negative, and checking `res.ok`
// turns any real failure into a clear status-code message instead of an opaque parse error.
async function fetchWithRetry(url, { attempts = 5, delayMs = 3000, binary = false } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`${url} responded ${res.status} ${res.statusText}`);
            }
            return binary ? await res.arrayBuffer() : await res.json();
        } catch (e) {
            lastError = e;
            if (attempt < attempts) {
                console.log(`Attempt ${attempt}/${attempts} for ${url} failed (${e.message}), retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    throw new Error(`${url} failed after ${attempts} attempts: ${lastError.message}`);
}

const idx = await fetchWithRetry(`${BASE_URL}/index.json`);
const ids = Object.keys(idx.plugins ?? {});
if (!ids.length) throw new Error("index.json has no plugins");

const [id, plugin] = Object.entries(idx.plugins)[0];
const version = plugin.channels.latest;
const v = plugin.versions[version];

const buf = await fetchWithRetry(v.url, { binary: true });
const hash = Buffer.from(await crypto.subtle.digest("SHA-256", buf)).toString("hex");

if (hash !== v.sha256) {
    throw new Error(`sha256 mismatch for ${id}: expected ${v.sha256} got ${hash}`);
}

console.log(`Verified ${id}@${version}: sha256 OK`);
