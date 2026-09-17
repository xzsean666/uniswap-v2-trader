/**
 * In-memory Storage Adapter for EvmCallClient in Web/Browser & Unit Testing environments
 */

export interface StorageStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export class MemoryStorageAdapter {
  private open = false;
  private memoryCache = new Map<string, unknown>();
  private cooldowns = new Map<string, { endpointId: string; until: number; tier: number }>();

  async initialize(): Promise<void> {
    this.open = true;
  }

  ready(): void {
    this.open = true;
  }

  isOpen(): boolean {
    return this.open;
  }

  getPath(): string {
    return ":memory:";
  }

  exec(_sql: string): void {
    // schema creation or pragma
    this.open = true;
  }

  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number } {
    const s = sql.toLowerCase();
    if (s.includes("endpoint_cooldowns") || s.includes("cooldown")) {
      const endpointId = String(params[0] ?? "");
      const until = Number(params[1] ?? 0);
      const tier = Number(params[2] ?? 0);
      this.cooldowns.set(endpointId, { endpointId, until, tier });
      return { changes: 1, lastInsertRowid: 1 };
    }
    return { changes: 0, lastInsertRowid: 0 };
  }

  get(sql: string, ...params: unknown[]): unknown {
    const s = sql.toLowerCase();
    if (s.includes("endpoint_cooldowns") || s.includes("cooldown")) {
      const endpointId = String(params[0] ?? "");
      const found = this.cooldowns.get(endpointId);
      if (found) {
        return {
          endpoint_id: found.endpointId,
          cooldown_until: found.until,
          tier: found.tier,
        };
      }
      return undefined;
    }
    const key = `${sql}_${JSON.stringify(params)}`;
    return this.memoryCache.get(key);
  }

  all(sql: string, ..._params: unknown[]): unknown[] {
    const s = sql.toLowerCase();
    if (s.includes("endpoint_cooldowns") || s.includes("cooldown")) {
      return Array.from(this.cooldowns.values()).map((c) => ({
        endpoint_id: c.endpointId,
        cooldown_until: c.until,
        tier: c.tier,
      }));
    }
    return [];
  }

  getStatement(sql: string): StorageStatement {
    return {
      run: (...params: unknown[]) => this.run(sql, ...params),
      get: (...params: unknown[]) => this.get(sql, ...params),
      all: (...params: unknown[]) => this.all(sql, ...params),
    };
  }

  transaction<T>(fn: () => T): T {
    return fn();
  }

  close(): void {
    this.open = false;
    this.memoryCache.clear();
    this.cooldowns.clear();
  }
}
