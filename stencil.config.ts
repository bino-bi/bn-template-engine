import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
  namespace: 'bn-template-engine',
  globalStyle: 'src/global.css',
  plugins: [
    sass()
  ],
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    // {
    //   type: 'dist-custom-elements-bundle',
    // },
    {
      type: 'dist-custom-elements',
    },
    {
      type: 'docs-readme',
      footer: 'developed by Bino Bi',
    },
    {
      type: 'www',
      serviceWorker: null, // disable service workers
    },
  ]
};
