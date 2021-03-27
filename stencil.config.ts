import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
  namespace: 'bn-template-engine',
  commonjs: {
    namedExports: {
      '@bino-bi/ibcs-component/dist/types/components/ibcs-title/utils/model,': ['DateDistance','DateLink'],
      './node_modules/@bino-bi/ibcs-component/dist/types/components/ibcs-title/utils/model.d.ts,': ['DateDistanceType','DateLinkType','DateDistance','DateLink']
    }
  },
  plugins: [
    sass()
  ],
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'dist-custom-elements-bundle',
    },
    {
      type: 'docs-readme',
    },
    {
      type: 'www',
      serviceWorker: null, // disable service workers
    },
  ]
};
