import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Boxes, 
  TrendingUp, 
  AlertTriangle, 
  History, 
  MapPin, 
  ArrowRightLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign,
  Package,
  Store,
  Warehouse,
  BarChart3,
  Search
} from 'lucide-react';
import { Location, ProductVariety, StockLevel, Transaction } from '../types';

interface DashboardProps {
  locations: Location[];
  varieties: ProductVariety[];
  stock: StockLevel[];
  transactions: Transaction[];
  onSelectProduct: (varietyId: string) => void;
  onNavigate: (tab: string) => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

export default function Dashboard({
  locations,
  varieties,
  stock,
  transactions,
  onSelectProduct,
  onNavigate,
  onAddTransaction
}: DashboardProps) {
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');

  // Helpers for calculations
  const getVarietyStockAtLocation = (varietyId: string, locationId: string) => {
    return stock.find(s => s.varietyId === varietyId && s.locationId === locationId)?.quantity || 0;
  };

  const getVarietyTotalStock = (varietyId: string) => {
    return stock
      .filter(s => s.varietyId === varietyId)
      .reduce((sum, s) => sum + s.quantity, 0);
  };

  // 1. Overall Stock stats
  const totalUnits = stock.reduce((sum, s) => sum + s.quantity, 0);
  
  // Valuation calculations
  const totalValuationCost = stock.reduce((sum, s) => {
    const variety = varieties.find(v => v.id === s.varietyId);
    return sum + (variety ? variety.costPrice * s.quantity : 0);
  }, 0);

  const totalValuationRetail = stock.reduce((sum, s) => {
    const variety = varieties.find(v => v.id === s.varietyId);
    return sum + (variety ? variety.sellingPrice * s.quantity : 0);
  }, 0);

  // Low stock threshold: <= 5 for store, <= 15 for warehouse
  const lowStockItems = stock.filter(s => {
    const loc = locations.find(l => l.id === s.locationId);
    if (!loc) return false;
    const threshold = loc.type === 'warehouse' ? 15 : 5;
    return s.quantity <= threshold && s.quantity > 0;
  });

  // Category counts
  const categorySummary = varieties.reduce((acc: Record<string, number>, v) => {
    const totalVStock = getVarietyTotalStock(v.id);
    acc[v.category] = (acc[v.category] || 0) + totalVStock;
    return acc;
  }, {});

  // Ledger Filters and Search (with specialized support for "search inbound of stocks")
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'inbound' | 'transfer' | 'sale' | 'adjustment'>('all');

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter(tx => {
        // Filter by Type
        if (ledgerFilter === 'inbound' && tx.type !== 'receive') return false;
        if (ledgerFilter === 'transfer' && tx.type !== 'transfer') return false;
        if (ledgerFilter === 'sale' && tx.type !== 'sale') return false;
        if (ledgerFilter === 'adjustment' && tx.type !== 'adjustment') return false;

        // Filter by Search Query
        const q = ledgerSearchQuery.toLowerCase().trim();
        if (!q) return true;

        return (
          tx.sku.toLowerCase().includes(q) ||
          tx.productName.toLowerCase().includes(q) ||
          tx.varietyName.toLowerCase().includes(q) ||
          tx.reportedBy.toLowerCase().includes(q) ||
          (tx.notes && tx.notes.toLowerCase().includes(q))
        );
      });
  }, [transactions, ledgerSearchQuery, ledgerFilter]);

  const displayedTransactions = useMemo(() => {
    const activeSearchOrFilter = ledgerSearchQuery.trim() !== '' || ledgerFilter !== 'all';
    if (activeSearchOrFilter) {
      return filteredTransactions;
    }
    return filteredTransactions.slice(0, 5); // Default to last 5 when idle
  }, [filteredTransactions, ledgerSearchQuery, ledgerFilter]);

  return (
    <div className="space-y-8" id="dashboard-container">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" id="stats-grid">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4"
          id="stat-total-stock"
        >
          <div className="p-3.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Units</p>
            <h3 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {totalUnits.toLocaleString()}
            </h3>
            <p className="text-xs text-indigo-600 font-medium mt-1">Across all locations</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4"
          id="stat-cost-val"
        >
          <div className="p-3.5 bg-emerald-50 rounded-xl text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Asset Cost Value</p>
            <h3 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              ${totalValuationCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Our purchase capital</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4"
          id="stat-retail-val"
        >
          <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Retail Market Value</p>
            <h3 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              ${totalValuationRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-blue-600 font-medium mt-1">
              Margin: {totalValuationCost > 0 ? (((totalValuationRetail - totalValuationCost) / totalValuationRetail) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center space-x-4"
          id="stat-low-stock"
        >
          <div className={`p-3.5 rounded-xl ${lowStockItems.length > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Low Stock Warnings</p>
            <h3 className="text-2xl font-bold text-slate-800 font-mono mt-0.5">
              {lowStockItems.length}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Requires synchronization</p>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Location sync state and quick category stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-layouts">
        
        {/* Real-Time Location Synchronization List */}
        <div className="lg:col-span-2 space-y-5" id="locations-sync-pane">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-rose-500" />
                Location Synchronization
              </h2>
              <p className="text-sm text-slate-500">Real-time stock counts across warehouses and storefronts.</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium" id="location-type-filters">
              <button 
                onClick={() => setSelectedLocationFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${selectedLocationFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All
              </button>
              <button 
                onClick={() => setSelectedLocationFilter('warehouse')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${selectedLocationFilter === 'warehouse' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Warehouse className="h-3 w-3" /> Warehouses
              </button>
              <button 
                onClick={() => setSelectedLocationFilter('store')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${selectedLocationFilter === 'store' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Store className="h-3 w-3" /> Stores
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="locations-list-grid">
            {locations
              .filter(l => selectedLocationFilter === 'all' || l.type === selectedLocationFilter)
              .map((loc) => {
                // Calculate stock for this location
                const locStock = stock.filter(s => s.locationId === loc.id);
                const locTotalUnits = locStock.reduce((sum, s) => sum + s.quantity, 0);
                const locTotalItems = locStock.filter(s => s.quantity > 0).length;

                // Calculate cost value for this location
                const locValuation = locStock.reduce((sum, s) => {
                  const variety = varieties.find(v => v.id === s.varietyId);
                  return sum + (variety ? variety.costPrice * s.quantity : 0);
                }, 0);

                // Find low stock items at this specific location
                const locThreshold = loc.type === 'warehouse' ? 15 : 5;
                const locLowStockCount = locStock.filter(s => s.quantity <= locThreshold && s.quantity > 0).length;

                return (
                  <div 
                    key={loc.id} 
                    className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-200 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className={`p-2 rounded-xl ${loc.type === 'warehouse' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {loc.type === 'warehouse' ? <Warehouse className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-800 text-sm">{loc.name}</h4>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{loc.address}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          loc.type === 'warehouse' ? 'bg-orange-100/60 text-orange-700' : 'bg-emerald-100/60 text-emerald-700'
                        }`}>
                          {loc.type}
                        </span>
                      </div>

                      {/* Stock Info Grid */}
                      <div className="grid grid-cols-2 gap-4 my-5 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Units</p>
                          <p className="text-lg font-bold text-slate-700 font-mono">{locTotalUnits.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Est. Cost Value</p>
                          <p className="text-sm font-bold text-slate-700 font-mono mt-1">
                            ${locValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="text-slate-500 font-medium">
                        {locTotalItems} unique SKUs stocked
                      </span>
                      {locLowStockCount > 0 ? (
                        <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {locLowStockCount} low
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium bg-emerald-50/80 px-2 py-0.5 rounded-md">
                          Stock Stable
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Categories & Active Actions Sideboard */}
        <div className="space-y-6" id="dashboard-sidebar-panels">
          {/* Quick Category Stock Levels */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              Stock by Category
            </h3>
            <div className="space-y-4" id="category-bars">
              {Object.entries(categorySummary).map(([cat, count]) => {
                const max = Math.max(...Object.values(categorySummary));
                const pct = max > 0 ? (count / max) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">{cat}</span>
                      <span className="text-slate-800 font-mono font-semibold">{count} pcs</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4" id="quick-actions-box">
            <div className="space-y-1">
              <h4 className="font-bold text-sm tracking-wide text-indigo-200 uppercase">Worker Reports Desk</h4>
              <h3 className="text-base font-semibold text-white">Need to Log Stock Movement?</h3>
              <p className="text-xs text-indigo-100/70">
                Log transfers from warehouses, sales at outlets, or new shipments instantly.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <button 
                onClick={() => onNavigate('report')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Log Worker Stock Report
              </button>
              <button 
                onClick={() => onNavigate('search')}
                className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-indigo-200 py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <TrendingUp className="h-3.5 w-3.5" /> Analyze SKU Cost & Sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Storefront Low-Stock Replenishment & Fulfillment Desk */}
      {(() => {
        const storeLowStock = stock.filter(s => {
          const loc = locations.find(l => l.id === s.locationId);
          return loc && loc.type === 'store' && s.quantity <= 5;
        });

        return (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-rose-100 p-6 shadow-xs space-y-5"
            id="storefront-fulfillment-desk"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />
                  Storefront Replenishment Desk
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  When a store is running low (≤ 5 units), use this panel to instantly move products from warehouses in 1-click.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full font-mono">
                {storeLowStock.length} Low-Stock Alert{storeLowStock.length !== 1 ? 's' : ''}
              </span>
            </div>

            {storeLowStock.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                All retail storefronts have stable stock levels. No low-stock alerts reported.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1" id="low-stock-fulfillment-grid">
                {storeLowStock.map(item => {
                  const variety = varieties.find(v => v.id === item.varietyId);
                  const store = locations.find(l => l.id === item.locationId);
                  if (!variety || !store) return null;

                  // Find warehouses with stock of this same variety
                  const warehousesWithStock = locations
                    .filter(l => l.type === 'warehouse')
                    .map(wh => {
                      const whStock = stock.find(s => s.varietyId === variety.id && s.locationId === wh.id)?.quantity || 0;
                      return { ...wh, quantity: whStock };
                    })
                    .filter(wh => wh.quantity > 0);

                  return (
                    <div 
                      key={`${item.varietyId}_${item.locationId}`}
                      className="border border-rose-100 bg-rose-50/10 rounded-xl p-4 flex flex-col justify-between hover:border-rose-200 transition-all space-y-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Store: {store.name}
                          </span>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${item.quantity === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.quantity === 0 ? 'Out of Stock' : `${item.quantity} units left`}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">
                          {variety.productName}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">
                          Style: <span className="text-slate-700 font-semibold">{variety.varietyName}</span> | SKU: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[11px]">{variety.sku}</span>
                        </p>
                      </div>

                      <div className="border-t border-slate-100/80 pt-3 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Warehouse Stock Sources:
                        </p>
                        {warehousesWithStock.length === 0 ? (
                          <p className="text-[11px] text-rose-600 font-medium italic">
                            No warehouses currently have this item in stock. Please order inbound supply first!
                          </p>
                        ) : (
                          <div className="space-y-1.5 font-sans">
                            {warehousesWithStock.map(wh => {
                              const transferQty = Math.min(15, wh.quantity);
                              return (
                                <div key={wh.id} className="flex items-center justify-between text-xs bg-white border border-slate-100 rounded-lg p-2 hover:border-slate-200 transition-all">
                                  <div>
                                    <span className="font-semibold text-slate-700">{wh.name}</span>
                                    <span className="text-slate-400 ml-1.5">({wh.quantity} pcs)</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (onAddTransaction) {
                                        onAddTransaction({
                                          type: 'transfer',
                                          sku: variety.sku,
                                          varietyId: variety.id,
                                          productId: variety.productId,
                                          varietyName: variety.varietyName,
                                          productName: variety.productName,
                                          fromLocationId: wh.id,
                                          toLocationId: store.id,
                                          quantity: transferQty,
                                          reportedBy: 'TSM Admin (Fulfillment Desk)',
                                          notes: `[AUTO REPLENISHMENT] Transferred stock of ${variety.varietyName} from ${wh.name} to storefront ${store.name}.`,
                                          costPrice: variety.costPrice,
                                          sellingPrice: variety.sellingPrice
                                        });
                                      }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" /> Fulfill {transferQty} pcs
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* Recent Worker Reports & Transactions Feed */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs" id="transactions-feed">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              Recent Worker Activity Reports
            </h2>
            <p className="text-xs text-slate-500">Search inbound stock arrivals, transfers, sales, and audit reports.</p>
          </div>
          <button 
            onClick={() => onNavigate('search')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline self-start sm:self-auto"
          >
            Search Logs By SKU →
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 border-b border-slate-100 pb-5" id="ledger-search-controls">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, product, variety, reporter..."
              value={ledgerSearchQuery}
              onChange={(e) => setLedgerSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
            />
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-1 items-center justify-start md:justify-end">
            <button
              onClick={() => setLedgerFilter('all')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                ledgerFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Reports
            </button>
            <button
              onClick={() => setLedgerFilter('inbound')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ledgerFilter === 'inbound'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100/40'
              }`}
            >
              <ArrowDownLeft className="h-3 w-3" /> Inbound Stock
            </button>
            <button
              onClick={() => setLedgerFilter('transfer')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ledgerFilter === 'transfer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100/40'
              }`}
            >
              <ArrowRightLeft className="h-3 w-3" /> Transfers
            </button>
            <button
              onClick={() => setLedgerFilter('sale')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ledgerFilter === 'sale'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100/40'
              }`}
            >
              <ArrowUpRight className="h-3 w-3" /> Sales
            </button>
            <button
              onClick={() => setLedgerFilter('adjustment')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ledgerFilter === 'adjustment'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100/40'
              }`}
            >
              <AlertTriangle className="h-3 w-3" /> Adjustments
            </button>
          </div>
        </div>

        {displayedTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            {ledgerSearchQuery || ledgerFilter !== 'all' ? (
              <>
                <p className="font-semibold text-slate-600 text-sm">No matching stock reports found.</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your keyword search or filter parameters.</p>
              </>
            ) : (
              <p>No transactions logged yet. Use the Worker Reports tab to begin recording.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100" id="transactions-feed-list">
            {displayedTransactions.map((tx) => {
              const fromLoc = locations.find(l => l.id === tx.fromLocationId);
              const toLoc = locations.find(l => l.id === tx.toLocationId);

              // Transaction styling
              let typeLabel = '';
              let typeColor = '';
              let icon = null;

              if (tx.type === 'receive') {
                typeLabel = 'New Stock Arrival';
                typeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                icon = <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />;
              } else if (tx.type === 'transfer') {
                typeLabel = 'Worker Stock Transfer';
                typeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                icon = <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />;
              } else if (tx.type === 'sale') {
                typeLabel = 'Out-of-Billing Sale';
                typeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                icon = <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />;
              } else {
                typeLabel = 'Stock Audit Adjustment';
                typeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
              }

              return (
                <div key={tx.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {icon}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{tx.productName}</span>
                        <span className="text-slate-400 text-xs">— {tx.varietyName}</span>
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {tx.sku}
                        </span>
                        {tx.type === 'transfer' && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100/50 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0 animate-fadeIn shadow-3xs">
                            <ArrowRightLeft className="h-2.5 w-2.5 text-blue-500" /> Transfer to <span className="font-black underline">{toLoc?.name || 'Unknown'}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium text-slate-600">
                          Reported by: <span className="text-indigo-600">{tx.reportedBy}</span>
                        </span>
                        <span>•</span>
                        <span>{new Date(tx.timestamp).toLocaleString()}</span>
                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-400 font-light truncate max-w-sm md:max-w-md">"{tx.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                        {typeLabel}
                      </span>
                      <div className="text-xs text-slate-500 mt-1">
                        {tx.type === 'transfer' && `From ${fromLoc?.name} to ${toLoc?.name}`}
                        {tx.type === 'receive' && `Delivered to ${toLoc?.name}`}
                        {tx.type === 'sale' && `Sold from ${fromLoc?.name}`}
                        {tx.type === 'adjustment' && `Adjusted at ${fromLoc?.name}`}
                      </div>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <span className={`font-mono text-sm font-bold ${
                        tx.type === 'sale' || (tx.type === 'adjustment' && tx.quantity < 0) 
                          ? 'text-rose-600' 
                          : tx.type === 'receive' || (tx.type === 'adjustment' && tx.quantity > 0)
                          ? 'text-emerald-600'
                          : 'text-slate-700'
                      }`}>
                        {tx.quantity > 0 && tx.type !== 'transfer' ? `+${tx.quantity}` : tx.quantity} pcs
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {tx.type === 'sale' ? `Value: $${(tx.sellingPrice * Math.abs(tx.quantity)).toFixed(2)}` : `Cost: $${(tx.costPrice * Math.abs(tx.quantity)).toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
