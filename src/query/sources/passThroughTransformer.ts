import { Source } from "./source";

export class PassThroughTransformer extends Source {
  constructor() {
    super("");
  }

  public override async execute<T, R extends any[]>(
    prevResults: R,
  ): Promise<T | null | undefined> {
    return prevResults as unknown as T;
  }
}

export class PassThroughTransformerSource extends PassThroughTransformer {}
