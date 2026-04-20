"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ArrowLeft, Settings } from "lucide-react";

export default function FormulaEngine() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/formulas')
      .then(r => r.json())
      .then(d => {
        if (d.success) setConfig(d.config);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/formulas', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      if (res.ok) setMessage('Formulas updated successfully!');
    } catch {
      setMessage('Error updating formulas.');
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <a href="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-4 transition">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </a>
            <h1 className="text-3xl font-bold flex items-center"><Settings className="mr-3 text-emerald-400"/> Formula Engine</h1>
            <p className="text-slate-400 mt-2">Adjust ordering constants. Updates apply dynamically to all future jobs without involving a developer.</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-3 rounded-lg font-bold flex items-center transition shadow-lg shadow-emerald-900/50">
            {saving ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Changes
          </button>
        </div>

        {message && <div className="bg-emerald-900/50 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded mb-6">{message}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Felt Underlayment</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-slate-300 font-medium">Enable Calculation</span>
               <input type="checkbox" checked={config.enableFelt} onChange={e => setConfig({...config, enableFelt: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </div>
            <label className="block text-sm text-slate-400 mb-1">Squares covered per Roll</label>
            <input type="number" value={config.feltCoverage} onChange={e => setConfig({...config, feltCoverage: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white outline-none focus:border-blue-500" />
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Ice & Water Shield</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-slate-300 font-medium">Enable Calculation</span>
               <input type="checkbox" checked={config.enableIceWater} onChange={e => setConfig({...config, enableIceWater: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </div>
            <label className="block text-sm text-slate-400 mb-1">Linear Ft covered per Roll</label>
            <input type="number" value={config.iceWaterCoverage} onChange={e => setConfig({...config, iceWaterCoverage: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white outline-none focus:border-blue-500" />
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Ridge Cap Shingles</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-slate-300 font-medium">Enable Calculation</span>
               <input type="checkbox" checked={config.enableRidgeCap} onChange={e => setConfig({...config, enableRidgeCap: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </div>
            <label className="block text-sm text-slate-400 mb-1">Linear Ft covered per Bundle</label>
            <input type="number" value={config.ridgeCapCoverage} onChange={e => setConfig({...config, ridgeCapCoverage: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white outline-none focus:border-blue-500" />
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Drip Edge</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-slate-300 font-medium">Enable Calculation</span>
               <input type="checkbox" checked={config.enableDripEdge} onChange={e => setConfig({...config, enableDripEdge: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </div>
            <label className="block text-sm text-slate-400 mb-1">Length per piece (Ft)</label>
            <input type="number" value={config.dripEdgeLength} onChange={e => setConfig({...config, dripEdgeLength: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white outline-none focus:border-blue-500" />
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors md:col-span-2">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Coil Nails</h2>
            <div className="flex items-center justify-between mb-4">
               <span className="text-slate-300 font-medium">Enable Calculation</span>
               <input type="checkbox" checked={config.enableCoilNails} onChange={e => setConfig({...config, enableCoilNails: e.target.checked})} className="w-5 h-5 accent-blue-500" />
            </div>
            <label className="block text-sm text-slate-400 mb-1">Squares covered per Box</label>
            <input type="number" value={config.coilNailsCoverage} onChange={e => setConfig({...config, coilNailsCoverage: Number(e.target.value)})} className="w-1/2 bg-slate-900 border border-slate-600 rounded p-3 text-white outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
