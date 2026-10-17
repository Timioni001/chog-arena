import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No ISR/incremental cache is needed: the page is static and every API route is dynamic.
export default defineCloudflareConfig({});
