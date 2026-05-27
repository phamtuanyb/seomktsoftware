import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  yescaleApiKey: process.env.YESCALE_API_KEY ?? '',
  replicateApiToken: process.env.REPLICATE_API_TOKEN ?? '',
  dataforseoLogin: process.env.DATAFORSEO_LOGIN ?? '',
  dataforseoPassword: process.env.DATAFORSEO_PASSWORD ?? '',
  proxyProvider: (process.env.PROXY_PROVIDER ?? 'none') as 'scraperapi' | 'brightdata' | 'none',
  scraperApiKey: process.env.SCRAPERAPI_KEY ?? '',
  brightdataUsername: process.env.BRIGHTDATA_USERNAME ?? '',
  brightdataPassword: process.env.BRIGHTDATA_PASSWORD ?? '',
}));
