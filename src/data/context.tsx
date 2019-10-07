import {h} from "@stencil/core";
import {createProviderConsumer} from '@stencil/state-tunnel';

export interface ContextState {
  isPreview: boolean,
  dataSources: {},
  updateDataSource?: (name: string, data: object) => void
}

export default createProviderConsumer<ContextState>({
    isPreview: false,
    dataSources: {}
  },
  (subscribe, child) => (
    <context-consumer subscribe={subscribe} renderer={child}/>
  )
);
