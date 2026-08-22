import { Transformer } from "./transformers/transformer";

export class Transformation extends Transformer {
  private transformFn: ((row: any) => any) | null = null;
  private shouldTransform: boolean = false;

  constructor(transformFn?: ((row: any) => any) | null) {
    super();

    if (transformFn) {
      this.transformFn = transformFn;
      this.shouldTransform = this.isTransformFunctionMeaningful(transformFn);
    }
  }

  private isTransformFunctionMeaningful(fn: (row: any) => any): boolean {
    const fnString = fn.toString();

    const emptyBody = /^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*\}\s*$/.test(fnString);
    const identityArrow = /^\s*\(\s*\w+\s*\)\s*=>\s*\w+\s*$/.test(fnString);
    const identityReturn =
      /^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*return\s+\w+\s*;?\s*\}\s*$/.test(fnString);

    return !emptyBody && !identityArrow && !identityReturn;
  }

  public transform(row: any): any {
    if (!this.shouldTransform || !this.transformFn) {
      return row;
    }

    const result = this.transformFn!(row);
    return result === undefined ? row : result;
  }
}
