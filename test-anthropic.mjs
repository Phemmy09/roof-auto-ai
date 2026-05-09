/**
 * Verify Anthropic API key and available models
 * Run: node test-anthropic.mjs
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve('.env.local') });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  console.log('Testing Anthropic API...');
  
  // Try the model being used
  const modelsToTest = [
    'claude-sonnet-4-5',
    'claude-sonnet-4-6',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest',
  ];
  
  for (const model of modelsToTest) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }]
      });
      console.log(`✅ Model "${model}" works! Response: ${msg.content[0]?.text}`);
      break;
    } catch (e) {
      console.log(`❌ Model "${model}" failed: ${e.message?.slice(0, 80)}`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
