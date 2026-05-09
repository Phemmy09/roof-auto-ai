// Quick smoke test for the process-job API endpoint.
// Run with: node test.mjs
// Requires the dev server to be running on port 3000.

const payload = {
  customerName: 'Test Customer',
  address: '123 Test Street, City, ST 00000',
  email: 'test@example.com',
  notes: 'Smoke test — no real files attached',
  uploadedFiles: []
};

fetch('http://localhost:3000/api/process-job', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(r => r.json())
  .then(data => console.log('RESPONSE:', JSON.stringify(data, null, 2)))
  .catch(e => console.error('FAIL:', e));
