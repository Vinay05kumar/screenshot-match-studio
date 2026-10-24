/**
 * ConnectSphere dashboard configuration.
 *
 * Mock mode is the default until the backend is available. Switch to the real
 * API by setting VITE_USE_MOCK_API=false and VITE_API_BASE_URL (see README).
 */
const rawPoll = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 10000);

export const appConfig = {
  /** When true, all dashboard data comes from the in-app mock adapter. */
  useMockApi: import.meta.env.VITE_USE_MOCK_API !== "false",
  /** Contract base URL: https://localhost:8002/api/dashboard */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "https://localhost:8002/api/dashboard",
  /** List-endpoint polling interval while the tab is visible (contract: 10s). */
  pollIntervalMs: Number.isFinite(rawPoll) && rawPoll >= 2000 ? rawPoll : 10000,
} as const;
