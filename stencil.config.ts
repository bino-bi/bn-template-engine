import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
  namespace: 'bn-template-engine',
  // the build leaves out the specs and their helpers, tsconfig.json keeps them for the type check
  tsconfig: 'tsconfig.build.json',
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
      // a consumer of dist/components does not have to install @stencil/core
      externalRuntime: false,
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
