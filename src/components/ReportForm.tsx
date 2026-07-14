import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRightLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  FileText, 
  User, 
  Hash, 
  Calendar,
  Warehouse,
  Store,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Location, ProductVariety, StockLevel, Transaction, TransactionType } from '../types';

interface ReportFormProps {
  locations: Location[];
  varieties: ProductVariety[];
  stock: StockLevel[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  isEditor?: boolean;
}

export default function ReportForm({
  locations,
  varieties,
  stock,
  onAddTransaction,
  isEditor = false
}: ReportFormProps) {
  // Form type
  const [txType, setTxType] = useState<TransactionType>('transfer');
  
  // Selection
  const [selectedVarietyId, setSelectedVarietyId] = useState<string>('');
  const [fromLocId, setFromLocId] = useState<string>('');
  const [toLocId, setToLocId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [workerName, setWorkerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Auto-set selections on mount or type change
  useEffect(() => {
    if (varieties.length > 0 && !selectedVarietyId) {
      setSelectedVarietyId(varieties[0].id);
    }
  }, [varieties, selectedVarietyId]);

  useEffect(() => {
    // Default locations based on transaction type
    const whs = locations.filter(l => l.type === 'warehouse');
    const sts = locations.filter(l => l.type === 'store');

    if (txType === 'transfer') {
      if (whs.length > 0) setFromLocId(whs[0].id);
      if (sts.length > 0) setToLocId(sts[0].id);
    } else if (txType === 'receive') {
      setFromLocId('');
      if (whs.length > 0) setToLocId(whs[0].id);
    } else if (txType === 'adjustment') {
      if (sts.length > 0) setFromLocId(sts[0].id);
      setToLocId('');
    }
    
    // Clear alerts
    setWarningMessage(null);
  }, [txType, locations]);

  // Selected SKU helper
  const activeVariety = varieties.find(v => v.id === selectedVarietyId);

  // Watch stock levels to warn user
  const getStockAtLocation = (varId: string, locId: string) => {
    return stock.find(s => s.varietyId === varId && s.locationId === locId)?.quantity || 0;
  };

  const currentAvailableStock = selectedVarietyId && fromLocId 
    ? getStockAtLocation(selectedVarietyId, fromLocId) 
    : 0;

  useEffect(() => {
    const inputQty = parseInt(qty, 10);
    if (isNaN(inputQty) || inputQty <= 0) {
      setWarningMessage(null);
      return;
    }

    if (txType === 'transfer' && fromLocId) {
      if (currentAvailableStock < inputQty) {
        const locName = locations.find(l => l.id === fromLocId)?.name || 'Source';
        setWarningMessage(
          `Alert: Only ${currentAvailableStock} units available at ${locName}. Proceeding will trigger a negative stock adjustment (-${inputQty - currentAvailableStock} units).`
        );
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  }, [qty, selectedVarietyId, fromLocId, txType, currentAvailableStock, locations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseInt(qty, 10);

    if (!selectedVarietyId || isNaN(parsedQty) || parsedQty <= 0 || !workerName.trim()) {
      setErrorMessage('Validation Error: Please fill in all required fields (Product Variety, Quantity, and Worker Name).');
      return;
    }

    if (txType === 'transfer' && !toLocId) {
      setErrorMessage('Validation Error: Please specify a destination location for the transfer.');
      return;
    }

    if ((txType === 'transfer' || txType === 'adjustment') && !fromLocId) {
      setErrorMessage('Validation Error: Please specify a source/active location.');
      return;
    }

    if (txType === 'receive' && !toLocId) {
      setErrorMessage('Validation Error: Please specify a destination warehouse.');
      return;
    }

    setErrorMessage(null);

    const variety = varieties.find(v => v.id === selectedVarietyId);
    if (!variety) return;

    // Adjust quantity direction depending on tx type
    // Transfer: positive quantity, but backend moves it (source gets -qty, dest gets +qty)
    // Receive: positive input, adds to toLocationId
    // Adjustment: represents a low-stock alert request, so we set finalQty to 0 (no immediate stock change)
    let finalQty = parsedQty;
    let customNotes = notes.trim();

    if (txType === 'adjustment') {
      finalQty = 0; // Does not change stock level directly; simply alerts the admin
      const locName = locations.find(l => l.id === fromLocId)?.name || 'Store';
      customNotes = `[LOW STOCK ALERT] Worker reported that ${locName} is low or out of stock of this item. Requesting replenishment of ${parsedQty} units. ${customNotes}`.trim();
    }

    onAddTransaction({
      type: txType,
      sku: variety.sku,
      varietyId: variety.id,
      productId: variety.productId,
      varietyName: variety.varietyName,
      productName: variety.productName,
      fromLocationId: fromLocId || undefined,
      toLocationId: toLocId || undefined,
      quantity: finalQty,
      reportedBy: workerName.trim(),
      notes: customNotes || undefined,
      costPrice: variety.costPrice,
      sellingPrice: variety.sellingPrice,
      timestamp: customDate ? new Date(customDate).toISOString() : undefined
    });

    // Success alert
    const typeWord = txType === 'transfer' ? 'Transfer' : txType === 'receive' ? 'Bulk Shipment' : 'Low Stock Alert';
    setSuccessMessage(`Success! Worker report for ${variety.sku} (${typeWord}) has been logged in real-time.`);
    
    // Reset Form fields (keep Worker name for rapid entry)
    setQty('');
    setNotes('');
    setCustomDate('');
    
    // Clear message after 4s
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="report-form-container">
      {/* Introduction Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5.5 w-5.5 text-indigo-600" />
          Worker Reports Entry Desk
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Since you do not run automated billing machines, use this ledger desk to log hand-written worker notes, warehouse transfers, direct-to-customer sales, or inbound supplier shipments.
        </p>
      </div>

      {/* Read-Only Mode Warning Banner */}
      {!isEditor && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-amber-800 shadow-2xs" id="read-only-report-banner">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">Read-Only Mode:</span> Worker report logs submission is locked. Log in using an authorized Google Sign-In account (shreeanguarunachalam@gmail.com or surechuchi@gmail.com) in the left sidebar to log transactions.
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3"
          id="success-toast"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </motion.div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3"
          id="error-toast"
        >
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span className="text-xs font-semibold">{errorMessage}</span>
        </motion.div>
      )}

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Step 1: Transaction Type Panel */}
        <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs h-fit" id="report-type-column">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Select Report Type</h3>
          
          <button
            onClick={() => setTxType('transfer')}
            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
              txType === 'transfer'
                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 font-semibold'
                : 'border-slate-100 hover:border-slate-200 text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${txType === 'transfer' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50'}`}>
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Stock Transfer</p>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">Worker moved items warehouse → store</p>
            </div>
          </button>

          <button
            onClick={() => setTxType('adjustment')}
            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
              txType === 'adjustment'
                ? 'bg-amber-50/50 border-amber-200 text-amber-900 font-semibold'
                : 'border-slate-100 hover:border-slate-200 text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${txType === 'adjustment' ? 'bg-amber-100 text-amber-700' : 'bg-slate-50'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Report Store Low-Stock</p>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">Alert admin that store is out of stock</p>
            </div>
          </button>

          <button
            onClick={() => setTxType('receive')}
            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
              txType === 'receive'
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 font-semibold'
                : 'border-slate-100 hover:border-slate-200 text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${txType === 'receive' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50'}`}>
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold">Bulk Stock Inbound</p>
              <p className="text-[10px] text-slate-400 font-normal mt-0.5">Supplier delivered goods to warehouse</p>
            </div>
          </button>
        </div>

        {/* Step 2 & 3: Selection Details & Input Form */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5" id="worker-input-form">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">2. Transaction Logistics</h3>

            {/* SKU Variety Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" /> Select SKU / Variety
              </label>
              <select
                value={selectedVarietyId}
                onChange={(e) => setSelectedVarietyId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono"
                required
              >
                {varieties.map(v => {
                  const total = stock.filter(s => s.varietyId === v.id).reduce((sum, s) => sum + s.quantity, 0);
                  return (
                    <option key={v.id} value={v.id}>
                      [{v.sku}] {v.productName} — {v.varietyName} (Stock: {total} pcs)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick stock feedback card */}
            {activeVariety && (
              <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Active Variety Prices</p>
                  <p className="text-slate-800 font-medium mt-1">
                    Cost: <span className="font-mono text-slate-600">${activeVariety.costPrice.toFixed(2)}</span> | Retail Sell: <span className="font-mono font-bold text-indigo-600">${activeVariety.sellingPrice.toFixed(2)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Overall Net Stock</p>
                  <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                    {stock.filter(s => s.varietyId === activeVariety.id).reduce((sum, s) => sum + s.quantity, 0)} pcs
                  </p>
                </div>
              </div>
            )}

            {/* Location selection row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FROM Location (Source) */}
              {(txType === 'transfer' || txType === 'adjustment') && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    {txType === 'transfer' ? <Warehouse className="h-3.5 w-3.5 text-orange-500" /> : <Store className="h-3.5 w-3.5 text-emerald-500" />}
                    {txType === 'transfer' ? 'Source Warehouse (From)' : 'Reporting Store (Low Stock)'}
                  </label>
                  <select
                    value={fromLocId}
                    onChange={(e) => setFromLocId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                    required
                  >
                    <option value="">-- Choose Location --</option>
                    {locations
                      .filter(l => {
                        if (txType === 'transfer') return l.type === 'warehouse'; // transfers usually go from WH
                        if (txType === 'adjustment') return l.type === 'store'; // low stock alerts are for stores
                        return true;
                      })
                      .map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} (Available: {getStockAtLocation(selectedVarietyId, loc.id)} pcs)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* TO Location (Destination) */}
              {(txType === 'transfer' || txType === 'receive') && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    {txType === 'transfer' ? <Store className="h-3.5 w-3.5 text-emerald-500" /> : <Warehouse className="h-3.5 w-3.5 text-orange-500" />}
                    {txType === 'transfer' ? 'Destination Store (To)' : 'Receiving Warehouse'}
                  </label>
                  <select
                    value={toLocId}
                    onChange={(e) => setToLocId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                    required
                  >
                    <option value="">-- Choose Location --</option>
                    {locations
                      .filter(l => {
                        if (txType === 'transfer') return l.type === 'store'; // transfer destination is store
                        if (txType === 'receive') return l.type === 'warehouse'; // supplier receives go to WH
                        return true;
                      })
                      .map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} (Current: {getStockAtLocation(selectedVarietyId, loc.id)} pcs)
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quantity and Reporter Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Item Quantity (pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-indigo-500" /> Worker Name (Reporter)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Worker John"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Custom Timestamp Optional */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Backdate Entry (Optional)
              </label>
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Leave empty to timestamp with the exact current time.</p>
            </div>

            {/* Notes / Worker comments */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Worker Logs / Explanatory Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Workers transferred 10 units via delivery van #2. Confirmed and signed."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white resize-none"
              />
            </div>

            {/* Stock Level warnings warnings */}
            {warningMessage && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-amber-800 leading-relaxed">{warningMessage}</p>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isEditor}
                className={`w-full font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                  isEditor 
                    ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> {isEditor ? "Log Worker Report to Ledger" : "Submission Restricted (Read-Only Mode)"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
