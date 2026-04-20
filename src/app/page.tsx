"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileType, CheckCircle, ArrowRight, Loader2, Info, Download, Trash2 } from "lucide-react";

export default function Home() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ customerName: '', address: '', email: '', notes: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleNext = () => {
    if (step === 1 && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setStep(step + 1);
  };
  const handleBack = () => { setError(''); setStep(step - 1); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const limitExceeded = selectedFiles.some(f => f.size > 10 * 1024 * 1024);
      if (limitExceeded) {
        setError("One or more files exceed the 10MB limit.");
        return;
      }
      setError('');
      setFiles(prev => [...prev, ...selectedFiles]);
      e.target.value = ''; // Reset input so you can re-select
    }
  };

  const processJob = async () => {
    setLoading(true);
    setError('');
    
    try {
      const uploadResults = [];

      for (const file of files) {
         // 1. Gather a secure upload destination from backend
         const urlReq = await fetch('/api/get-upload-url', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name }),
            headers: { 'Content-Type': 'application/json' }
         });
         const urlData = await urlReq.json();
         if (!urlReq.ok) throw new Error(urlData.error);
         
         // 2. Direct PUT to Supabase Bucket (bypassing NodeJS body constraints entirely)
         if (urlData.signedUrl !== 'mock-url') {
            const uploadReq = await fetch(urlData.signedUrl, {
               method: 'PUT',
               body: file,
               headers: { 'Content-Type': file.type }
            });
            if (!uploadReq.ok) throw new Error(`Failed to upload ${file.name} directly to cloud.`);
         }
         
         uploadResults.push({
            path: urlData.path,
            mimeType: file.type,
            name: file.name
         });
      }

      const payload = {
        ...formData,
        uploadedFiles: uploadResults
      };

      // 3. Command API logic
      const res = await fetch('/api/process-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("Critical Server Crash. The payload might still be too large, or your API keys triggered an edge crash.");
      }
      
      if (!res.ok) throw new Error(data.error || "Failed to process job.");
      
      setResult(data);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-6 font-sans">
      <nav className="w-full max-w-5xl flex justify-between items-center py-6 mb-8 border-b border-slate-800">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
          Roof Auto AI
        </h1>
        <div className="flex gap-4">
          <a href="/formula-engine" className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full border border-slate-700 transition">
            Formula Engine
          </a>
          <div className="text-sm font-medium bg-blue-900/30 text-blue-400 px-4 py-2 rounded-full border border-blue-800/50">
            Reliable Exteriors Group
          </div>
        </div>
      </nav>

      <main className="w-full max-w-3xl">
        <div className="flex mb-8 items-center justify-between px-10">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step >= num ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-slate-500'}`}>
                {num}
              </div>
              {num < 3 && <div className={`w-24 h-1 mx-4 rounded ${step > num ? 'bg-blue-500' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700/50 shadow-2xl relative overflow-hidden min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
               <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
               <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">Claude AI is calculating...</h3>
               <p className="text-slate-400 text-sm mt-2">Reading documents and computing formulas.</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold mb-6">1. Create a Job</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Customer Name</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Main St, City, ST" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Recipient Email (For PDF Delivery)</label>
                    <input type="email" className={`w-full bg-slate-900 border rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${formData.email && !isValidEmail(formData.email) ? 'border-red-500' : 'border-slate-700'}`} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="orders@reliableexteriors.com" />
                    {formData.email && !isValidEmail(formData.email) && <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Job Notes</label>
                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Special requests..." />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={handleNext} disabled={!formData.customerName || !formData.email || !isValidEmail(formData.email)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-lg font-bold flex items-center transition-all">
                    Next Step <ArrowRight className="ml-2 w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold mb-2">2. Upload Documents</h2>
                <p className="text-slate-400 mb-6 text-sm">Upload Eagle View, Scope, Contracts, and Site Photos (Max 10MB per file).</p>
                
                <div className="border-2 border-dashed border-slate-600 bg-slate-900/50 p-10 rounded-xl flex flex-col items-center justify-center text-center relative group">
                  <Upload className="w-12 h-12 text-slate-400 mb-4 group-hover:text-blue-400 transition-colors" />
                  <p className="text-slate-300 font-medium">Drag & drop files or click to browse</p>
                  <p className="text-slate-500 text-xs mt-2">Support for PDF, image, and text formats</p>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx,application/pdf,image/*,text/plain" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>

                {error && <p className="text-red-400 text-sm mt-4 flex items-center"><Info className="w-4 h-4 mr-2"/>{error}</p>}

                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <FileType className="w-5 h-5 text-emerald-400 mr-3" />
                        <span className="flex-1 truncate text-sm">{f.name}</span>
                        <span className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button onClick={() => setFiles(files.filter((_, index) => index !== i))} className="ml-4 text-slate-500 hover:text-red-400 transition-colors outline-none" title="Remove Document">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button onClick={handleBack} className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-bold transition-all">Back</button>
                  <button onClick={processJob} disabled={files.length === 0} className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:opacity-90 disabled:opacity-50 px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center">
                    Process with AI <ArrowRight className="ml-2 w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && result && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Order Completed Successfully!</h2>
                  <p className="text-slate-400 mt-2">The calculated order PDF has been generated and emailed to <strong className="text-white">{formData.email}</strong>.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-slate-900 rounded-xl p-5 border border-slate-700">
                     <h3 className="font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">Roof Measurements</h3>
                     <ul className="space-y-2 text-sm">
                       <li className="flex justify-between"><span className="text-slate-400">Squares:</span> <span className="font-medium text-white">{result.extractedData?.squares || 0}</span></li>
                       <li className="flex justify-between"><span className="text-slate-400">Pitch:</span> <span className="font-medium text-white">{result.extractedData?.pitch || 'N/A'}</span></li>
                       <li className="flex justify-between"><span className="text-slate-400">Ridges/Hips:</span> <span className="font-medium text-white">{(result.extractedData?.ridges || 0) + (result.extractedData?.hips || 0)} ft</span></li>
                       <li className="flex justify-between"><span className="text-slate-400">Valleys:</span> <span className="font-medium text-white">{result.extractedData?.valleys || 0} ft</span></li>
                     </ul>
                   </div>
                   <div className="bg-slate-900 rounded-xl p-5 border border-blue-900/50 shadow-[0_0_20px_rgba(30,58,138,0.2)]">
                     <h3 className="font-bold text-blue-400 mb-4 border-b border-slate-800 pb-2">Materials to Order</h3>
                     <ul className="space-y-2 text-sm text-slate-100">
                       <li className="flex justify-between"><span>Shingles:</span> <span className="font-bold">{result.calculatedMaterials?.shingles || 0} squares</span></li>
                       <li className="flex justify-between"><span>Felt Underlayment:</span> <span className="font-bold">{result.calculatedMaterials?.felt || 0} rolls</span></li>
                       <li className="flex justify-between"><span>Ice & Water:</span> <span className="font-bold">{result.calculatedMaterials?.iceAndWater || 0} rolls</span></li>
                       <li className="flex justify-between"><span>Ridge Cap:</span> <span className="font-bold">{result.calculatedMaterials?.ridgeCap || 0} bundles</span></li>
                       <li className="flex justify-between"><span>Drip Edge:</span> <span className="font-bold">{result.calculatedMaterials?.dripEdge || 0} pcs</span></li>
                       <li className="flex justify-between"><span>Coil Nails:</span> <span className="font-bold">{result.calculatedMaterials?.coilNails || 0} boxes</span></li>
                     </ul>
                   </div>
                </div>

                <div className="mt-8 text-center flex flex-col items-center">
                  <p className="text-xs text-slate-500 mb-4 bg-slate-900/50 p-2 rounded-lg inline-block">Notice: Job data will be automatically purged from the system in 10 minutes.</p>
                  <div className="flex gap-4">
                    <button onClick={() => {
                        if (result?.pdfBase64) {
                           const link = document.createElement('a');
                           link.href = `data:application/pdf;base64,${result.pdfBase64}`;
                           link.download = `Roof_Auto_Order_${formData.customerName.replace(/\s+/g, '_')}.pdf`;
                           link.click();
                        }
                    }} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold transition-all flex items-center shadow-lg shadow-blue-900/50">
                       <Download className="w-5 h-5 mr-2" /> Download PDF
                    </button>
                    <button onClick={() => { setStep(1); setFormData({ customerName: '', address: '', email: '', notes: '' }); setFiles([]); setResult(null); }} className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-bold transition-all">Start New Job</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
