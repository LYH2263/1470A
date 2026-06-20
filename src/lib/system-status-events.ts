type Listener = () => void;

class SystemStatusEventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('SystemStatus event bus listener error:', error);
      }
    });
  }
}

export const systemStatusEvents = new SystemStatusEventBus();

export function emitSystemStatusChange(): void {
  systemStatusEvents.emit();
}
