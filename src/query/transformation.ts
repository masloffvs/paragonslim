import { Transformer } from "./transformers/transformer";

type TransformFn = (row: any) => any;

const EMPTY_BODY_REGEX = /^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*\}\s*$/;
const IDENTITY_ARROW_REGEX = /^\s*\(\s*\w+\s*\)\s*=>\s*\w+\s*$/;
const IDENTITY_RETURN_REGEX =
  /^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*return\s+\w+\s*;?\s*\}\s*$/;

export class Transformation extends Transformer {
  private transformFn: TransformFn | null = null;
  private shouldTransform: boolean = false;

  constructor(transformFn?: TransformFn | null) {
    super();

    if (transformFn && this.isTransformFunctionMeaningful(transformFn)) {
      this.transformFn = transformFn;
      this.shouldTransform = true;
    }
  }

  private isTransformFunctionMeaningful(fn: TransformFn): boolean {
    const fnString = fn.toString();

    const isEmptyBody = EMPTY_BODY_REGEX.test(fnString);
    const isIdentityArrow = IDENTITY_ARROW_REGEX.test(fnString);
    const isIdentityReturn = IDENTITY_RETURN_REGEX.test(fnString);

    return !isEmptyBody && !isIdentityArrow && !isIdentityReturn;
  }

  public transform(row: any): any {
    if (!this.shouldTransform || !this.transformFn) {
      return row;
    }

    const result = this.transformFn(row);
    return result ?? row;
  }
}
