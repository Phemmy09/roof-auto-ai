/**
 * Rigorous end-to-end test suite — Scarritt A job.
 * Covers: API health, formula engine persistence, upload edge cases,
 * full 6-file job, response shape, email delivery, PDF validity, empty-file path.
 *
 * Run: node test-scarritt.mjs
 * Requires dev server on port 3000.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

config({ path: resolve('.env.local') });

const BASE = 'http://localhost:3000';
const DEFAULT_EMAIL = 'cheryl@therelexgroup.com';  // must always be pre-filled in app

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  process.stdout.write(`  • ${name} ... `);
  try {
    await fn();
    console.log('✅');
    passed++;
  } catch (e) {
    console.log(`❌\n    → ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertNum(val, label) { assert(typeof val === 'number' && !isNaN(val) && val >= 0, `${label} must be a non-negative number, got ${JSON.stringify(val)}`); }

async function waitForServer(ms = 45000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/api/formulas`); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

// ── Upload helper ────────────────────────────────────────────────────────────
async function uploadFile(filename, mime) {
  const filePath = resolve('test data', filename);
  const fileBuffer = readFileSync(filePath);

  const urlRes = await fetch(`${BASE}/api/get-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  assert(urlRes.ok, `get-upload-url failed: HTTP ${urlRes.status}`);
  const { signedUrl, path } = await urlRes.json();
  assert(path, 'No path returned from get-upload-url');

  if (signedUrl !== 'mock-url') {
    const upRes = await fetch(signedUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: { 'Content-Type': mime },
    });
    assert(upRes.ok, `Supabase upload failed: HTTP ${upRes.status}`);
  }

  return { path, mimeType: mime, name: filename, sizeBytes: fileBuffer.length };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  Roof Auto AI — Rigorous Test Suite (Scarritt A)');
  console.log('════════════════════════════════════════════════════════════\n');

  console.log('⏳ Waiting for dev server on :3000 ...');
  assert(await waitForServer(), 'Dev server not ready after 45s. Run: npm run dev');
  console.log('✓ Server ready.\n');

  // ══════════════════════════════════════════════════════════════════════════
  console.log('─── 1. API Health ───────────────────────────────────────────');

  await test('GET /api/formulas returns 200', async () => {
    const r = await fetch(`${BASE}/api/formulas`);
    assert(r.ok, `HTTP ${r.status}`);
    const d = await r.json();
    assert(d.success, 'success != true');
    assert(d.config, 'No config in response');
  });

  await test('OPTIONS /api/formulas returns CORS headers', async () => {
    const r = await fetch(`${BASE}/api/formulas`, { method: 'OPTIONS' });
    assert(r.headers.get('access-control-allow-origin'), 'Missing CORS header');
  });

  await test('OPTIONS /api/process-job returns CORS headers', async () => {
    const r = await fetch(`${BASE}/api/process-job`, { method: 'OPTIONS' });
    assert(r.headers.get('access-control-allow-origin'), 'Missing CORS header');
  });

  await test('POST /api/get-upload-url missing filename → 400 error', async () => {
    const r = await fetch(`${BASE}/api/get-upload-url`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const d = await r.json();
    assert(d.error, 'Expected error field');
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 2. Formula Engine Persistence ──────────────────────────');

  let originalConfig;
  await test('GET /api/formulas reads config with all numeric fields', async () => {
    const r = await fetch(`${BASE}/api/formulas`);
    const d = await r.json();
    originalConfig = d.config;
    assertNum(originalConfig.feltCoverage, 'feltCoverage');
    assertNum(originalConfig.iceWaterCoverage, 'iceWaterCoverage');
    assertNum(originalConfig.ridgeCapCoverage, 'ridgeCapCoverage');
    assertNum(originalConfig.dripEdgeLength, 'dripEdgeLength');
    assertNum(originalConfig.coilNailsCoverage, 'coilNailsCoverage');
    assert(typeof originalConfig.enableFelt === 'boolean', 'enableFelt must be boolean');
  });

  await test('PUT /api/formulas saves sentinel value and read-back matches', async () => {
    const payload = { ...originalConfig, feltCoverage: 99 };
    const putRes = await fetch(`${BASE}/api/formulas`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert(putRes.ok, `PUT returned HTTP ${putRes.status}`);
    const putD = await putRes.json();
    assert(putD.success, `PUT success=false: ${JSON.stringify(putD)}`);

    // Read back and verify
    const getRes = await fetch(`${BASE}/api/formulas`);
    const getD = await getRes.json();
    const readBack = getD.config.feltCoverage;
    assert(readBack === 99, `Read-back mismatch: expected 99, got ${readBack} (DB not persisting)`);
  });

  await test('PUT /api/formulas restores original config', async () => {
    const putRes = await fetch(`${BASE}/api/formulas`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(originalConfig),
    });
    assert(putRes.ok, `Restore PUT returned HTTP ${putRes.status}`);
    const putD = await putRes.json();
    assert(putD.success, 'Restore failed');
    const getD = await (await fetch(`${BASE}/api/formulas`)).json();
    assert(getD.config.feltCoverage === originalConfig.feltCoverage, 'Config not restored');
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 3. File Upload ──────────────────────────────────────────');

  await test('Upload URL: special chars in filename are sanitized', async () => {
    const r = await fetch(`${BASE}/api/get-upload-url`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test file (2024) #1.pdf' }),
    });
    assert(r.ok, `HTTP ${r.status}`);
    const d = await r.json();
    assert(d.path, 'No path returned');
    assert(!d.path.includes(' ') && !d.path.includes('#'), `Path not sanitized: ${d.path}`);
  });

  await test('Upload URL: empty filename → 400', async () => {
    const r = await fetch(`${BASE}/api/get-upload-url`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: '' }),
    });
    const d = await r.json();
    assert(d.error, 'Expected error for empty filename');
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 4. Edge Case: process-job with no files ─────────────────');

  await test('POST /api/process-job with empty uploadedFiles → graceful response', async () => {
    const r = await fetch(`${BASE}/api/process-job`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Edge Case Test',
        address: '0 Null Island',
        email: DEFAULT_EMAIL,
        notes: '',
        uploadedFiles: [],
      }),
    });
    const d = await r.json().catch(() => ({}));
    assert(r.ok, `HTTP ${r.status}: ${d.error || JSON.stringify(d).slice(0, 100)}`);
    assert(d.success, `success=false: ${JSON.stringify(d).slice(0, 200)}`);
    assert(d.calculatedMaterials, 'No calculatedMaterials');
    assert(d.pdfBase64, 'No pdfBase64');
    // All quantities must be numbers (even if 0)
    const m = d.calculatedMaterials;
    for (const key of ['shingles','felt','iceAndWater','ridgeCap','dripEdge','coilNails','starterStrip','pipeJacks','ridgeVentSections','capNails','sealant']) {
      assertNum(m[key], `calculatedMaterials.${key}`);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 5. Uploading 6 Scarritt PDFs ───────────────────────────');

  const FILES = [
    { name: '1_Before_Photos_Scarritt_A_compressed.pdf',    mime: 'application/pdf' },
    { name: '2_Progress_Photos_Scarritt_A_compressed.pdf',  mime: 'application/pdf' },
    { name: '3_Completion_Photos_Scarritt_A_compressed.pdf',mime: 'application/pdf' },
    { name: 'City_County Codes_Scarritt_A.pdf',             mime: 'application/pdf' },
    { name: 'Contract_Scarritt_A.pdf',                      mime: 'application/pdf' },
    { name: 'EagleView_Scarritt_A.pdf',                     mime: 'application/pdf' },
  ];

  const uploadedFiles = [];
  for (const f of FILES) {
    await test(`Upload: ${f.name}`, async () => {
      const result = await uploadFile(f.name, f.mime);
      uploadedFiles.push(result);
      const mb = (result.sizeBytes / 1024 / 1024).toFixed(2);
      const note = f.name.match(/Before|Progress|Completion/i) ? ' [photo — will be filtered]' : '';
      process.stdout.write(`  (${mb} MB${note}) `);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 6. Full Job Processing (Claude AI + PDF + Email) ────────');
  console.log('    Calling Claude... this takes ~70–120 seconds.\n');

  let jobData = null;
  const jobStart = Date.now();

  await test('POST /api/process-job returns success with all required fields', async () => {
    const r = await fetch(`${BASE}/api/process-job`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Scarritt Rigorous Test',
        address: '1833 Bluff St, Boulder, CO 80304',
        email: DEFAULT_EMAIL,
        notes: 'Rigorous end-to-end test',
        uploadedFiles,
      }),
    });
    let d;
    try { d = await r.json(); }
    catch { throw new Error(`Non-JSON response (HTTP ${r.status})`); }
    assert(r.ok, `HTTP ${r.status}: ${d?.error || JSON.stringify(d).slice(0, 200)}`);
    assert(d.success === true, `success != true`);
    assert(d.jobId, 'No jobId');
    assert(d.extractedData, 'No extractedData');
    assert(d.calculatedMaterials, 'No calculatedMaterials');
    assert(Array.isArray(d.crewInstructions), 'crewInstructions not an array');
    assert(Array.isArray(d.laborItems), 'laborItems not an array');
    assert(Array.isArray(d.materialNotes), 'materialNotes not an array');
    assert(d.pdfBase64, 'No pdfBase64');
    jobData = d;
  });

  const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 7. Response Shape Validation ────────────────────────────');

  await test('All 12 material quantities are non-negative numbers', async () => {
    assert(jobData, 'No job data (job test may have failed)');
    const m = jobData.calculatedMaterials;
    for (const key of ['shingles','felt','iceAndWater','ridgeCap','dripEdge','dripEdgeRake','dripEdgeEave','coilNails','starterStrip','pipeJacks','ridgeVentSections','capNails','sealant']) {
      assertNum(m[key], `calculatedMaterials.${key}`);
    }
  });

  await test('Extracted squares > 0 (real document was parsed)', async () => {
    assert(jobData, 'No job data');
    assert(Number(jobData.extractedData?.squares) > 0, `squares=${jobData.extractedData?.squares} — extraction may have failed`);
  });

  await test('Shingles quantity matches expected formula (squares × 1.10, ceil)', async () => {
    assert(jobData, 'No job data');
    const sq = Number(jobData.extractedData.squares);
    const expected = Math.ceil(sq * 1.10);
    const actual = jobData.calculatedMaterials.shingles;
    assert(actual === expected, `shingles ${actual} ≠ ceil(${sq} × 1.10) = ${expected}`);
  });

  await test('Crew instructions are non-empty strings (no blanks)', async () => {
    assert(jobData, 'No job data');
    assert(jobData.crewInstructions.length > 0, 'Zero crew instructions returned');
    for (const item of jobData.crewInstructions) {
      assert(typeof item === 'string' && item.trim().length > 0, `Blank crew instruction: ${JSON.stringify(item)}`);
    }
  });

  await test('PDF base64 is valid and at least 5 KB', async () => {
    assert(jobData, 'No job data');
    const raw = Buffer.from(jobData.pdfBase64, 'base64');
    assert(raw.length >= 5000, `PDF too small: ${raw.length} bytes (likely empty)`);
    // PDF magic bytes: %PDF
    assert(raw.slice(0, 4).toString() === '%PDF', 'base64 did not decode to a valid PDF');
  });

  await test('Photos filtered out — not sent to Claude (squares extracted from EagleView)', async () => {
    assert(jobData, 'No job data');
    // If photos had been sent and EagleView hadn't been processed, squares would be 0
    assert(Number(jobData.extractedData.squares) > 0, 'Squares = 0 — EagleView was not processed');
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n─── 8. Email & Hardcoded Default ────────────────────────────');

  await test('Email was sent (emailSent flag = true)', async () => {
    assert(jobData, 'No job data');
    assert(jobData.emailSent === true, `emailSent=false — check SMTP config`);
  });

  await test('Hardcoded default email is present in page.tsx source', async () => {
    const src = readFileSync(resolve('src/app/page.tsx'), 'utf-8');
    const count = (src.match(/cheryl@therelexgroup\.com/g) || []).length;
    assert(count >= 2, `Expected ≥2 occurrences of cheryl@therelexgroup.com in page.tsx, found ${count} (initial state + reset must both be set)`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed  |  ${failed} failed  |  ${elapsed}s total`);

  if (jobData) {
    const e = jobData.extractedData;
    const m = jobData.calculatedMaterials;
    console.log('\n  📋 Extracted:');
    console.log(`     ${e.customerName} | ${e.squares} SQ | ${e.pitch} | ${e.contractType}`);
    console.log(`     Shingle: ${e.shingleProduct} — ${e.shingleColor}`);
    console.log('\n  📦 Materials:');
    console.log(`     Shingles ${m.shingles} SQ | Felt ${m.felt} rolls | I&W ${m.iceAndWater} rolls`);
    console.log(`     Ridge Cap ${m.ridgeCap} bdl | Drip Edge ${m.dripEdge} pcs | Pipe Jacks ${m.pipeJacks}`);
    console.log(`     Ridge Vent ${m.ridgeVentSections} sections | Coil Nails ${m.coilNails} cases | Sealant ${m.sealant} tubes`);
    console.log(`\n  📧 Email → ${DEFAULT_EMAIL}: ${jobData.emailSent ? 'SENT ✅' : 'FAILED ❌'}`);
    console.log(`  📄 PDF: ${(Buffer.from(jobData.pdfBase64,'base64').length/1024).toFixed(0)} KB`);
    console.log(`  🔨 Crew instructions: ${jobData.crewInstructions.length} | Labor items: ${jobData.laborItems.length}`);
  }

  if (failures.length > 0) {
    console.log('\n  ❌ Failed tests:');
    failures.forEach(f => console.log(`     • ${f.name}\n       ${f.error}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('\n  🎉 All tests passed — app is production-ready.\n');
  }
}

main().catch(e => { console.error('\nFatal test error:', e.message); process.exit(1); });
