"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Save, ArrowLeft, Settings, AlertTriangle,
  RotateCcw, CheckCircle, Info,
} from "lucide-react";
import { DEFAULTS, type FormulaConfig } from "@/lib/formulas";

// ── Sub-components ────────────────────────────────────────────────────────

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-300 text-sm font-medium">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function NumField({
  label, desc, value, unit, onChange, step = 1, min = 0, max,
}: {
  label: string; desc?: string; value: number; unit: string;
  onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  return (
    <div className="py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-slate-300 text-sm">{label}</span>
          {desc && <p className="text-slate-500 text-xs mt-0.5 leading-snug">{desc}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number"
            value={value}
            step={step}
            min={min}
            max={max}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(v);
            }}
            className="w-24 bg-slate-900 border border-slate-600 rounded-md px-2.5 py-1.5 text-white text-sm text-right focus:border-blue-500 focus:outline-none transition-colors"
          />
          <span className="text-slate-500 text-xs w-16">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function PctField({
  label, desc, value, onChange,
}: { label: string; desc?: string; value: number; onChange: (v: number) => void }) {
  return (
    <NumField
      label={label}
      desc={desc}
      value={parseFloat((value * 100).toFixed(4))}
      unit="% waste"
      step={0.5}
      min={0}
      max={100}
      onChange={v => onChange(parseFloat((v / 100).toFixed(6)))}
    />
  );
}

function Section({
  title, color, children,
}: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`bg-slate-800 rounded-xl border ${color} overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${color} bg-slate-800/80`}>
        <h2 className="font-bold text-sm uppercase tracking-wide text-slate-200">{title}</h2>
      </div>
      <div className="px-5 py-1 divide-y divide-slate-800/0">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function FormulaEngine() {
  const [config, setConfig] = useState<FormulaConfig>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warn'; msg: string } | null>(null);
  const [fetchError, setFetchError] = useState('');

  const set = (key: keyof FormulaConfig, value: any) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    fetch('/api/formulas')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.config) {
          setConfig({ ...DEFAULTS, ...d.config });
        } else {
          setFetchError('Could not load saved formulas — showing defaults.');
        }
        setLoading(false);
      })
      .catch(() => {
        setFetchError('Could not connect to the API — showing defaults.');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/formulas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const d = await res.json();
      if (!res.ok) {
        setStatus({ type: 'error', msg: d.error || 'Save failed.' });
      } else if (d.warning) {
        setStatus({ type: 'warn', msg: d.warning });
        setFetchError('');
      } else {
        setStatus({ type: 'success', msg: 'All formula settings saved successfully.' });
        setFetchError('');
      }
    } catch {
      setStatus({ type: 'error', msg: 'Network error — could not save.' });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setConfig({ ...DEFAULTS });
    setStatus({ type: 'warn', msg: 'Reset to defaults — click Save to persist.' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-lg">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <a href="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 text-sm mb-1 transition">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </a>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <Settings className="text-emerald-400 w-6 h-6" /> Formula Engine
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 rounded-lg font-bold text-sm transition shadow-lg shadow-emerald-900/40"
            >
              {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
              Save All
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-4">
        {/* Alerts */}
        {fetchError && (
          <div className="flex items-start gap-3 bg-yellow-900/30 border border-yellow-600/40 text-yellow-200 px-4 py-3 rounded-xl text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> {fetchError}
          </div>
        )}
        {status && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border ${
            status.type === 'success' ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-200' :
            status.type === 'error'   ? 'bg-red-900/30 border-red-600/40 text-red-200' :
                                        'bg-yellow-900/30 border-yellow-600/40 text-yellow-200'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> :
             status.type === 'error'   ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> :
                                          <Info className="w-5 h-5 shrink-0 mt-0.5" />}
            {status.msg}
          </div>
        )}

        <p className="text-slate-400 text-sm">
          Changes apply to all future jobs. Use <strong className="text-white">Reset Defaults</strong> to restore factory values, then <strong className="text-white">Save All</strong> to persist.
        </p>

        {/* ── Two-column grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Field Shingles ─────────────────────────────────────────── */}
          <Section title="Field Shingles" color="border-blue-800/60">
            <PctField
              label="Waste Factor"
              desc="Added on top of measured squares. Industry standard is 10%."
              value={config.shinglesWasteFactor}
              onChange={v => set('shinglesWasteFactor', v)}
            />
          </Section>

          {/* ── Starter Strip ──────────────────────────────────────────── */}
          <Section title="Starter Strip" color="border-blue-800/60">
            <NumField
              label="Minimum Bundles"
              desc="Floor — order at least this many regardless of measurements."
              value={config.starterStripMinBundles}
              unit="bundles"
              onChange={v => set('starterStripMinBundles', Math.max(1, Math.round(v)))}
            />
            <NumField
              label="Coverage per Bundle"
              desc="Linear feet of eave + rake covered by one bundle."
              value={config.starterStripLFPerBundle}
              unit="LF / bundle"
              onChange={v => set('starterStripLFPerBundle', v)}
            />
          </Section>

          {/* ── Synthetic Underlayment ─────────────────────────────────── */}
          <Section title="Synthetic Underlayment" color="border-sky-800/60">
            <Toggle label="Enable Calculation" checked={config.enableFelt} onChange={v => set('enableFelt', v)} />
            <NumField
              label="Coverage per Roll"
              desc="Squares covered by one roll of synthetic underlayment."
              value={config.feltCoverage}
              unit="SQ / roll"
              onChange={v => set('feltCoverage', v)}
            />
            <PctField
              label="Waste Factor"
              desc="Overlap and cut waste. 5% is standard for synthetic."
              value={config.feltWasteFactor}
              onChange={v => set('feltWasteFactor', v)}
            />
          </Section>

          {/* ── Ice & Water Shield ─────────────────────────────────────── */}
          <Section title="Ice & Water Shield" color="border-cyan-800/60">
            <Toggle label="Enable Calculation" checked={config.enableIceWater} onChange={v => set('enableIceWater', v)} />
            <NumField
              label="Roll Size"
              desc="Square footage per roll (standard Grace/Certainteed roll = 200 sqft)."
              value={config.iceWaterSqFtPerRoll}
              unit="sqft / roll"
              onChange={v => set('iceWaterSqFtPerRoll', v)}
            />
            <NumField
              label="Eave Coverage Width"
              desc="How far up from the eave IWS is applied (when required by code or climate)."
              value={config.iceWaterEaveWidth}
              unit="ft wide"
              step={0.5}
              onChange={v => set('iceWaterEaveWidth', v)}
            />
            <NumField
              label="Valley Coverage Width"
              desc="Width of IWS on each side of a valley line."
              value={config.iceWaterValleyWidth}
              unit="ft wide"
              step={0.5}
              onChange={v => set('iceWaterValleyWidth', v)}
            />
            <NumField
              label="Per Skylight"
              desc="Square footage of IWS added around each skylight unit."
              value={config.iceWaterSkylightSqFt}
              unit="sqft each"
              onChange={v => set('iceWaterSkylightSqFt', v)}
            />
            <NumField
              label="Per Chimney"
              desc="Square footage of IWS added around a chimney."
              value={config.iceWaterChimneySqFt}
              unit="sqft"
              onChange={v => set('iceWaterChimneySqFt', v)}
            />
            <NumField
              label="Per Pipe Penetration"
              desc="Square footage added per pipe boot / pipe jack penetration."
              value={config.iceWaterPipeBootSqFt}
              unit="sqft each"
              onChange={v => set('iceWaterPipeBootSqFt', v)}
            />
            <PctField
              label="Overlap / Waste Factor"
              desc="12% covers seam laps and cut waste."
              value={config.iceWaterWasteFactor}
              onChange={v => set('iceWaterWasteFactor', v)}
            />
          </Section>

          {/* ── Hip & Ridge Cap ────────────────────────────────────────── */}
          <Section title="Hip & Ridge Cap Shingles" color="border-violet-800/60">
            <Toggle label="Enable Calculation" checked={config.enableRidgeCap} onChange={v => set('enableRidgeCap', v)} />
            <NumField
              label="Coverage per Bundle"
              desc="Linear feet of ridge or hip covered by one bundle."
              value={config.ridgeCapCoverage}
              unit="LF / bundle"
              onChange={v => set('ridgeCapCoverage', v)}
            />
            <PctField
              label="Waste Factor"
              desc="Cut waste at hips and ridge ends. 30% is standard."
              value={config.ridgeCapWasteFactor}
              onChange={v => set('ridgeCapWasteFactor', v)}
            />
          </Section>

          {/* ── Drip Edge ──────────────────────────────────────────────── */}
          <Section title="Drip Edge" color="border-indigo-800/60">
            <Toggle label="Enable Calculation" checked={config.enableDripEdge} onChange={v => set('enableDripEdge', v)} />
            <NumField
              label="Piece Length"
              desc="Length of a single drip edge piece. Most are 10 ft."
              value={config.dripEdgeLength}
              unit="ft / piece"
              onChange={v => set('dripEdgeLength', v)}
            />
            <PctField
              label="Overlap / Waste Factor"
              desc="Each piece overlaps the next. 30% accounts for corners and ends."
              value={config.dripEdgeOverlapFactor}
              onChange={v => set('dripEdgeOverlapFactor', v)}
            />
          </Section>

          {/* ── Step Flashing ──────────────────────────────────────────── */}
          <Section title="Step Flashing" color="border-purple-800/60">
            <NumField
              label="Pieces per LF of Sidewall"
              desc="At 5&quot; exposure per course: 12&quot; ÷ 5&quot; = 2.4 pieces per LF."
              value={config.stepFlashingPcsPerLF}
              unit="pcs / LF"
              step={0.1}
              onChange={v => set('stepFlashingPcsPerLF', v)}
            />
            <NumField
              label="Pieces per Bundle"
              desc="Number of step flashing pieces in one bundle."
              value={config.stepFlashingPcsPerBundle}
              unit="pcs / bundle"
              onChange={v => set('stepFlashingPcsPerBundle', Math.max(1, Math.round(v)))}
            />
          </Section>

          {/* ── Valley Metal ───────────────────────────────────────────── */}
          <Section title="Valley Metal" color="border-teal-800/60">
            <NumField
              label="LF per Roll"
              desc="Length of a standard valley metal roll (20&quot; × 50′ = 50 LF)."
              value={config.valleyMetalLFPerRoll}
              unit="LF / roll"
              onChange={v => set('valleyMetalLFPerRoll', v)}
            />
          </Section>

          {/* ── Ridge Vent ─────────────────────────────────────────────── */}
          <Section title="Ridge Vent" color="border-teal-800/60">
            <NumField
              label="Section Length"
              desc="Length of one ridge vent piece/section."
              value={config.ridgeVentSectionLF}
              unit="ft / section"
              step={0.5}
              onChange={v => set('ridgeVentSectionLF', v)}
            />
          </Section>

          {/* ── Touch-Up Paint ─────────────────────────────────────────── */}
          <Section title="Touch-Up Paint" color="border-orange-800/60">
            <NumField
              label="Base Cans (any metal)"
              desc="Cans ordered whenever any metal is present on the job."
              value={config.touchUpPaintBase}
              unit="cans"
              onChange={v => set('touchUpPaintBase', Math.max(0, Math.round(v)))}
            />
            <NumField
              label="Additional Cans (complex flashing)"
              desc="Extra cans added when step flashing, counter flashing, or valley metal are included."
              value={config.touchUpPaintAdditional}
              unit="cans"
              onChange={v => set('touchUpPaintAdditional', Math.max(0, Math.round(v)))}
            />
          </Section>

          {/* ── Coil Nails ─────────────────────────────────────────────── */}
          <Section title={'Coil Nails 1-1/4"'} color="border-slate-600/60">
            <Toggle label="Enable Calculation" checked={config.enableCoilNails} onChange={v => set('enableCoilNails', v)} />
            <NumField
              label="SQ per Case"
              desc="How many squares one case of coil nails covers."
              value={config.coilNailsCoverage}
              unit="SQ / case"
              onChange={v => set('coilNailsCoverage', v)}
            />
          </Section>

          {/* ── Cap Nails ──────────────────────────────────────────────── */}
          <Section title="Cap Nails (Plastic)" color="border-slate-600/60">
            <NumField
              label="Small Job Threshold"
              desc="Jobs at or below this square count get the small-job box count."
              value={config.capNailsThreshold}
              unit="SQ"
              onChange={v => set('capNailsThreshold', v)}
            />
            <NumField
              label="Boxes — Small Job (≤ threshold)"
              value={config.capNailsSmallJob}
              unit="boxes"
              onChange={v => set('capNailsSmallJob', Math.max(1, Math.round(v)))}
            />
            <NumField
              label="Boxes — Large Job (> threshold)"
              value={config.capNailsLargeJob}
              unit="boxes"
              onChange={v => set('capNailsLargeJob', Math.max(1, Math.round(v)))}
            />
          </Section>

          {/* ── Geocel 2300 Sealant ────────────────────────────────────── */}
          <Section title="Geocel 2300 Sealant" color="border-amber-800/60">
            <NumField
              label="Minimum Tubes"
              desc="Floor — always order at least this many tubes per job."
              value={config.sealantMinTubes}
              unit="tubes"
              onChange={v => set('sealantMinTubes', Math.max(1, Math.round(v)))}
            />
            <NumField
              label="Valley LF per Tube"
              desc="Linear feet of valley each tube seals."
              value={config.sealantValleyLFPerTube}
              unit="LF / tube"
              onChange={v => set('sealantValleyLFPerTube', v)}
            />
            <NumField
              label="Ridge + Hip LF per Tube"
              desc="Linear feet of ridge/hip each tube seals."
              value={config.sealantRidgeHipLFPerTube}
              unit="LF / tube"
              onChange={v => set('sealantRidgeHipLFPerTube', v)}
            />
          </Section>

          {/* ── Mule-Hide JTS1 ─────────────────────────────────────────── */}
          <Section title="Mule-Hide JTS1 Joint Sealant" color="border-amber-800/60">
            <NumField
              label="Valley LF per Tube"
              desc="Linear feet of valley each tube of Mule-Hide JTS1 seals."
              value={config.muleHideLFPerTube}
              unit="LF / tube"
              onChange={v => set('muleHideLFPerTube', v)}
            />
          </Section>

          {/* ── OSB Sheathing ──────────────────────────────────────────── */}
          <Section title="OSB Sheathing (Vent Removal)" color="border-red-800/60">
            <NumField
              label="Sheets per Vent Removed"
              desc="7/16&quot; OSB sheets needed to patch each turtle/box vent hole when switching to ridge vent."
              value={config.osbSheetsPerVent}
              unit="sheets / vent"
              onChange={v => set('osbSheetsPerVent', Math.max(1, Math.round(v)))}
            />
          </Section>

        </div>

        {/* ── Schema migration note ──────────────────────────────────── */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Database note:</strong> Extended settings (everything except Underlayment Coverage, Ridge Cap Coverage, Drip Edge Length, Coil Nails Coverage, and enable toggles) are stored in an{' '}
          <code className="text-slate-300 bg-slate-900 px-1 rounded">extra_config JSONB</code> column.
          If settings fail to save, run this once in your Supabase SQL editor:
          <br />
          <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded mt-1 inline-block">
            ALTER TABLE formula_config ADD COLUMN IF NOT EXISTS extra_config JSONB DEFAULT {'\'{}\''}::jsonb;
          </code>
        </div>
      </div>
    </div>
  );
}
