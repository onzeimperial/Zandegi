import { defineWorkspace } from "vitest/config";

// Every package that ships tests is discovered here. Pure packages (core,
// economy) are the ones that matter most — see CLAUDE.md §5.
export default defineWorkspace(["packages/*", "apps/*"]);
