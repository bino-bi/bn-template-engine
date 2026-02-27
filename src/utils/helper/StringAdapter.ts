import { AdapterUtils } from "./AdapterUtils";
import { IAdapter } from "./IAdapter";

export class StringAdapter implements IAdapter<string> {
  adapt(data: Record<string, unknown>): string {
    return AdapterUtils.adaptDefaultString(data);
  }

  default(): string {
    return "";
  }
}
