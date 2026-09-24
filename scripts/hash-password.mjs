// scripts/hash-password.mjs
//
// Generates a (salt, password_hash) pair using the EXACT same algorithm
// as functions/api/_utils.ts (PBKDF2-SHA256, 100000 iterations, 256-bit
// output), so you can create client login rows by hand.
//
// Usage:
//   node scripts/hash-password.mjs "the-clients-password"
//
// Then insert the row it prints, e.g.:
//   wrangler d1 execute layered_insights_portal --remote --command \
//     "INSERT INTO clients (id, password_hash, salt, client_id, client_name) VALUES ('blueridge', '<hash>', '<salt>', '{THEIR-CLIENTID-GUID}', 'Blue Ridge Retail Partners')"

import { webcrypto } from "node:crypto";
const crypto = webcrypto;

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const { hash, salt } = await hashPassword(password);
console.log("password_hash:", hash);
console.log("salt:         ", salt);
