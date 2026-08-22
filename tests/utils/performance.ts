import { expect } from "bun:test";

export const performanceControl = {
  million: (task: (i: number) => void, limitSeconds: number = 1) => {
    const count = 1_000_000;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      task(i);
    }
    const end = performance.now();
    const duration = (end - start) / 1000;
    console.log(`  Processed ${count} records in ${duration.toFixed(3)}s`);
    
    expect(duration).toBeLessThanOrEqual(limitSeconds);
  }
};
