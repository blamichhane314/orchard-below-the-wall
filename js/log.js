// log.js — Law 7: everything is logged, and the log is the research output.
//
// Designed as an append-only event stream from the start rather than bolted on:
// every record is flat, self-describing, and timestamped, so a session can be
// replayed and a competence trajectory reconstructed afterwards without the
// player model having had to guess anything at the time.

const KEY = 'lw.spike.eventlog';

export class EventLog {
  constructor() {
    this.session = 's' + Math.random().toString(36).slice(2, 10);
    this.t0 = performance.now();
    this.seq = 0;
    this.events = [];
    this.listeners = [];
  }

  /**
   * @param {string} type  dotted, coarse-to-fine: 'instrument.selected', 'hint.taken'
   * @param {object} data  anything JSON-serialisable; keep keys stable across events
   */
  push(type, data = {}) {
    const e = {
      seq: ++this.seq,
      session: this.session,
      t: +(performance.now() - this.t0).toFixed(1),   // ms since session start
      iso: new Date().toISOString(),
      type,
      ...data,
    };
    this.events.push(e);
    for (const fn of this.listeners) fn(e);
    try { localStorage.setItem(KEY, JSON.stringify(this.events.slice(-2000))); } catch {}
    return e;
  }

  onEvent(fn) { this.listeners.push(fn); }

  /** JSON Lines — one event per line, the form the analysis actually wants. */
  toJSONL() { return this.events.map((e) => JSON.stringify(e)).join('\n'); }

  download() {
    const blob = new Blob([this.toJSONL()], { type: 'application/x-ndjson' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `learning-world-${this.session}.jsonl`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
