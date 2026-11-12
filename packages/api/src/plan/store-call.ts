import { GenerationError, describeFailure, isGenerationError } from "../errors";

/** Run a store call, turning any failure that is not already an API error into `STORE_UNAVAILABLE`. */
export async function storeCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isGenerationError(error)) throw error;
    throw new GenerationError("STORE_UNAVAILABLE", describeFailure(error), { cause: error });
  }
}
