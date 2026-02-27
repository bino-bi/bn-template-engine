export interface IAdapter<T> {
  adapt(data: Record<string, unknown>): T;
  default(): T;
}
