/**
 * End-to-end API test suite
 * Run: node test-apis.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

config({ path: resolve('.env.local') });

const BASE = 'http://localhost:3099';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log('\n=== Roof Auto AI — API Test Suite ===\n');

  // ---- Formula Engine ----
  console.log('📊 Formula Engine API');

  await test('GET /api/formulas returns 200 with config', async () => {
    const res = await fetch(`${BASE}/api/formulas`);
    assert(res.ok, `Status: ${res.status}`);
    const json = await res.json();
    assert(json.success, `success=false: ${JSON.stringify(json)}`);
    assert(json.config, 'No config in response');
    assert(typeof json.config.feltCoverage === 'number', 'feltCoverage missing');
    console.log(`     source: ${json.source || 'db'}, feltCoverage: ${json.config.feltCoverage}`);
  });

  await test('PUT /api/formulas updates config', async () => {
    const payload = {
      feltCoverage: 10, iceWaterCoverage: 60, ridgeCapCoverage: 31,
      dripEdgeLength: 10, coilNailsCoverage: 12,
      enableFelt: true, enableIceWater: true, enableRidgeCap: true,
      enableDripEdge: true, enableCoilNails: true
    };
    const res = await fetch(`${BASE}/api/formulas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert(res.ok, `Status: ${res.status}`);
    const json = await res.json();
    assert(json.success, `success=false: ${JSON.stringify(json)}`);
  });

  // ---- Upload URL ----
  console.log('\n📁 Upload URL API');

  await test('POST /api/get-upload-url returns signedUrl and path', async () => {
    const res = await fetch(`${BASE}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test_report.pdf' })
    });
    assert(res.ok, `Status: ${res.status}`);
    const json = await res.json();
    assert(json.signedUrl, `No signedUrl in response: ${JSON.stringify(json)}`);
    assert(json.path, `No path in response: ${JSON.stringify(json)}`);
    console.log(`     path: ${json.path.slice(0, 50)}...`);
  });

  await test('POST /api/get-upload-url handles missing filename', async () => {
    const res = await fetch(`${BASE}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await res.json();
    assert(json.error, 'Should have returned an error for missing filename');
  });

  // ---- Process Job (mock — no real files) ----
  console.log('\n🤖 Process Job API');

  await test('POST /api/process-job with empty files returns result', async () => {
    const res = await fetch(`${BASE}/api/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Test Customer',
        address: '123 Test St',
        email: 'cheryl@therelexgroup.com',
        notes: 'API test run',
        uploadedFiles: []
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Status ${res.status}: ${json.error || JSON.stringify(json)}`);
    }
    assert(json.success, `success=false: ${JSON.stringify(json).slice(0,200)}`);
    assert(json.calculatedMaterials, 'No calculatedMaterials in response');
    assert(json.pdfBase64, 'No pdfBase64 in response');
    console.log(`     jobId: ${json.jobId}`);
    console.log(`     emailSent: ${json.emailSent}`);
    console.log(`     shingles: ${json.calculatedMaterials?.shingles} SQ`);
    console.log(`     crewInstructions count: ${json.crewInstructions?.length || 0}`);
  });

  // ---- Summary ----
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check errors above.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
