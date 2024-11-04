import { AdapterUtils } from "./AdapterUtils";
import { IAdapter } from "./IAdapter";

export class StringAdapter implements IAdapter<string> {
  adapt(data: any): string {
    return AdapterUtils.adaptDefaultString(data);
  }

  default(): string {
    return '';
  }
}
