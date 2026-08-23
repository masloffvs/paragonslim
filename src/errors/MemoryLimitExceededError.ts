
export class MemoryLimitExceededError extends Error {
  constructor(limit: number) {
    super(
      `Collected more than ${limit} elements in memory without a destination. ` +
        `Use .destination() to stream results instead of returning the full array.`,
    );
    this.name = "MemoryLimitExceededError";
  }
}