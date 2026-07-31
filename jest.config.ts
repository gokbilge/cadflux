import type { Config } from 'jest'

const config: Config = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json'
      }
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: {
          allowJs: true
        }
      }
    ]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!.*(mtext-parser|rbush|quickselect))'
  ],
  testPathIgnorePatterns: [
    '/e2e/',
    '/__tests__/helpers/'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@cadflux/auth$': '<rootDir>/packages/auth/src/index.ts',
    '^@cadflux/batch-engine$': '<rootDir>/packages/batch-engine/src/index.ts',
    '^@cadflux/config$': '<rootDir>/packages/config/src/index.ts',
    '^@cadflux/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@cadflux/core$': '<rootDir>/packages/core/src/index.ts',
    '^@cadflux/database$': '<rootDir>/packages/database/src/index.ts',
    '^@cadflux/diagnostics$': '<rootDir>/packages/diagnostics/src/index.ts',
    '^@cadflux/drawing-model$': '<rootDir>/packages/drawing-model/src/index.ts',
    '^@cadflux/dwg-adapter$': '<rootDir>/packages/dwg-adapter/src/index.ts',
    '^@cadflux/dxf-adapter$': '<rootDir>/packages/dxf-adapter/src/index.ts',
    '^@cadflux/file-ingest$': '<rootDir>/packages/file-ingest/src/index.ts',
    '^@cadflux/file-ingest/node$': '<rootDir>/packages/file-ingest/src/node.ts',
    '^@cadflux/plot-engine$': '<rootDir>/packages/plot-engine/src/index.ts',
    '^@cadflux/presets$': '<rootDir>/packages/presets/src/index.ts',
    '^@cadflux/renderer-pdf$': '<rootDir>/packages/renderer-pdf/src/index.ts',
    '^@cadflux/renderer-svg$': '<rootDir>/packages/renderer-svg/src/index.ts',
    '^@cadflux/renderer-webgl$': '<rootDir>/packages/renderer-webgl/src/index.ts',
    '^@cadflux/storage$': '<rootDir>/packages/storage/src/index.ts',
    '^@mlightcad/cad-pdf-plugin$': '<rootDir>/packages/cad-pdf-plugin/src/index.ts',
    '^@mlightcad/cad-pdf-plugin/register$':
      '<rootDir>/packages/cad-pdf-plugin/src/register.ts',
    '^@mlightcad/cad-simple-viewer$':
      '<rootDir>/packages/cad-simple-viewer/src/index.ts',
    '^@mlightcad/cad-svg-plugin$': '<rootDir>/packages/cad-svg-plugin/src/index.ts',
    '^@mlightcad/cad-svg-plugin/register$':
      '<rootDir>/packages/cad-svg-plugin/src/register.ts',
    '^@mlightcad/cad-viewer$': '<rootDir>/packages/cad-viewer/src/index.ts',
    '^lodash-es$': 'lodash',
    '^three/examples/jsm/lines/LineMaterial\\.js$':
      '<rootDir>/test/mocks/three/LineMaterial.js',
    '^three/examples/jsm/lines/LineSegments2\\.js$':
      '<rootDir>/test/mocks/three/LineSegments2.js',
    '^three/examples/jsm/lines/LineSegmentsGeometry\\.js$':
      '<rootDir>/test/mocks/three/LineSegmentsGeometry.js',
    '^three/examples/jsm/renderers/CSS2DRenderer\\.js$':
      '<rootDir>/test/mocks/three/CSS2DRenderer.js',
    '^three/examples/jsm/utils/BufferGeometryUtils\\.js$':
      '<rootDir>/test/mocks/three/BufferGeometryUtils.js',
    '^three/examples/jsm/controls/OrbitControls(\\.js)?$':
      '<rootDir>/test/mocks/three/OrbitControls.js'
  }
}

export default config
