import { sveltekit } from '@sveltejs/adapter-cloudflare';

const config = {
  kit: {
    adapter: sveltekit()
  }
};

export default config;
