import { appConfig } from "@/lib/config";
import type { DashboardApi } from "./adapter";
import { HttpDashboardApi } from "./http/adapter";
import { MockDashboardApi } from "./mock/adapter";

/**
 * Single adapter instance for the whole app. Mock mode is the default until
 * the backend is reachable; flip VITE_USE_MOCK_API=false to go live.
 */
export const api: DashboardApi = appConfig.useMockApi ? new MockDashboardApi() : new HttpDashboardApi(appConfig.apiBaseUrl);

export { ApiError } from "./adapter";
export * from "./types";
