import { defineConfig } from 'astro/config';
import react    from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  compressHTML: true,
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});
