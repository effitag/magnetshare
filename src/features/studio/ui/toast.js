const listeners = new Set();

export function notify(message) {
  listeners.forEach((listener) => listener(message));
}

export function subscribeNotify(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
