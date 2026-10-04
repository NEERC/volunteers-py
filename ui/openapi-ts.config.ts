import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:8000/api/v1/openapi.json',
  output: {
    path: 'src/client',
    // biome writes the trailing newline that pre-commit's end-of-file-fixer expects
    format: 'biome',
  },
  plugins: ['@hey-api/client-axios'],
  base: '/api/v1'
});
