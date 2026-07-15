import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Tag, 
  IndianRupee, 
  History, 
  Warehouse, 
  Store, 
  BarChart3, 
  TrendingUp, 
  ArrowRightLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle,
  Layers,
  ChevronRight,
  Calculator,
  Briefcase
} from 'lucide-react';
import { Location, Product, ProductVariety, StockLevel, Transaction } from '../types';

interface ProductSearchTabProps {
  products: Product[];
  varieties: ProductVariety[];
  locations: Location[];
  stock: StockLevel[];
  transactions: Transaction[];
  selectedVarietyId: string;
  onSelectVariety: (id: string) => void;
}

export default function ProductSearchTab({
  products,
  varieties,
  locations,
  stock,
  transactions,
  selectedVarietyId,
  onSelectVariety
}: ProductSearchTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(200);

  // Categories list
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(varieties.map(v => v.category)))];
  }, [varieties]);

  // Handle auto-selecting first item when filtering results
  const filteredVarieties = useMemo(() => {
    return varieties.filter(v => {
      const matchesSearch = v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            v.varietyName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || v.category === categoryFilter;
      const matchesPrice = v.sellingPrice <= maxPriceFilter;
      
      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [varieties, searchQuery, categoryFilter, maxPriceFilter]);

  // Active Selected Variety
  const activeVariety = useMemo(() => {
    return varieties.find(v => v.id === selectedVarietyId) || filteredVarieties[0] || null;
  }, [varieties, selectedVarietyId, filteredVarieties]);

  // Synchronized Stock levels for active variety
  const activeStockLevels = useMemo(() => {
    if (!activeVariety) return [];
    return locations.map(loc => {
      const qty = stock.find(s => s.varietyId === activeVariety.id && s.locationId === loc.id)?.quantity || 0;
      return {
        ...loc,
        quantity: qty
      };
    });
  }, [activeVariety, locations, stock]);

  const activeTotalStock = useMemo(() => {
    return activeStockLevels.reduce((sum, item) => sum + item.quantity, 0);
  }, [activeStockLevels]);

  // Transaction history specifically for this active variety SKU
  const activeTransactions = useMemo(() => {
    if (!activeVariety) return [];
    return transactions
      .filter(t => t.varietyId === activeVariety.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeVariety, transactions]);

  // Sales and Finance Performance calculations specifically for this variety SKU
  const financialPerformance = useMemo(() => {
    if (!activeVariety) {
      return {
        unitsSold: 0,
        totalRevenue: 0,
        costOfGoods: 0,
        netProfit: 0,
        marginPercent: 0
      };
    }

    // Sales are negative quantities recorded on 'sale' type transactions
    const saleTransactions = transactions.filter(t => t.varietyId === activeVariety.id && t.type === 'sale');
    
    // We sum absolute value of quantity
    const unitsSold = saleTransactions.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const totalRevenue = unitsSold * activeVariety.sellingPrice;
    const costOfGoods = unitsSold * activeVariety.costPrice;
    const netProfit = totalRevenue - costOfGoods;
    const marginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      unitsSold,
      totalRevenue,
      costOfGoods,
      netProfit,
      marginPercent
    };
  }, [activeVariety, transactions]);

  return (
    <div className="space-y-6" id="product-search-tab-container">
      {/* Intro Context */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Briefcase className="h-5.5 w-5.5 text-indigo-600" />
          Advanced SKU Analytics Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Perform multi-parameter query searches by SKU, product name, rate, or category. Select any result to audit real-time warehouse sync states, price margins, and historical sales logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="search-deepdive-grid">
        
        {/* Left Side: Advanced Search & Filter Results (Col Span 5) */}
        <div className="lg:col-span-5 space-y-4" id="query-filter-side">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Parameters</h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="SKU, Name, or Variety..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Category Dropdown Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      categoryFilter === cat 
                        ? 'bg-slate-800 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate / Selling Price slider */}
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                <span>Max Retail Rate (Selling Price)</span>
                <span className="font-mono text-indigo-600">₹{maxPriceFilter}</span>
              </div>
              <input
                type="range"
                min="30"
                max="250"
                step="5"
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Search Result Ledger Items */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="search-results-box">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">Query Results ({filteredVarieties.length})</span>
              <span className="text-[10px] text-slate-400 font-mono">Select a SKU below</span>
            </div>

            {filteredVarieties.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No matching variety SKUs found.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto" id="search-results-list">
                {filteredVarieties.map((v) => {
                  const isSelected = activeVariety && activeVariety.id === v.id;
                  
                  // Compute total stock count
                  const total = stock
                    .filter(s => s.varietyId === v.id)
                    .reduce((sum, s) => sum + s.quantity, 0);

                  return (
                    <div
                      key={v.id}
                      onClick={() => onSelectVariety(v.id)}
                      className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50/40 border-l-4 border-indigo-600' 
                          : 'hover:bg-slate-50/40 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-700">{v.sku}</span>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">{v.category}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 truncate mt-1">{v.productName}</h4>
                        <p className="text-[11px] text-slate-500 truncate">{v.varietyName}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-slate-800">₹{v.sellingPrice.toFixed(2)}</p>
                        <span className={`inline-block text-[10px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded ${
                          total === 0 
                            ? 'bg-rose-50 text-rose-600' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {total} pcs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Deep-Dive Panel of Selected Item (Col Span 7) */}
        <div className="lg:col-span-7 space-y-6" id="deepdive-side">
          <AnimatePresence mode="wait">
            {!activeVariety ? (
              <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200/80 p-12 text-center text-slate-400 text-sm">
                Please select or modify search queries on the left to review a product.
              </div>
            ) : (
              <motion.div
                key={activeVariety.id}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* 1. Header Metadata Card */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100/40">
                        {activeVariety.category}
                      </span>
                      <span className="text-xs font-mono text-slate-400">SKU Code:</span>
                      <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {activeVariety.sku}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 mt-2">{activeVariety.productName}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Variety Style: <span className="text-slate-800 font-semibold">{activeVariety.varietyName}</span></p>
                  </div>

                  <div className="text-left md:text-right bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-w-[130px]">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Total Net Stock</p>
                    <h3 className="text-xl font-bold text-slate-800 font-mono mt-0.5">{activeTotalStock} <span className="text-xs font-normal text-slate-400">pcs</span></h3>
                    <p className="text-[10px] text-slate-500 mt-1">Across all locations</p>
                  </div>
                </div>

                {/* 2. Real-Time Stock Synchronization Status */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    Synchronized Stock Locations ({activeStockLevels.filter(l => l.quantity > 0).length} active)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5" id="sync-locations-cards">
                    {activeStockLevels.map((loc) => {
                      const maxBar = 80;
                      const pct = Math.min((loc.quantity / maxBar) * 100, 100);
                      const isLow = loc.type === 'warehouse' ? loc.quantity <= 15 : loc.quantity <= 5;

                      return (
                        <div 
                          key={loc.id} 
                          className="border border-slate-100 rounded-xl p-3 bg-slate-50/20 hover:border-slate-200 transition-all flex flex-col justify-between h-[90px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[80px]" title={loc.name}>
                              {loc.name}
                            </span>
                            {loc.type === 'warehouse' ? (
                              <Warehouse className="h-3 w-3 text-orange-400 shrink-0" />
                            ) : (
                              <Store className="h-3 w-3 text-emerald-400 shrink-0" />
                            )}
                          </div>

                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-lg font-bold font-mono text-slate-800">{loc.quantity}</span>
                            <span className="text-[9px] text-slate-400 font-normal uppercase">pcs</span>
                          </div>

                          {/* Progress bar visual */}
                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1.5">
                            <div 
                              className={`h-full rounded-full ${
                                loc.quantity === 0 
                                  ? 'bg-rose-400' 
                                  : isLow 
                                  ? 'bg-amber-400 animate-pulse' 
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${loc.quantity === 0 ? 0 : Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Cost & Margin Financial Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Prices & Margins */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="h-4 w-4 text-emerald-600" />
                      Cost & Margin Auditing
                    </h3>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Unit Cost Price (Owner):</span>
                        <span className="font-mono font-bold text-slate-700">₹{activeVariety.costPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Unit Selling Price (Retail):</span>
                        <span className="font-mono font-bold text-indigo-600">₹{activeVariety.sellingPrice.toFixed(2)}</span>
                      </div>
                      <hr className="border-slate-100" />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-semibold text-slate-600">Absolute Net Markup:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          +₹{(activeVariety.sellingPrice - activeVariety.costPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Owner ROI Margin:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {activeVariety.costPrice > 0 
                            ? (((activeVariety.sellingPrice - activeVariety.costPrice) / activeVariety.costPrice) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cumulative Sales & Profit Analysis */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Historical Sales Data
                    </h3>

                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Worker Logged Sales:</span>
                        <span className="font-mono font-bold text-slate-700">{financialPerformance.unitsSold} pcs</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium text-slate-600">Cumulative Revenue:</span>
                        <span className="font-mono font-bold text-indigo-700">₹{financialPerformance.totalRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Cost of Goods Sold (COGS):</span>
                        <span className="font-mono text-slate-500">₹{financialPerformance.costOfGoods.toFixed(2)}</span>
                      </div>
                      <hr className="border-slate-100" />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-bold">Logged Net Profit:</span>
                        <span className="font-mono font-bold text-emerald-600">₹{financialPerformance.netProfit.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 4. Full Historical Audit / Transaction Checklist of SKU */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="h-4.5 w-4.5 text-indigo-600" />
                      SKU Specific Ledger Logs
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">Total activities: {activeTransactions.length}</span>
                  </div>

                  {activeTransactions.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-slate-100">
                      No logs registered specifically for SKU {activeVariety.sku} yet.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1" id="sku-activities-list">
                      {activeTransactions.map((tx) => {
                        let opBadge = '';
                        let colorClasses = '';

                        if (tx.type === 'transfer') {
                          opBadge = 'Stock Transfer';
                          colorClasses = 'bg-blue-50 text-blue-700 border-blue-100';
                        } else if (tx.type === 'sale') {
                          opBadge = 'Direct Sale';
                          colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                        } else if (tx.type === 'receive') {
                          opBadge = 'Supplier Inbound';
                          colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        } else {
                          opBadge = 'Audit Adjust';
                          colorClasses = 'bg-amber-50 text-amber-700 border-amber-100';
                        }

                        const locFrom = locations.find(l => l.id === tx.fromLocationId);
                        const locTo = locations.find(l => l.id === tx.toLocationId);

                        return (
                          <div key={tx.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/70 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClasses}`}>
                                {opBadge}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(tx.timestamp).toLocaleString()}
                              </span>
                            </div>

                            <div className="flex justify-between items-start gap-4">
                              <div className="text-[11px] text-slate-600 space-y-1">
                                <p>
                                  <strong>Reporter:</strong> <span className="text-indigo-600">{tx.reportedBy}</span>
                                </p>
                                <p className="text-slate-500 font-normal">
                                  {tx.type === 'transfer' && `Moved from ${locFrom?.name} to ${locTo?.name}`}
                                  {tx.type === 'receive' && `Inbound stock delivered to ${locTo?.name}`}
                                  {tx.type === 'sale' && `Customer sale logged from ${locFrom?.name}`}
                                  {tx.type === 'adjustment' && `Discrepancy adjustment at ${locFrom?.name}`}
                                </p>
                                {tx.notes && (
                                  <p className="italic text-slate-400 mt-1 pl-1 border-l border-slate-200">
                                    "{tx.notes}"
                                  </p>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <span className={`font-mono font-bold ${
                                  tx.type === 'sale' || (tx.type === 'adjustment' && tx.quantity < 0)
                                    ? 'text-rose-600'
                                    : tx.type === 'receive' || (tx.type === 'adjustment' && tx.quantity > 0)
                                    ? 'text-emerald-600'
                                    : 'text-slate-700'
                                }`}>
                                  {tx.type === 'transfer' ? '' : tx.quantity > 0 ? '+' : ''}
                                  {tx.quantity} pcs
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
