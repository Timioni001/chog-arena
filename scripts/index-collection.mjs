#!/usr/bin/env node
/**
 * Indexes the Chog Genesis collection straight from the chain + IPFS metadata and writes
 * src/data/collection.json (trait table, counts, rarity scores and ranks).
 *
 *   node scripts/index-collection.mjs            # uses .cache/chog-metadata.json if present
 *   node scripts/index-collection.mjs --refresh  # re-reads tokenURI + metadata for every token
 *
 * Nothing is hardcoded: supply comes from totalSupply(), traits from each token's metadata.
 */
import fs from 'node:fs';
import path from 'node:path';

const RPC = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';
const NFT = process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS || '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763';
const GATEWAYS = (process.env.IPFS_GATEWAYS || 'https://ipfs.filebase.io/ipfs/,https://gateway.pinata.cloud/ipfs/').split(',');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'src/data/collection.json');
const refresh = process.argv.includes('--refresh');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tfetch = (u, o = {}) => fetch(u, { ...o, signal: AbortSignal.timeout(20000) });
const word = (n) => n.toString(16).padStart(64, '0');
const decodeString = (hex) => {
  const b = Buffer.from(hex.slice(2), 'hex');
  const len = Number(BigInt('0x' + b.subarray(32, 64).toString('hex')));
  return b.subarray(64, 64 + len).toString();
};

async function rpc(body) {
  for (let a = 0; a < 8; a++) {
    try {
      const r = await (await tfetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
      if (Array.isArray(body) && (!Array.isArray(r) || r.some((x) => !x.result))) throw new Error('batch error');
      if (!Array.isArray(body) && !r.result) throw new Error(JSON.stringify(r.error));
      return r;
    } catch (e) {
      await sleep(1500 * (a + 1));
    }
  }
  throw new Error('rpc failed');
}

const call = (data, id = 1) => ({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to: NFT, data }, 'latest'] });

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const name = decodeString((await rpc(call('0x06fdde03'))).result);
  const symbol = decodeString((await rpc(call('0x95d89b41'))).result);
  const supply = Number(BigInt((await rpc(call('0x18160ddd'))).result));
  console.log(`${name} (${symbol}) supply ${supply}`);

  const uriFile = path.join(CACHE, 'uris.json');
  const metaFile = path.join(CACHE, 'chog-metadata.json');
  let uris = !refresh && fs.existsSync(uriFile) ? JSON.parse(fs.readFileSync(uriFile, 'utf8')) : {};
  for (let s = 1; s <= supply; s += 20) {
    const ids = [];
    for (let i = s; i < Math.min(s + 20, supply + 1); i++) if (!uris[i]) ids.push(i);
    if (!ids.length) continue;
    const r = await rpc(ids.map((i) => call('0xc87b56dd' + word(i), i)));
    for (const x of r) uris[x.id] = decodeString(x.result);
    fs.writeFileSync(uriFile, JSON.stringify(uris));
  }

  let meta = !refresh && fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const todo = Object.keys(uris).map(Number).filter((i) => !meta[i]);
  let k = 0;
  await Promise.all(
    Array.from({ length: 16 }, async (_, w) => {
      while (k < todo.length) {
        const id = todo[k++];
        for (let a = 0; a < 8; a++) {
          const u = uris[id].replace('ipfs://', GATEWAYS[(a + w) % GATEWAYS.length]);
          try {
            const j = await (await tfetch(u)).json();
            meta[id] = { file: uris[id].split('/').pop(), name: j.name, image: j.image, attributes: j.attributes };
            break;
          } catch {
            await sleep(500 * (a + 1));
          }
        }
      }
    }),
  );
  fs.writeFileSync(metaFile, JSON.stringify(meta));
  const missing = Array.from({ length: supply }, (_, i) => i + 1).filter((i) => !meta[i]);
  if (missing.length) throw new Error(`metadata missing for ${missing.length} tokens: ${missing.slice(0, 10)}`);

  // ---------------------------------------------------------------- counts
  const counts = {};
  for (const t of Object.values(meta)) for (const a of t.attributes) {
    counts[a.trait_type] ??= {};
    counts[a.trait_type][a.value] = (counts[a.trait_type][a.value] || 0) + 1;
  }
  const typeOrder = ['Form', 'Base', 'Tier', 'Skin', 'Background', 'Aura', 'Head', 'Eyes', 'Mouth', 'Body', 'Accessory', 'Side', 'Naked'];
  const types = [...typeOrder.filter((t) => counts[t]), ...Object.keys(counts).filter((t) => !typeOrder.includes(t))];
  const values = {}, valueCounts = {};
  for (const t of types) {
    const entries = Object.entries(counts[t]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const withNone = entries.reduce((s, e) => s + e[1], 0);
    values[t] = entries.map((e) => e[0]);
    valueCounts[t] = entries.map((e) => e[1]);
    if (withNone < supply) { values[t].push('None'); valueCounts[t].push(supply - withNone); }
  }

  // ---------------------------------------------------------------- tokens + rarity
  const scoreTypes = types.filter((t) => t !== 'Tier');
  const tokens = [], scores = [];
  for (let id = 1; id <= supply; id++) {
    const attrs = Object.fromEntries(meta[id].attributes.map((a) => [a.trait_type, a.value]));
    const row = types.map((t) => values[t].indexOf(attrs[t] ?? 'None'));
    tokens.push(row);
    let score = 0;
    for (const t of scoreTypes) {
      const ti = types.indexOf(t);
      score += -Math.log(valueCounts[t][row[ti]] / supply);
    }
    scores.push(Math.round(score * 1000) / 1000);
  }
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const ranks = new Array(supply);
  order.forEach(([, i], r) => (ranks[i] = r + 1));

  const out = {
    chainId: 143,
    contract: NFT,
    name,
    symbol,
    supply,
    firstTokenId: 1,
    metadataBase: uris[1].slice(0, uris[1].lastIndexOf('/')),
    imageBase: meta[1].image.slice(0, meta[1].image.lastIndexOf('/')),
    indexedAt: new Date().toISOString(),
    types,
    values,
    counts: valueCounts,
    tokens,
    scores,
    ranks,
    /** Display number from the metadata name ("CHOG #1522") — differs from the token id after the reveal shuffle. */
    numbers: Array.from({ length: supply }, (_, i) => Number((meta[i + 1].name.match(/#(\d+)/) || [0, 0])[1])),
    /** Named 1:1s: "CHOG #53 — Blaze" → { "561": "Blaze" } keyed by token id. */
    titles: Object.fromEntries(
      Object.entries(meta)
        .filter(([, t]) => t.name.includes('—'))
        .map(([id, t]) => [id, t.name.split('—')[1].trim()]),
    ),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
