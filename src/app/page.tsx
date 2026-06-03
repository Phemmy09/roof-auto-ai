"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileType, CheckCircle, ArrowRight, Loader2, Info,
  Download, Trash2, Plus, X, RefreshCw, Send, ChevronUp, ChevronDown, ChevronRight,
} from "lucide-react";

const APPROVED_LABOR = [
  'Tear-off',
  'Second story charge',
  'Steep slope charge',
  'Skylight replacement',
  'Chimney flashing',
  'Gutter replacement',
  'Satellite dish reset',
  'Heat cable R&R',
  'Solar panel removal',
  'Permit fee',
  'Mid-roof inspection fee',
  'Decking replacement',
];

function MatRow({
  label, value, unit, onChange,
}: { label: string; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-2">
      <span className="text-slate-400 text-xs flex-1 leading-tight pr-1">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs text-right focus:border-blue-500 focus:outline-none transition-colors"
        />
        <span className="text-slate-500 text-xs w-14">{unit}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: '', address: '', email: 'cheryl@therelexgroup.com', notes: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Editable result state
  const [editMaterials, setEditMaterials] = useState<any>(null);
  const [editInstructions, setEditInstructions] = useState<string[]>([]);
  const [editLabor, setEditLabor] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState<string[]>([]);

  // Action state
  const [regenerating, setRegenerating] = useState(false);
  const [resending, setResending] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Labor quick-add state
  const [newLaborItem, setNewLaborItem] = useState('');
  const [customLaborText, setCustomLaborText] = useState('');
  const [showCustomLabor, setShowCustomLabor] = useState(false);

  // Measurements panel toggle
  const [showMeasurements, setShowMeasurements] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setMat = (key: string, val: number) => {
    setEditMaterials((prev: any) => {
      const next = { ...prev, [key]: val };
      if (key === 'dripEdgeRake' || key === 'dripEdgeEave') {
        next.dripEdge = (next.dripEdgeRake || 0) + (next.dripEdgeEave || 0);
      }
      if (key === 'stepFlashing') {
        next.stepFlashingPcs = val * 45;
      }
      return next;
    });
  };

  const moveItem = (arr: string[], i: number, dir: -1 | 1): string[] => {
    const next = [...arr];
    const j = i + dir;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 1 && !isValidEmail(formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setStep(step + 1);
  };
  const handleBack = () => { setError(''); setStep(step - 1); };

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (selected.some(f => f.size > 10 * 1024 * 1024)) {
        setError('One or more files exceed the 10MB limit.');
        return;
      }
      setError('');
      setFiles(prev => [...prev, ...selected]);
      e.target.value = '';
    }
  };

  // ── Process job ───────────────────────────────────────────────────────────

  const processJob = async () => {
    setLoading(true);
    setError('');
    try {
      const uploadResults = [];
      for (const file of files) {
        const urlReq = await fetch('/api/get-upload-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!urlReq.ok) {
          const err = await urlReq.json().catch(() => ({}));
          throw new Error(err.error || `Failed to get upload URL for ${file.name}`);
        }
        const urlData = await urlReq.json();
        if (urlData.signedUrl !== 'mock-url') {
          const up = await fetch(urlData.signedUrl, {
            method: 'PUT', body: file, headers: { 'Content-Type': file.type },
          });
          if (!up.ok) throw new Error(`Failed to upload ${file.name} to storage.`);
        }
        uploadResults.push({ path: urlData.path, mimeType: file.type, name: file.name });
      }

      const res = await fetch('/api/process-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, uploadedFiles: uploadResults }),
      });
      let data;
      try { data = await res.json(); } catch {
        throw new Error(`Server error (status ${res.status}). Please try with fewer or smaller files.`);
      }
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}. Please try again.`);
      if (!data.calculatedMaterials) throw new Error(data.error || 'Server returned incomplete results. Please try again.');

      setResult(data);
      setEditMaterials({ ...data.calculatedMaterials });
      setEditInstructions([...(data.crewInstructions || [])]);
      setEditLabor([...(data.laborItems || [])]);
      setEditNotes([...(data.materialNotes || [])]);
      setActionStatus(null);
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  // ── PDF regeneration ──────────────────────────────────────────────────────

  const doAction = async (sendEmail: boolean) => {
    if (sendEmail) setResending(true); else setRegenerating(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName,
          address: formData.address,
          email: sendEmail ? formData.email : '',
          extractedData: result?.extractedData || {},
          calculatedMaterials: editMaterials,
          crewInstructions: editInstructions.filter(s => s.trim()),
          laborItems: editLabor.filter(s => s.trim()),
          materialNotes: editNotes.filter(s => s.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate PDF.');
      setResult((prev: any) => ({ ...prev, pdfBase64: data.pdfBase64 }));
      setActionStatus({
        type: 'success',
        msg: sendEmail
          ? `PDF regenerated and sent to ${formData.email}.`
          : 'PDF regenerated. Download the updated version below.',
      });
    } catch (err: any) {
      setActionStatus({ type: 'error', msg: err.message });
    } finally {
      if (sendEmail) setResending(false); else setRegenerating(false);
    }
  };

  // ── Labor quick-add ───────────────────────────────────────────────────────

  const addLaborItem = () => {
    if (newLaborItem && !editLabor.includes(newLaborItem)) {
      setEditLabor(prev => [...prev, newLaborItem]);
      setNewLaborItem('');
    }
  };

  const addCustomLabor = () => {
    const t = customLaborText.trim();
    if (t) {
      setEditLabor(prev => [...prev, t]);
      setCustomLaborText('');
      setShowCustomLabor(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
        {/* Step indicator */}
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
              <p className="text-slate-500 text-xs mt-1">This typically takes 70 seconds or less.</p>
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Step 1: Job Info ─────────────────────────────────────────── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h2 className="text-2xl font-bold mb-6">1. Create a Job</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Customer Name</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Address</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="123 Main St, City, ST" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Recipient Email (For PDF Delivery)</label>
                    <input type="email" className={`w-full bg-slate-900 border rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${formData.email && !isValidEmail(formData.email) ? 'border-red-500' : 'border-slate-700'}`} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="orders@reliableexteriors.com" />
                    {formData.email && !isValidEmail(formData.email) && <p className="text-red-400 text-xs mt-1">Please enter a valid email address</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Job Notes</label>
                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Special requests..." />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={handleNext} disabled={!formData.customerName || !formData.email || !isValidEmail(formData.email)} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-3 rounded-lg font-bold flex items-center transition-all">
                    Next Step <ArrowRight className="ml-2 w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Upload Documents ─────────────────────────────────── */}
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
                {error && <p className="text-red-400 text-sm mt-4 flex items-center"><Info className="w-4 h-4 mr-2" />{error}</p>}
                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                        <FileType className="w-5 h-5 text-emerald-400 mr-3" />
                        <span className="flex-1 truncate text-sm">{f.name}</span>
                        <span className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="ml-4 text-slate-500 hover:text-red-400 transition-colors outline-none" title="Remove">
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

            {/* ── Step 3: Editable Results ─────────────────────────────────── */}
            {step === 3 && result && editMaterials && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>

                {/* Success header */}
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Order Completed Successfully!</h2>
                  <p className="text-slate-400 mt-1 text-sm">PDF sent to <strong className="text-white">{formData.email}</strong>. Edit any value below, then regenerate.</p>
                </div>

                <div className="space-y-4">

                  {/* ── 1. Material Order Form ────────────────────────────── */}
                  <div className="bg-slate-900 rounded-xl p-5 border border-blue-900/50 shadow-[0_0_20px_rgba(30,58,138,0.2)]">
                    <h3 className="font-bold text-blue-400 mb-4 border-b border-slate-800 pb-2 text-sm uppercase tracking-wide">1. Material Order Form</h3>

                    <div className="grid grid-cols-2 gap-x-6">
                      {/* Left column */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 mt-1">Shingles & Underlayment</p>
                        <MatRow label="Field Shingles (w/ 10% waste)" value={editMaterials.shingles || 0} unit="SQ" onChange={v => setMat('shingles', v)} />
                        <MatRow label="Hip & Ridge Shingles" value={editMaterials.ridgeCap || 0} unit="bundles" onChange={v => setMat('ridgeCap', v)} />
                        <MatRow label="Starter Strip" value={editMaterials.starterStrip || 0} unit="bundles" onChange={v => setMat('starterStrip', v)} />
                        <MatRow label="Synthetic Underlayment" value={editMaterials.felt || 0} unit="rolls" onChange={v => setMat('felt', v)} />
                        <MatRow label="Ice & Water Shield" value={editMaterials.iceAndWater || 0} unit="rolls" onChange={v => setMat('iceAndWater', v)} />

                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 mt-3">Metal & Flashing</p>
                        <MatRow label="Drip Edge — Rake" value={editMaterials.dripEdgeRake || 0} unit="pcs" onChange={v => setMat('dripEdgeRake', v)} />
                        <MatRow label="Drip Edge — Eave" value={editMaterials.dripEdgeEave || 0} unit="pcs" onChange={v => setMat('dripEdgeEave', v)} />
                        <div className="flex items-center justify-between py-1 gap-2">
                          <span className="text-slate-600 text-xs italic flex-1">Total Drip Edge</span>
                          <span className="text-slate-400 text-xs font-medium w-[4.25rem] text-right pr-0.5">
                            {(editMaterials.dripEdgeRake || 0) + (editMaterials.dripEdgeEave || 0)} pcs
                          </span>
                        </div>
                        <MatRow label="Step Flashing" value={editMaterials.stepFlashing || 0} unit="bundles" onChange={v => setMat('stepFlashing', v)} />
                        <MatRow label="Counter Flashing / L-Flashing" value={editMaterials.counterFlashing || 0} unit="set(s)" onChange={v => setMat('counterFlashing', v)} />
                        <MatRow label={'Valley Metal (20″ × 50\' Roll)'} value={editMaterials.valleyMetal || 0} unit="roll(s)" onChange={v => setMat('valleyMetal', v)} />
                      </div>

                      {/* Right column */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 mt-1">Ventilation</p>
                        <MatRow label="Pipe Jacks" value={editMaterials.pipeJacks || 0} unit="ea" onChange={v => setMat('pipeJacks', v)} />
                        <MatRow label="Ridge Vent (4 ft sections)" value={editMaterials.ridgeVentSections || 0} unit="sections" onChange={v => setMat('ridgeVentSections', v)} />
                        <MatRow label="Box Vents (Lomanco 750)" value={editMaterials.boxVents || 0} unit="ea" onChange={v => setMat('boxVents', v)} />
                        <MatRow label={'7/16″ OSB Sheathing'} value={editMaterials.osbSheathing || 0} unit="sheet(s)" onChange={v => setMat('osbSheathing', v)} />

                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5 mt-3">Accessories & Hardware</p>
                        <MatRow label="Touch-Up Paint" value={editMaterials.touchUpPaint || 0} unit="cans" onChange={v => setMat('touchUpPaint', v)} />
                        <MatRow label={'Coil Nails 1-1/4"'} value={editMaterials.coilNails || 0} unit="cases" onChange={v => setMat('coilNails', v)} />
                        <MatRow label="Cap Nails (Plastic)" value={editMaterials.capNails || 0} unit="boxes" onChange={v => setMat('capNails', v)} />
                        <MatRow label="Geocel 2300 Sealant" value={editMaterials.sealant || 0} unit="tubes" onChange={v => setMat('sealant', v)} />
                        <MatRow label="Mule-Hide JTS1 Joint Sealant" value={editMaterials.muleHideSealant || 0} unit="tube(s)" onChange={v => setMat('muleHideSealant', v)} />
                      </div>
                    </div>

                    {/* Material Notes */}
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Material Notes</p>
                        <button
                          onClick={() => setEditNotes(prev => [...prev, ''])}
                          className="flex items-center text-blue-400 hover:text-blue-300 text-xs transition-colors"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Note
                        </button>
                      </div>
                      {editNotes.length === 0 && (
                        <p className="text-slate-600 text-xs italic">No notes — click Add Note to add one.</p>
                      )}
                      <div className="space-y-1.5">
                        {editNotes.map((note, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              value={note}
                              onChange={e => {
                                const next = [...editNotes];
                                next[i] = e.target.value;
                                setEditNotes(next);
                              }}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-blue-200 focus:border-blue-500 focus:outline-none"
                              placeholder="Note text..."
                            />
                            <button
                              onClick={() => setEditNotes(editNotes.filter((_, idx) => idx !== i))}
                              className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── 2. Crew Instructions ─────────────────────────────── */}
                  <div className="bg-slate-900 rounded-xl p-5 border border-emerald-900/50">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-emerald-400 text-sm uppercase tracking-wide">2. Crew Instructions</h3>
                      <button
                        onClick={() => setEditInstructions(prev => [...prev, ''])}
                        className="flex items-center text-emerald-400 hover:text-emerald-300 text-xs transition-colors"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Step
                      </button>
                    </div>
                    {editInstructions.length === 0 && (
                      <p className="text-slate-500 text-sm italic">No crew instructions.</p>
                    )}
                    <div className="space-y-2">
                      {editInstructions.map((item, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-slate-500 text-xs font-mono mt-2.5 w-5 shrink-0 text-right">{i + 1}.</span>
                          <textarea
                            value={item}
                            onChange={e => {
                              const next = [...editInstructions];
                              next[i] = e.target.value;
                              setEditInstructions(next);
                            }}
                            rows={2}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 resize-none focus:border-emerald-500 focus:outline-none"
                          />
                          <div className="flex flex-col gap-0.5 mt-1 shrink-0">
                            <button
                              onClick={() => setEditInstructions(moveItem(editInstructions, i, -1))}
                              disabled={i === 0}
                              className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                              title="Move up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditInstructions(moveItem(editInstructions, i, 1))}
                              disabled={i === editInstructions.length - 1}
                              className="text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors"
                              title="Move down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditInstructions(editInstructions.filter((_, idx) => idx !== i))}
                              className="text-slate-600 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── 3. Labor Items ───────────────────────────────────── */}
                  <div className="bg-slate-900 rounded-xl p-5 border border-amber-900/50">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-amber-400 text-sm uppercase tracking-wide">3. Labor Items</h3>
                    </div>
                    {editLabor.length === 0 && (
                      <p className="text-slate-500 text-sm italic mb-3">No labor items.</p>
                    )}
                    <div className="space-y-1.5 mb-4">
                      {editLabor.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-800 rounded px-3 py-2">
                            <span className="text-slate-200 text-sm">{item}</span>
                          </div>
                          <button
                            onClick={() => setEditLabor(editLabor.filter((_, idx) => idx !== i))}
                            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Quick-add from approved list */}
                    <div className="flex gap-2">
                      <select
                        value={newLaborItem}
                        onChange={e => setNewLaborItem(e.target.value)}
                        className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">Add from approved list...</option>
                        {APPROVED_LABOR.filter(l => !editLabor.includes(l)).map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <button
                        onClick={addLaborItem}
                        disabled={!newLaborItem}
                        className="bg-amber-800/50 hover:bg-amber-700/60 disabled:opacity-40 text-amber-200 px-3 py-2 rounded text-sm font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Custom labor item */}
                    {!showCustomLabor ? (
                      <button
                        onClick={() => setShowCustomLabor(true)}
                        className="flex items-center text-amber-500/50 hover:text-amber-400 text-xs mt-2 transition-colors"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add custom labor item
                      </button>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <input
                          value={customLaborText}
                          onChange={e => setCustomLaborText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addCustomLabor()}
                          placeholder="Custom item description..."
                          className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300 focus:border-amber-500 focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={addCustomLabor}
                          disabled={!customLaborText.trim()}
                          className="bg-amber-800/50 hover:bg-amber-700/60 disabled:opacity-40 text-amber-200 px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setShowCustomLabor(false); setCustomLaborText(''); }}
                          className="text-slate-500 hover:text-slate-300 transition-colors px-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Roof Measurements Reference (collapsible) ─────────── */}
                  {result.extractedData && (
                    <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden">
                      <button
                        onClick={() => setShowMeasurements(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-800/40 transition-colors"
                      >
                        <span className="text-slate-400 text-sm font-medium">Roof Measurements (EagleView Reference)</span>
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showMeasurements ? 'rotate-90' : ''}`} />
                      </button>
                      {showMeasurements && (
                        <div className="px-5 pb-4 pt-1 grid grid-cols-2 gap-x-8 border-t border-slate-800">
                          {[
                            ['Squares', result.extractedData.squares],
                            ['Pitch', result.extractedData.pitch],
                            ['Ridges', `${result.extractedData.ridges || 0} ft`],
                            ['Hips', `${result.extractedData.hips || 0} ft`],
                            ['Valleys', `${result.extractedData.valleys || 0} ft`],
                            ['Rakes', `${result.extractedData.rakes || 0} ft`],
                            ['Eaves', `${result.extractedData.eaves || 0} ft`],
                            ['Ventilation', result.extractedData.ventilationStrategy],
                            ['Pipe Boots', result.extractedData.pipeBoots || 0],
                            ['Skylights', result.extractedData.skylightCount || (result.extractedData.hasSkylights ? 'Yes' : 'No')],
                            ['Chimney', result.extractedData.hasChimney ? 'Yes' : 'No'],
                            ['Side Walls', result.extractedData.sidewallLF ? `${result.extractedData.sidewallLF} ft` : 'N/A'],
                          ].map(([label, value]) => (
                            <div key={String(label)} className="flex justify-between py-1 text-sm">
                              <span className="text-slate-500">{label}</span>
                              <span className="text-slate-300 font-medium">{value ?? 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Action bar ────────────────────────────────────────────── */}
                <div className="mt-6 space-y-3">
                  {actionStatus && (
                    <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${actionStatus.type === 'success' ? 'bg-emerald-900/40 border border-emerald-600/40 text-emerald-300' : 'bg-red-900/40 border border-red-600/40 text-red-300'}`}>
                      {actionStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
                      {actionStatus.msg}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 text-center bg-slate-900/50 p-2 rounded-lg">
                    Job data auto-purges in 10 minutes. Edit values above, then regenerate to update the PDF.
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      onClick={() => doAction(false)}
                      disabled={regenerating || resending}
                      className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-5 py-2.5 rounded-lg font-bold flex items-center text-sm transition-all shadow-md shadow-blue-900/40"
                    >
                      {regenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Regenerate PDF
                    </button>
                    <button
                      onClick={() => doAction(true)}
                      disabled={regenerating || resending}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-5 py-2.5 rounded-lg font-bold flex items-center text-sm transition-all shadow-md shadow-emerald-900/40"
                    >
                      {resending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Regenerate & Send
                    </button>
                    <button
                      onClick={() => {
                        if (result?.pdfBase64) {
                          const link = document.createElement('a');
                          link.href = `data:application/pdf;base64,${result.pdfBase64}`;
                          link.download = `Roof_Auto_Order_${formData.customerName.replace(/\s+/g, '_')}.pdf`;
                          link.click();
                        }
                      }}
                      className="bg-slate-600 hover:bg-slate-500 px-5 py-2.5 rounded-lg font-bold flex items-center text-sm transition-all"
                    >
                      <Download className="w-4 h-4 mr-2" /> Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setStep(1);
                        setFormData({ customerName: '', address: '', email: 'cheryl@therelexgroup.com', notes: '' });
                        setFiles([]);
                        setResult(null);
                        setEditMaterials(null);
                        setEditInstructions([]);
                        setEditLabor([]);
                        setEditNotes([]);
                        setActionStatus(null);
                        setShowMeasurements(false);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-lg font-bold text-sm transition-all"
                    >
                      New Job
                    </button>
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
