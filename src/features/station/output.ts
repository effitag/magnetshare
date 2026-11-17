/**
 * Where the station's print files go:
 * - "folder": straight into the DNP Hot Folder Print utility's folder, picked
 *   once in Chrome and remembered on this laptop (File System Access API);
 * - "download": Chrome's downloads, for a laptop where Chrome's download
 *   folder is set to the hot folder, or for testing without a printer.
 * The station's name and output are kept in this browser only.
 */

export type StationOutput = "folder" | "download";

export type StationSettings = {
  name: string;
  printer: string;
  output: StationOutput;
};

const SETTINGS_KEY = "magnetimshare-station";
const DB_NAME = "magnetimshare-station";
const STORE = "handles";
const FOLDER_KEY = "hot-folder";

type PermissionState = "granted" | "denied" | "prompt";
type DirectoryHandle = {
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
};
type PickerWindow = Window & { showDirectoryPicker?: (options: { id: string; mode: "readwrite" }) => Promise<DirectoryHandle> };

export function readSettings(): StationSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<StationSettings>;
    return {
      name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "",
      printer: typeof raw.printer === "string" ? raw.printer.slice(0, 40) : "",
      output: raw.output === "download" ? "download" : "folder",
    };
  } catch {
    return { name: "", printer: "", output: "folder" };
  }
}

export function saveSettings(settings: StationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Kept for this visit only.
  }
}

export function folderSupported(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === "function";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Asks the operator to choose the hot folder, and remembers it. */
export async function pickHotFolder(): Promise<DirectoryHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("folder_unsupported");
  const handle = await picker({ id: "dnp-hot-folder", mode: "readwrite" });
  await idb("readwrite", (store) => store.put(handle, FOLDER_KEY));
  return handle;
}

export async function savedHotFolder(): Promise<DirectoryHandle | null> {
  try {
    return ((await idb("readonly", (store) => store.get(FOLDER_KEY))) as DirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

export type HotFolder = DirectoryHandle;

/**
 * Makes sure Chrome still lets the station write to the folder. Call it first
 * thing in a click: Chrome only shows its permission question during one.
 */
export async function ensureFolderPermission(folder: DirectoryHandle): Promise<void> {
  let permission = await folder.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") permission = await folder.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") throw new Error("folder_permission");
}

/** Writes each file into the hot folder (after ensureFolderPermission). */
export async function writeToFolder(folder: DirectoryHandle, files: { name: string; blob: Blob }[]): Promise<void> {
  for (const file of files) {
    const handle = await folder.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.blob);
    await writable.close();
  }
}

export function downloadFiles(files: { name: string; blob: Blob }[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
