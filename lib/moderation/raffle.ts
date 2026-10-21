import { createHash } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/**
 * Independent re-implementation of public.admin_run_raffle, so anyone with
 * the published eligible list and the public seed can verify a draw:
 *   list_hash = sha256(sorted codes joined by ",")
 *   round i   = sha256(`${seed}:${list_hash}:${i}`), first 15 hex digits
 *   index     = value mod remaining, picked without replacement.
 */
export function drawRaffle(seed: string, codes: readonly string[], winners: number) {
  const remaining = [...codes].sort();
  const listHash = sha256(remaining.join(","));
  const picks: string[] = [];

  for (let round = 1; round <= winners && remaining.length > 0; round += 1) {
    const digest = sha256(`${seed.trim()}:${listHash}:${round}`);
    const index = Number(BigInt(`0x${digest.slice(0, 15)}`) % BigInt(remaining.length));
    picks.push(...remaining.splice(index, 1));
  }

  return { listHash, winners: picks };
}
