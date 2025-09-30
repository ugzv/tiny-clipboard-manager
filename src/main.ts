import { app, BrowserWindow, globalShortcut, clipboard, ipcMain } from 'electron';
import * as path from 'path';
import { ClipboardManager } from './clipboardManager';
import { exec } from 'child_process';
import activeWin from 'active-win';

let mainWindow: BrowserWindow | null = null;
let clipboardManager: ClipboardManager;
let previousWindowTitle: string | undefined;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  // Send initial history when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && clipboardManager) {
      mainWindow.webContents.send('history-updated', clipboardManager.getHistory());
    }
  });

  mainWindow.on('blur', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function toggleWindow() {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Store the currently active window before showing our window
    try {
      const activeWindow = await activeWin();
      previousWindowTitle = activeWindow?.title;
    } catch (error) {
      // Silent fail - will use fallback paste without window focus
    }

    mainWindow.show();
    mainWindow.focus();
  }
}

app.whenReady().then(() => {
  // Initialize clipboard manager first
  clipboardManager = new ClipboardManager();

  createWindow();

  // Register global shortcut (Win+C for Clipboard)
  const registered = globalShortcut.register('Super+C', () => {
    toggleWindow();
    if (mainWindow) {
      mainWindow.webContents.send('history-updated', clipboardManager.getHistory());
    }
  });

  if (!registered) {
    // Try alternative shortcut if primary fails
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      toggleWindow();
      if (mainWindow) {
        mainWindow.webContents.send('history-updated', clipboardManager.getHistory());
      }
    });
  }

  // Start monitoring clipboard
  clipboardManager.startMonitoring((history) => {
    if (mainWindow) {
      mainWindow.webContents.send('history-updated', history);
    }
  });
});

// IPC handlers
ipcMain.on('get-history', (event) => {
  event.reply('history-updated', clipboardManager.getHistory());
});

ipcMain.on('copy-item', (event, text: string) => {
  clipboard.writeText(text);
  if (mainWindow) {
    mainWindow.hide();
  }

  // Wait for window to hide, then focus previous window and paste
  setTimeout(() => {
    // Focus the previous window if we know its title
    if (previousWindowTitle) {
      const focusCmd = `
        Add-Type -AssemblyName System.Windows.Forms;
        $wshell = New-Object -ComObject wscript.shell;
        $wshell.AppActivate('${previousWindowTitle.replace(/'/g, "''")}');
        Start-Sleep -Milliseconds 50;
        [System.Windows.Forms.SendKeys]::SendWait('^v')
      `;
      exec(`powershell -Command "${focusCmd.replace(/\n/g, ' ')}"`);
    } else {
      // Fallback: just send paste command
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait('^v')
      `;
      exec(`powershell -Command "${ps.replace(/\n/g, ';')}"`);
    }
  }, 150);
});

ipcMain.on('delete-item', (event, id: string) => {
  clipboardManager.deleteItem(id);
  event.reply('history-updated', clipboardManager.getHistory());
});

ipcMain.on('clear-history', (event) => {
  clipboardManager.clearHistory();
  event.reply('history-updated', clipboardManager.getHistory());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  clipboardManager.stopMonitoring();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});