export type AppEventType = "new_swap" | "sync_progress" | "status_change";

export interface SwapLogPayload {
  pairAddress: string;
  transactionHash: string;
  blockNumber: string;
  logIndex: number;
  direction: "buy" | "sell" | "unknown";
  amount0: string;
  amount1: string;
  effectivePrice?: number;
  timestamp: number;
  additionalData?: Record<string, unknown>;
}

export interface AppEventMap {
  new_swap: SwapLogPayload;
  sync_progress: {
    pairAddress: string;
    stage: string;
    percent: number;
    message: string;
  };
  status_change: {
    pairAddress: string;
    status: string;
  };
}

type EventCallback<T> = (data: T) => void;

class SyncEventEmitter {
  private listeners = new Map<string, Set<EventCallback<any>>>();

  on<K extends AppEventType>(event: K, listener: EventCallback<AppEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unbind function
    return () => {
      this.off(event, listener);
    };
  }

  off<K extends AppEventType>(event: K, listener: EventCallback<AppEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  emit<K extends AppEventType>(event: K, data: AppEventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        try {
          listener(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export const syncEvents = new SyncEventEmitter();
