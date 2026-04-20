const formData = new FormData();
formData.append('customerName', 'Test User');
formData.append('address', '123 Test St');
formData.append('email', 'test@example.com');
formData.append('notes', 'Testing API');

// Create a dummy text file blob
const blob = new Blob(['dummy content for testing purposes'], { type: 'text/plain' });
formData.append('files', blob, 'test.txt');

fetch('http://localhost:3000/api/process-job', {
  method: 'POST',
  body: formData
}).then(r => r.json()).then(data => {
  console.log("RESPONSE:", JSON.stringify(data, null, 2));
}).catch(e => console.error("FAIL:", e));
