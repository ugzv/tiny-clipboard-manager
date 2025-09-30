import { clipboard } from 'electron';
import Store from 'electron-store';

export interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

export class ClipboardManager {
  private store: Store;
  private history: ClipboardItem[] = [];
  private lastClipboard: string = '';
  private monitoringInterval: NodeJS.Timeout | null = null;
  private callback: ((history: ClipboardItem[]) => void) | null = null;
  private readonly MAX_ITEMS = 50;

  constructor() {
    this.store = new Store({
      name: 'clipboard-history'
    });
    this.loadHistory();
  }

  private loadHistory() {
    const savedHistory = this.store.get('history', []) as ClipboardItem[];
    this.history = savedHistory;
    this.lastClipboard = clipboard.readText();
  }

  private saveHistory() {
    this.store.set('history', this.history);
  }

  startMonitoring(callback: (history: ClipboardItem[]) => void) {
    this.callback = callback;

    this.monitoringInterval = setInterval(() => {
      const currentText = clipboard.readText();

      if (currentText && currentText !== this.lastClipboard) {
        this.lastClipboard = currentText;

        // Check if item already exists
        const existingIndex = this.history.findIndex(item => item.text === currentText);

        if (existingIndex !== -1) {
          // Move existing item to top
          const [item] = this.history.splice(existingIndex, 1);
          item.timestamp = Date.now();
          this.history.unshift(item);
        } else {
          // Add new item
          const newItem: ClipboardItem = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: currentText,
            timestamp: Date.now()
          };

          this.history.unshift(newItem);

          // Limit history size
          if (this.history.length > this.MAX_ITEMS) {
            this.history = this.history.slice(0, this.MAX_ITEMS);
          }
        }

        this.saveHistory();

        if (this.callback) {
          this.callback(this.history);
        }
      }
    }, 500); // Check every 500ms
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  getHistory(): ClipboardItem[] {
    return this.history;
  }

  deleteItem(id: string) {
    this.history = this.history.filter(item => item.id !== id);
    this.saveHistory();
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
  }
}