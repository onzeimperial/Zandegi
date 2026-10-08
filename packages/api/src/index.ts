/**
 * @zandegi/api — the server surface.
 *
 * Adapters (the Next.js route, later a mobile handler or a job) import this
 * root and call a use case. Clients import `@zandegi/api/client`, which
 * carries the contract and nothing else.
 *
 * No tRPC procedure is defined for generation: it is a long streamed response
 * rather than a request/response procedure, and AD-2 asks that apps call API
 * use cases, not that every call crosses a tRPC transport. `@trpc/server` and
 * `inngest` stay unused dependencies until there are ordinary procedures and
 * scheduled work to serve.
 */

export * from "./client";
export * from "./ports";
export { GenerationError, isGenerationError, redactDiagnostic, describeFailure } from "./errors";
export { parseGenerateMissionRequest } from "./generation/request";
export {
  toMissionChapter,
  toMissionDraft,
  toMissionStep,
  toProgress,
  WIRE_ENUM_PARITY,
} from "./generation/mapping";
export {
  generateMission,
  type GenerateMissionInput,
  type GenerateMissionPorts,
  type MissionDraftGenerator,
} from "./generation/generate-mission";
export {
  readMission,
  MAX_MISSION_ID_LENGTH,
  type ReadMissionInput,
  type ReadMissionPorts,
} from "./missions/read-mission";
export {
  listMissions,
  type ListMissionsInput,
  type ListMissionsPorts,
} from "./missions/list-missions";
export * from "./identity";
export {
  createDemoStore,
  demoPortsFromEnv,
  demoPortsFromStore,
  demoStoreConfigFromEnv,
  guestCookiePolicyFromEnv,
  guestRetentionSecondsFromEnv,
  resetDemoPortsCache,
  type DemoPorts,
  type DemoStoreConfig,
  type DemoStoreDriver,
  type Env,
} from "./demo-store";
