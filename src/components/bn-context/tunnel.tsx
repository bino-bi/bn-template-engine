import {h} from '@stencil/core';
import { createProviderConsumer } from '@stencil/state-tunnel';

export interface ContextState {
  datasourcesData: any,
  updateDatasource?: (key: string, data: any) => void
}

export default createProviderConsumer<ContextState>({
    datasourcesData: {}
  },
  (subscribe, child) => (
    <context-consumer subscribe={subscribe} renderer={child} />
  )
);
