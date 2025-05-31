import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:8000/api/v1/openapi.json',
  output: 'src/client',
  watch: true,
  plugins: ['@hey-api/client-axios'],
  base: '/api/v1'
});
