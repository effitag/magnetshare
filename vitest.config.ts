import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/features/studio/__tests__/*.test.js", "src/features/admin/events/*.test.ts", "src/lib/cropToWindow.test.ts", "src/lib/magnets.test.ts", "src/lib/guestSend.test.ts", "src/lib/eventTypes.test.ts"],
  },
});
