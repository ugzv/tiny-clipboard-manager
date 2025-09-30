import { ipcRenderer } from 'electron';

interface ClipboardItem {
  id: string;
  text: string;
  timestamp: number;
}

let allHistory: ClipboardItem[] = [];
let filteredHistory: ClipboardItem[] = [];
let selectedIndex = 0;

const historyListEl = document.getElementById('history-list') as HTMLDivElement;
const searchInputEl = document.getElementById('search-input') as HTMLInputElement;
const clearBtnEl = document.getElementById('clear-btn') as HTMLButtonElement;

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function renderHistory(items: ClipboardItem[]) {
  if (items.length === 0) {
    historyListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">
          ${allHistory.length === 0
            ? 'No clipboard history yet<br>Copy some text to get started'
            : 'No results found<br>Try a different search term'
          }
        </div>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = items.map((item, index) => `
    <div class="history-item ${index === selectedIndex ? 'selected' : ''}" data-id="${item.id}" data-index="${index}">
      <div class="history-item-content">
        <div class="history-item-text">${escapeHtml(item.text)}</div>
        <div class="history-item-time">${formatTime(item.timestamp)}</div>
      </div>
      <button class="history-item-delete" data-id="${item.id}" title="Delete">×</button>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.history-item').forEach(el => {
    const itemEl = el as HTMLElement;
    const deleteBtn = itemEl.querySelector('.history-item-delete');

    itemEl.addEventListener('click', (e) => {
      if (e.target === deleteBtn) return;
      const id = itemEl.getAttribute('data-id');
      const item = items.find(i => i.id === id);
      if (item) {
        ipcRenderer.send('copy-item', item.text);
      }
    });

    deleteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      if (id) {
        ipcRenderer.send('delete-item', id);
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function filterHistory(searchTerm: string) {
  if (!searchTerm.trim()) {
    filteredHistory = allHistory;
  } else {
    const term = searchTerm.toLowerCase();
    filteredHistory = allHistory.filter(item =>
      item.text.toLowerCase().includes(term)
    );
  }
  selectedIndex = 0; // Reset selection when filtering
  renderHistory(filteredHistory);
}

function pasteSelectedItem() {
  if (filteredHistory.length > 0 && selectedIndex >= 0 && selectedIndex < filteredHistory.length) {
    const item = filteredHistory[selectedIndex];
    ipcRenderer.send('copy-item', item.text);
  }
}

// Event listeners
searchInputEl.addEventListener('input', (e) => {
  filterHistory((e.target as HTMLInputElement).value);
});

clearBtnEl.addEventListener('click', () => {
  if (confirm('Clear all clipboard history?')) {
    ipcRenderer.send('clear-history');
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (filteredHistory.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filteredHistory.length - 1);
    renderHistory(filteredHistory);
    scrollToSelected();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    renderHistory(filteredHistory);
    scrollToSelected();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    pasteSelectedItem();
  } else if (e.key === 'Home') {
    e.preventDefault();
    selectedIndex = 0;
    renderHistory(filteredHistory);
    scrollToSelected();
    pasteSelectedItem();
  }
});

function scrollToSelected() {
  const selectedEl = document.querySelector('.history-item.selected') as HTMLElement;
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// IPC listeners
ipcRenderer.on('history-updated', (event, history: ClipboardItem[]) => {
  allHistory = history;
  filterHistory(searchInputEl.value);
});

// Load initial history
ipcRenderer.send('get-history');