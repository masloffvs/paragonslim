export default class LimitedSet<T> {
  private _set: Set<T>;
  private _limit: number;

  constructor(limit: number) {
    this._set = new Set<T>();
    this._limit = limit;
  }

  add(item: T): void {
    if (!this._set.has(item) && this._set.size >= this._limit) {
      throw new Error(`LimitedSet can only hold ${this._limit} items.`);
    }
    this._set.add(item);
  }

  addEvictingFirst(item: T): void {
    if (this._set.has(item)) {
      this._set.delete(item);
      this._set.add(item);
      return;
    }

    if (this._set.size >= this._limit) {
      const oldest = this._set.values().next().value as T;
      this._set.delete(oldest);
    }

    this._set.add(item);
  }

  addEvictingLast(item: T): void {
    const items = Array.from(this._set);

    const existingIndex = items.indexOf(item);
    if (existingIndex !== -1) {
      items.splice(existingIndex, 1);
    } else if (items.length >= this._limit) {
      items.pop();
    }

    this._set = new Set<T>([item, ...items]);
  }

  has(item: T): boolean {
    return this._set.has(item);
  }

  delete(item: T): boolean {
    return this._set.delete(item);
  }

  clear(): void {
    this._set.clear();
  }

  get size(): number {
    return this._set.size;
  }

  get limit(): number {
    return this._limit;
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this._set[Symbol.iterator]();
  }
}
