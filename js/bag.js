// bag.js — the memory of record (design/MEMORY_CARVING_DESIGN.md §1).
// Every carving the player earns is written here: one flat list in
// localStorage under 'lw.bag', shared by every world on the origin.
//
// DECAY v0 — PLACEHOLDER. strength = exp(-(now - lastSeen) / 8 minutes),
// floored at 0.12 and capped at 1. That is a SESSION-SCALE stand-in chosen so
// the mechanism can be seen working inside one sitting; it is not the decay
// model. v1 (design work, not built) gives each skill its own tau from
// difficulty, prior knowledge, performance and review history, and replaces
// read-to-restore with the refresher protocol (ask first, then a small
// exercise). Decay degrades assistance and nothing else: nothing in this file
// is ever a gate.
//
// The API below is frozen: list, get, earn, review, strength. Anything else
// here is private plumbing (underscored).

const KEY = 'lw.bag';
const TAU = 8 * 60 * 1000;   // ms — v0 session scale
const FLOOR = 0.12;

/** localStorage is absent under file:// hardening and in private windows, and
 *  throws on quota. Every touch goes through here and every touch is guarded. */
const _store = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (e) {
    return null;
  }
};

export class Bag {
  constructor() {
    this.entries = this._read();
  }

  // ---------- storage ----------
  _read() {
    try {
      const s = _store();
      if (!s) return [];
      const raw = s.getItem(KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      // tolerant: keep only entries that can answer the API
      return v.filter((e) => e && typeof e.id === 'string');
    } catch (e) {
      return [];   // corruption is not fatal; an empty bag is a valid bag
    }
  }

  _write() {
    try {
      const s = _store();
      if (s) s.setItem(KEY, JSON.stringify(this.entries));
    } catch (e) { /* full, blocked, or absent: the session still runs */ }
  }

  // ---------- frozen API ----------
  /** every entry, newest last; a copy, so callers cannot reorder the record */
  list() {
    return this.entries.slice();
  }

  get(id) {
    for (const e of this.entries) if (e.id === id) return e;
    return null;
  }

  /** idempotent. First time: the entry is created. After that: only lastSeen
   *  moves, so re-earning the same carving refreshes it without a second copy. */
  earn({ id, world, tex, note }) {
    if (typeof id !== 'string' || !id) return null;
    const now = Date.now();
    const found = this.get(id);
    if (found) {
      found.lastSeen = now;
      this._write();
      return found;
    }
    const entry = { id, world, tex, note, earnedAt: now, lastSeen: now, reviews: 0 };
    this.entries.push(entry);
    this._write();
    return entry;
  }

  /** reading a carving IS the review: strength restored, count incremented */
  review(id) {
    const entry = this.get(id);
    if (!entry) return null;
    entry.lastSeen = Date.now();
    entry.reviews = (entry.reviews | 0) + 1;
    this._write();
    return entry;
  }

  /** in [FLOOR, 1]; a missing or malformed entry reads as fully clouded */
  strength(entry, now = Date.now()) {
    if (!entry || !Number.isFinite(entry.lastSeen)) return FLOOR;
    const age = Math.max(0, now - entry.lastSeen);
    return Math.min(1, Math.max(FLOOR, Math.exp(-age / TAU)));
  }
}

export const bag = new Bag();
