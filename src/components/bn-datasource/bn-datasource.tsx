import {Component, Prop, h, Host, Listen, Method} from "@stencil/core";
import Tunnel from '../../data/context';
import faker from "faker";
import hash from '@emotion/hash'

@Component({
  tag: 'bn-datasource',
  styleUrl: 'bn-datasource.css',
})
export class Datasource {
  constructor() {
    this.emitData = this.emitData.bind(this);
    this.contentModified = this.contentModified.bind(this);
  }

  private currentSchema: Object = undefined;

  /**
   * Unique (template scope) name of the datasource
   */
  @Prop() name: string;

  /**
   * single or collection
   */
  @Prop() type: string = 'single';

  @Prop() isPreview: boolean;
  @Prop() updateDataSource?: (name: string, data: object, hash?: string) => void;

  @Listen('DOMSubtreeModified')
  contentModified(event: MutationEvent) {
    const target: any | HTMLElement | Text = event.target;
    this.currentSchema = JSON.parse(target.data || target.innerText);

    if (this.isPreview) {
      this.emitData(this.generate(this.currentSchema, this.type == 'single' ? 1 : 10), hash(JSON.stringify(this.currentSchema)));
    }
  }

  @Method()
  async emitData(data: any, hash?: string) {
    this.updateDataSource(this.name, data, hash);
  }

  private generate(schema: any, rows: number): any {

    const keys = Object.keys(schema);
    const columns = keys.map((value) => {
      const def = schema[value];

      return [...Array(rows)].map(() => {
        switch (def.type) {
          case 'date': {
            return faker.date.recent();
          }
          case 'string': {
            return faker.random.word();
          }

          case 'integer': {
            return faker.random.number(15);
          }

          case 'collection': {
            return this.generate(def.schema, 3)
          }

          case 'single': {
            return this.generate(def.schema, 1)
          }

          case String(/^\[.*\]$/.test(def.type) ? def.type : {}): {
            return this.generate({__: {type: def.type.substr(1, def.type.length - 2)}}, 3).map((value) => value.__)
          }
        }
      });
    });

    const result = [...Array(rows)].map((_, i) => {
      const item = {};

      keys.forEach((key, j) => {
        item[key] = columns[j][i]
      });

      return item;
    });

    if (result.length == 1) {
      return result[0];
    } else {

      return result;
    }
  }

  render() {
    return <Host/>
  }
}

Tunnel.injectProps(Datasource, ['updateDataSource', 'isPreview']);
