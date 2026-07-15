import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Package,
  FolderOpen,
  RefreshCw,
  Search,
  History,
  IndianRupee
} from 'lucide-react';
import { Location, ProductVariety, StockLevel, Transaction, TransactionType } from '../types';

interface ReportFormProps {
  locations: Location[];
  varieties: ProductVariety[];
  stock: StockLevel[];
  transactions?: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  isEditor?: boolean;
}

export default function ReportForm({
  locations,
  varieties,
  stock,
  transactions = [],
  onAddTransaction,
  isEditor = false
}: ReportFormProps) {
  // Navigation sub-tab state
  const [subTab, setSubTab] = useState<'single' | 'bulk'>('single');

  // Form type
  const [txType, setTxType] = useState<TransactionType>('transfer');
  
  // Custom variety searchable dropdown states
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Selection
  const [selectedVarietyId, setSelectedVarietyId] = useState<string>('');
  const [fromLocId, setFromLocId] = useState<string>('');
  const [toLocId, setToLocId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [workerName, setWorkerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');

  // Bulk Transfer states
  const [bulkFromLocId, setBulkFromLocId] = useState<string>('');
  const [bulkToLocId, setBulkToLocId] = useState<string>('');
  const [bulkMode, setBulkMode] = useState<'category' | 'variety'>('category');
  const [selectedBulkCategory, setSelectedBulkCategory] = useState<string>('');
  const [selectedBulkVarietyId, setSelectedBulkVarietyId] = useState<string>('');
  const [bulkWorkerName, setBulkWorkerName] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [isProcessingBulk, setIsProcessingBulk] = useState<boolean>(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>('');
  const [bulkDropdownOpen, setBulkDropdownOpen] = useState<boolean>(false);

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // past reports logs filter/search states
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'receive' | 'transfer' | 'sale' | 'adjustment'>('all');

  const filteredLogs = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter(tx => {
        if (logTypeFilter !== 'all' && tx.type !== logTypeFilter) return false;
        
        const q = logSearchQuery.toLowerCase().trim();
        if (!q) return true;

        return (
          tx.sku.toLowerCase().includes(q) ||
          tx.productName.toLowerCase().includes(q) ||
          tx.varietyName.toLowerCase().includes(q) ||
          tx.reportedBy.toLowerCase().includes(q) ||
          (tx.notes && tx.notes.toLowerCase().includes(q))
        );
      });
  }, [transactions, logSearchQuery, logTypeFilter]);

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

  // Get all unique categories
  const categories = Array.from(new Set(varieties.map(v => v.category)));

  // Pre-fill bulk default states
  useEffect(() => {
    if (categories.length > 0 && !selectedBulkCategory) {
      setSelectedBulkCategory(categories[0]);
    }
    if (varieties.length > 0 && !selectedBulkVarietyId) {
      setSelectedBulkVarietyId(varieties[0].id);
    }
    const whs = locations.filter(l => l.type === 'warehouse');
    const sts = locations.filter(l => l.type === 'store');
    if (whs.length > 0 && !bulkFromLocId) {
      setBulkFromLocId(whs[0].id);
    }
    if (sts.length > 0 && !bulkToLocId) {
      setBulkToLocId(sts[0].id);
    }
  }, [categories, varieties, locations, bulkFromLocId, bulkToLocId, selectedBulkCategory, selectedBulkVarietyId]);

  // Filtered varieties for normal single selection search
  const filteredVarieties = React.useMemo(() => {
    return varieties.filter(v => 
      v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.varietyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [varieties, searchQuery]);

  // Filtered varieties for bulk selection search
  const filteredBulkVarieties = React.useMemo(() => {
    return varieties.filter(v => 
      v.sku.toLowerCase().includes(bulkSearchQuery.toLowerCase()) ||
      v.productName.toLowerCase().includes(bulkSearchQuery.toLowerCase()) ||
      v.varietyName.toLowerCase().includes(bulkSearchQuery.toLowerCase())
    );
  }, [varieties, bulkSearchQuery]);

  // Compute what items will be transferred in bulk mode
  const bulkItemsToTransfer = React.useMemo(() => {
    if (!bulkFromLocId) return [];
    
    return varieties.filter(v => {
      // Must match category or variety
      if (bulkMode === 'category') {
        if (v.category !== selectedBulkCategory) return false;
      } else {
        if (v.id !== selectedBulkVarietyId) return false;
      }
      
      // Must have positive stock at source
      const qty = stock.find(s => s.varietyId === v.id && s.locationId === bulkFromLocId)?.quantity || 0;
      return qty > 0;
    }).map(v => {
      const qty = stock.find(s => s.varietyId === v.id && s.locationId === bulkFromLocId)?.quantity || 0;
      return {
        ...v,
        quantity: qty
      };
    });
  }, [bulkFromLocId, bulkMode, selectedBulkCategory, selectedBulkVarietyId, varieties, stock]);

  const bulkTotalQuantity = React.useMemo(() => {
    return bulkItemsToTransfer.reduce((sum, item) => sum + item.quantity, 0);
  }, [bulkItemsToTransfer]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bulkFromLocId || !bulkToLocId || !bulkWorkerName.trim()) {
      setErrorMessage('Validation Error: Please fill in all required fields (Source Location, Destination Location, and Worker Name).');
      return;
    }

    if (bulkFromLocId === bulkToLocId) {
      setErrorMessage('Validation Error: Source and Destination locations must be different.');
      return;
    }

    if (bulkItemsToTransfer.length === 0) {
      setErrorMessage('Validation Error: No stock items found at the source location matching your selection to transfer.');
      return;
    }

    setIsProcessingBulk(true);
    setErrorMessage(null);

    try {
      // Loop and add transaction for each matching item with stock
      for (const item of bulkItemsToTransfer) {
        onAddTransaction({
          type: 'transfer',
          sku: item.sku,
          varietyId: item.id,
          productId: item.productId,
          varietyName: item.varietyName,
          productName: item.productName,
          fromLocationId: bulkFromLocId,
          toLocationId: bulkToLocId,
          quantity: item.quantity,
          reportedBy: bulkWorkerName.trim(),
          notes: bulkNotes.trim() 
            ? `[BULK TRANSFER] ${bulkNotes.trim()}`
            : `[BULK TRANSFER] Transferred entire stock of ${item.varietyName} (${item.quantity} pcs) from ${locations.find(l => l.id === bulkFromLocId)?.name} to ${locations.find(l => l.id === bulkToLocId)?.name}.`,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice
        });
      }

      const sourceName = locations.find(l => l.id === bulkFromLocId)?.name || 'Source';
      const destName = locations.find(l => l.id === bulkToLocId)?.name || 'Destination';
      
      setSuccessMessage(`Success! Bulk transferred ${bulkTotalQuantity} pcs across ${bulkItemsToTransfer.length} items from ${sourceName} to ${destName}.`);
      
      // Reset form
      setBulkNotes('');
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Error executing bulk transfer:', err);
      setErrorMessage('Error executing bulk transfer: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessingBulk(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="report-form-container">
      {/* Introduction Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5.5 w-5.5 text-indigo-600" />
          Worker Reports & Bulk Transfer Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Log hand-written worker notes, warehouse transfers, inbound shipments, or trigger bulk stock relocations of entire categories/varieties in real-time.
        </p>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex border-b border-slate-200" id="report-sub-tabs">
        <button
          onClick={() => setSubTab('single')}
          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            subTab === 'single'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Single SKU Transaction Report
        </button>
        <button
          onClick={() => setSubTab('bulk')}
          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            subTab === 'bulk'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Category / Variety Bulk Transfer Hub
        </button>
      </div>

      {/* Read-Only Mode Warning Banner */}
      {!isEditor && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-amber-800 shadow-2xs" id="read-only-report-banner">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">Read-Only Mode:</span> Worker report logs submission is locked. Log in using an authorized Google Sign-In account in the left sidebar to log transactions.
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

      {subTab === 'single' ? (
        /* SINGLE SKU TRANSACTION REPORT TAB */
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
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">2. Transaction Logistics</h3>

              {/* SKU Variety Selection Searchable Dropdown */}
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> Select SKU / Variety Style
                </label>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-left text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-medium flex items-center justify-between"
                  >
                    <span>
                      {activeVariety 
                        ? `[${activeVariety.sku}] ${activeVariety.productName} — ${activeVariety.varietyName}`
                        : '-- Choose SKU --'
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2">
                      <input
                        type="text"
                        placeholder="Type SKU code, name, or variety to search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                        autoFocus
                      />
                      <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                        {filteredVarieties.map(v => {
                          const total = stock.filter(s => s.varietyId === v.id).reduce((sum, s) => sum + s.quantity, 0);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedVarietyId(v.id);
                                setDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left p-2 hover:bg-slate-50 text-xs flex justify-between items-center"
                            >
                              <div className="min-w-0 pr-3">
                                <span className="font-mono font-bold text-indigo-600 block text-[11px]">{v.sku}</span>
                                <span className="text-slate-700 font-semibold block truncate">{v.productName} — {v.varietyName}</span>
                              </div>
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0 font-bold text-slate-600">
                                {total} pcs
                              </span>
                            </button>
                          );
                        })}
                        {filteredVarieties.length === 0 && (
                          <div className="text-center py-4 text-xs text-slate-400">
                            No matching variety SKUs found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick stock feedback card */}
              {activeVariety && (
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold">Active Variety Prices</p>
                    <p className="text-slate-800 font-medium mt-1">
                      Cost: <span className="font-mono text-slate-600">₹{activeVariety.costPrice.toFixed(2)}</span> | Retail Sell: <span className="font-mono font-bold text-indigo-600">₹{activeVariety.sellingPrice.toFixed(2)}</span>
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
                          if (txType === 'transfer') return l.type === 'warehouse';
                          if (txType === 'adjustment') return l.type === 'store';
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
                          if (txType === 'transfer') return l.type === 'store';
                          if (txType === 'receive') return l.type === 'warehouse';
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

              {/* Stock Level warnings */}
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
      ) : (
        /* CATEGORY / VARIETY BULK TRANSFER HUB TAB */
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <form onSubmit={handleBulkSubmit} className="space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600 animate-pulse" />
                  Bulk Stock Relocation Engine
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Relocate entire categories or variety styles completely from one location to another in 1-click.
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                Bulk Mode
              </span>
            </div>

            {/* Source & Destination Nodes select */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5 text-orange-500" /> Source Location (Transfer From)
                </label>
                <select
                  value={bulkFromLocId}
                  onChange={(e) => setBulkFromLocId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-medium"
                  required
                >
                  <option value="">-- Choose Source --</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Store className="h-3.5 w-3.5 text-emerald-500" /> Destination Location (Transfer To)
                </label>
                <select
                  value={bulkToLocId}
                  onChange={(e) => setBulkToLocId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-medium"
                  required
                >
                  <option value="">-- Choose Destination --</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Mode Type Selection (Category vs Specific Variety) */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Scope:
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setBulkMode('category')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    bulkMode === 'category'
                      ? 'border-indigo-600 bg-indigo-50/25'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <FolderOpen className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">By Category Group</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Move all products belonging to a category (e.g. Handbags)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBulkMode('variety')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    bulkMode === 'variety'
                      ? 'border-indigo-600 bg-indigo-50/25'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <Package className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">By Variety Style</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Move all units of a single style across this location</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Scope Parameter Selectors */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              {bulkMode === 'category' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Select Product Category
                  </label>
                  <select
                    value={selectedBulkCategory}
                    onChange={(e) => setSelectedBulkCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 relative">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Select Specific Variety Style</span>
                    <span className="text-[9px] text-slate-400 lowercase font-normal">searchable below</span>
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBulkDropdownOpen(!bulkDropdownOpen)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-left text-slate-800 focus:outline-hidden focus:border-indigo-500 font-medium flex items-center justify-between"
                    >
                      <span>
                        {varieties.find(v => v.id === selectedBulkVarietyId)
                          ? `[${varieties.find(v => v.id === selectedBulkVarietyId)?.sku}] ${varieties.find(v => v.id === selectedBulkVarietyId)?.productName} — ${varieties.find(v => v.id === selectedBulkVarietyId)?.varietyName}`
                          : '-- Choose Variety style --'
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </button>

                    {bulkDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2">
                        <input
                          type="text"
                          placeholder="Type SKU or variety to filter..."
                          value={bulkSearchQuery}
                          onChange={(e) => setBulkSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                          autoFocus
                        />
                        <div className="max-h-[180px] overflow-y-auto divide-y divide-slate-100">
                          {filteredBulkVarieties.map(v => {
                            const total = stock.filter(s => s.varietyId === v.id && s.locationId === bulkFromLocId).reduce((sum, s) => sum + s.quantity, 0);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedBulkVarietyId(v.id);
                                  setBulkDropdownOpen(false);
                                  setBulkSearchQuery('');
                                }}
                                className="w-full text-left p-2 hover:bg-slate-50 text-xs flex justify-between items-center"
                              >
                                <div className="min-w-0 pr-3">
                                  <span className="font-mono font-bold text-indigo-600 block text-[11px]">{v.sku}</span>
                                  <span className="text-slate-700 font-semibold block truncate">{v.productName} — {v.varietyName}</span>
                                </div>
                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0 font-bold text-slate-600">
                                  {total} at source
                                </span>
                              </button>
                            );
                          })}
                          {filteredBulkVarieties.length === 0 && (
                            <div className="text-center py-4 text-xs text-slate-400">
                              No matching variety SKUs found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live Bulk Items Preview Panel */}
            <div className="border border-indigo-100 bg-indigo-50/15 rounded-2xl p-4 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px]">
                  Ready to Transfer Preview:
                </span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2.5 py-0.5 rounded text-[11px]">
                  {bulkTotalQuantity} total pcs across {bulkItemsToTransfer.length} items
                </span>
              </div>

              {bulkItemsToTransfer.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No stock of this scope exists at the selected source location to transfer. Choose a different source location or scope!
                </p>
              ) : (
                <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {bulkItemsToTransfer.map(item => (
                    <div key={item.id} className="py-2 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-slate-500 mr-2">[{item.sku}]</span>
                        <span className="text-slate-700 font-semibold">{item.productName} ({item.varietyName})</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded">
                        {item.quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reporter & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-indigo-500" /> Worker Name (Reporter)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Worker John"
                  value={bulkWorkerName}
                  onChange={(e) => setBulkWorkerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Explanatory Notes / Comments
                </label>
                <input
                  type="text"
                  placeholder="e.g. Relocating entire handbag supply via delivery truck #3"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isEditor || isProcessingBulk || bulkItemsToTransfer.length === 0}
                className={`w-full font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                  isEditor && bulkItemsToTransfer.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white cursor-pointer' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {isProcessingBulk ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executing Bulk Transfer...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4" /> 
                    {isEditor 
                      ? `Execute Bulk Transfer (${bulkTotalQuantity} pcs)` 
                      : "Submission Restricted (Read-Only Mode)"
                    }
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Searchable Log Worker Activity Reports Ledger */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-5" id="log-worker-ledger">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Log Worker Activity Reports Ledger</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Search and review historically posted reports by workers.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 self-start sm:self-center">
            {filteredLogs.length} matching reports
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 border-t border-slate-50 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, Product Name, Variety, Worker Name, Notes..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider mr-1 text-[10px]">Type:</span>
            {(['all', 'receive', 'transfer', 'sale', 'adjustment'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLogTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                  logTypeFilter === type
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                }`}
              >
                {type === 'all' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Table or Cards */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50/20">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No reported logs found matching "{logSearchQuery || logTypeFilter}". Try adjusting your keywords.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Item Details</th>
                  <th className="py-2.5 px-3">Locations Involved</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Value/Cost</th>
                  <th className="py-2.5 px-3">Reported By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((tx) => {
                  const txDate = new Date(tx.timestamp);
                  const formattedDate = txDate.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  // Locations labels
                  const fromLoc = locations.find(l => l.id === tx.fromLocationId)?.name || tx.fromLocationName || 'Unknown';
                  const toLoc = locations.find(l => l.id === tx.toLocationId)?.name || tx.toLocationName || 'Unknown';

                  return (
                    <tr key={tx.id} className="hover:bg-white transition-all">
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md capitalize text-[10px] ${
                          tx.type === 'receive' 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : tx.type === 'transfer' 
                            ? 'bg-blue-50 text-blue-700' 
                            : tx.type === 'sale' 
                            ? 'bg-indigo-50 text-indigo-700' 
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {tx.type === 'transfer' && <ArrowRightLeft className="h-2.5 w-2.5" />}
                          {tx.type === 'receive' && <ArrowDownLeft className="h-2.5 w-2.5" />}
                          {tx.type === 'sale' && <ArrowUpRight className="h-2.5 w-2.5" />}
                          {tx.type === 'adjustment' && <AlertTriangle className="h-2.5 w-2.5" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 leading-snug">{tx.productName}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1.5 mt-0.5 font-mono">
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">{tx.sku}</span>
                          <span>{tx.varietyName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {tx.type === 'receive' && (
                          <span className="flex items-center gap-1 font-medium">To: <span className="text-slate-800 font-semibold">{toLoc}</span></span>
                        )}
                        {tx.type === 'sale' && (
                          <span className="flex items-center gap-1 font-medium">From: <span className="text-slate-800 font-semibold">{fromLoc}</span></span>
                        )}
                        {tx.type === 'transfer' && (
                          <div className="flex flex-col gap-0.5 font-medium">
                            <span className="text-[10px] text-slate-400">From: {fromLoc}</span>
                            <span className="text-[10px] text-indigo-600">To: {toLoc}</span>
                          </div>
                        )}
                        {tx.type === 'adjustment' && (
                          <span className="flex items-center gap-1 font-medium">At: <span className="text-slate-800 font-semibold">{fromLoc || toLoc}</span></span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          tx.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {tx.quantity > 0 && tx.type !== 'transfer' ? `+${tx.quantity}` : tx.quantity} pcs
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                        {tx.type === 'sale' ? (
                          <span className="text-indigo-600 font-bold">₹{(tx.sellingPrice * Math.abs(tx.quantity)).toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-600 font-bold font-medium">₹{(tx.costPrice * Math.abs(tx.quantity)).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-700 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[100px]" title={tx.reportedBy}>{tx.reportedBy}</span>
                        </div>
                        {tx.notes && (
                          <p className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1 max-w-[120px]" title={tx.notes}>
                            "{tx.notes}"
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
