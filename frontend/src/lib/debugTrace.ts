/**
 * @file debugTrace.ts
 * @summary In-memory circular debug trace buffer and console logger for issuance and verification lifecycle.
 */

export interface TraceEntry {
  timestamp: string;
  stage: string;
  data: Record<string, unknown>;
}

class DebugTracer {
  private entries: TraceEntry[] = [];
  private maxEntries = 200;

  public trace(stage: string, data: Record<string, unknown>): void {
    const entry: TraceEntry = {
      timestamp: new Date().toISOString(),
      stage,
      data: this.sanitizeData(data),
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    if (typeof window !== 'undefined' && (import.meta.env?.DEV || window.location.search.includes('debug=1'))) {
      try {
        console.group(`[CERTI-TRACE] ${stage} @ ${entry.timestamp.split('T')[1]}`);
        console.log(data);
        console.groupEnd();
      } catch {
        console.log(`[CERTI-TRACE] ${stage}:`, data);
      }
    }
  }

  public getEntries(): TraceEntry[] {
    return [...this.entries];
  }

  public clear(): void {
    this.entries = [];
  }

  public exportJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  private sanitizeData(obj: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes('jwt') || k.toLowerCase().includes('apikey') || k.toLowerCase().includes('secret')) {
        clean[k] = '[REDACTED_SECRET]';
      } else if (typeof v === 'string' && v.startsWith('data:image/')) {
        clean[k] = `[DATA_URL length=${v.length} mime=${v.substring(5, v.indexOf(';'))}]`;
      } else if (typeof v === 'string' && v.length > 200 && !v.startsWith('0x')) {
        clean[k] = `${v.slice(0, 80)}... (total length: ${v.length})`;
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        clean[k] = this.sanitizeData(v as Record<string, unknown>);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }
}

export const tracer = new DebugTracer();
if (typeof window !== 'undefined') {
  (window as any).__CERTI_TRACER__ = tracer;
}
export const trace = (stage: string, data: Record<string, unknown>) => tracer.trace(stage, data);
