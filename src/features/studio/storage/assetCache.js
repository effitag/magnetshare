// Decoded images for one open template, keyed by their path inside the template ("assets/leaf.svg").

async function decode(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // A decoded image keeps its data; the URL is no longer needed.
    URL.revokeObjectURL(url);
  }
}

/** @param readBlob  async (path) => Blob */
export function createAssetCache(readBlob) {
  const images = new Map(); // path → HTMLImageElement, or null when the file is missing/broken
  const inflight = new Map();

  async function load(path) {
    try {
      images.set(path, await decode(await readBlob(path)));
    } catch (err) {
      console.error(`[assets] could not load "${path}":`, err.message);
      images.set(path, null);
    }
  }

  return {
    has: (path) => images.has(path),
    get: (path) => images.get(path) ?? null,
    /** Load every path not tried yet. Never rejects; failures are cached as null. */
    ensure(paths) {
      const pending = paths
        .filter((p) => !images.has(p))
        .map((p) => {
          if (!inflight.has(p)) inflight.set(p, load(p).finally(() => inflight.delete(p)));
          return inflight.get(p);
        });
      return Promise.all(pending);
    },
    /** Register a file the user just added, without downloading it again. */
    async put(path, blob) {
      const img = await decode(blob);
      images.set(path, img);
      return img;
    },
    /** Forget failed loads so they are tried again (e.g. after the connection came back). */
    retryFailed() {
      for (const [path, img] of images) if (img === null) images.delete(path);
    },
  };
}
