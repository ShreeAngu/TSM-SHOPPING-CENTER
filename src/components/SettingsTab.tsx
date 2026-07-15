import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Warehouse, 
  Store, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  MapPin, 
  Info,
  Edit2,
  IndianRupee,
  ArrowRightLeft,
  AlertTriangle,
  Trash2,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { Location, ProductVariety, StockLevel, Transaction } from '../types';
import { 
  MASTER_POOL_WAREHOUSES, 
  MASTER_POOL_STORES, 
  updateLocationsCountInDb 
} from '../lib/dbService';

interface SettingsTabProps {
  locations: Location[];
  varieties: ProductVariety[];
  stock: StockLevel[];
  isEditor?: boolean;
  onUpdateLocation?: (location: Location) => Promise<void>;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => Promise<void>;
}

export default function SettingsTab({ 
  locations, 
  varieties,
  stock,
  isEditor = false, 
  onUpdateLocation,
  onAddTransaction
}: SettingsTabProps) {
  // Determine current active counts from locations
  const currentWarehouseCount = locations.filter(l => l.type === 'warehouse').length;
  const currentStoreCount = locations.filter(l => l.type === 'store').length;

  const [warehouseCount, setWarehouseCount] = useState<number>(currentWarehouseCount || 2);
  const [storeCount, setStoreCount] = useState<number>(currentStoreCount || 4);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Editing location detail state
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  // Keep state in sync with actual loaded database counts
  useEffect(() => {
    if (currentWarehouseCount > 0) setWarehouseCount(currentWarehouseCount);
    if (currentStoreCount > 0) setStoreCount(currentStoreCount);
  }, [currentWarehouseCount, currentStoreCount]);

  // Deactivation wizard states
  const [showDeactivationWizard, setShowDeactivationWizard] = useState<boolean>(false);
  const [deactivationLocations, setDeactivationLocations] = useState<Location[]>([]);
  const [deactivationStock, setDeactivationStock] = useState<StockLevel[]>([]);
  const [currentWizardStep, setCurrentWizardStep] = useState<number>(0);
  const [deactivationStrategy, setDeactivationStrategy] = useState<'discard' | 'bulk' | 'individual'>('discard');
  const [bulkTargetLocationId, setBulkTargetLocationId] = useState<string>('');
  const [individualTargets, setIndividualTargets] = useState<Record<string, string>>({}); // key: varietyId_fromLocId -> toLocationId
  const [isProcessingDeactivation, setIsProcessingDeactivation] = useState<boolean>(false);

  const executeScaling = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setSyncError(null);
    try {
      await updateLocationsCountInDb(warehouseCount, storeCount);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (err) {
      console.error('Error applying node changes:', err);
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplyChanges = async () => {
    // Determine which locations are being removed
    const warehousesBeingRemoved = locations.filter(l => l.type === 'warehouse' && !MASTER_POOL_WAREHOUSES.slice(0, warehouseCount).some(m => m.id === l.id));
    const storesBeingRemoved = locations.filter(l => l.type === 'store' && !MASTER_POOL_STORES.slice(0, storeCount).some(m => m.id === l.id));
    const removed = [...warehousesBeingRemoved, ...storesBeingRemoved];

    if (removed.length > 0) {
      // Find if those locations have any stock
      const stockInRemoved = stock.filter(s => removed.some(r => r.id === s.locationId) && s.quantity > 0);
      if (stockInRemoved.length > 0) {
        setDeactivationLocations(removed);
        setDeactivationStock(stockInRemoved);
        setCurrentWizardStep(0);
        setDeactivationStrategy('discard');
        // Pre-fill bulk target with first remaining active location
        const remainingWarehouses = MASTER_POOL_WAREHOUSES.slice(0, warehouseCount);
        const remainingStores = MASTER_POOL_STORES.slice(0, storeCount);
        const remaining = [...remainingWarehouses, ...remainingStores];
        if (remaining.length > 0) {
          setBulkTargetLocationId(remaining[0].id);
        }
        // Pre-fill individual targets
        const initialInd: Record<string, string> = {};
        stockInRemoved.forEach(s => {
          if (remaining.length > 0) {
            initialInd[`${s.varietyId}_${s.locationId}`] = remaining[0].id;
          }
        });
        setIndividualTargets(initialInd);
        setShowDeactivationWizard(true);
        return;
      }
    }

    await executeScaling();
  };

  const handleConfirmDeactivation = async () => {
    setIsProcessingDeactivation(true);
    try {
      if (!onAddTransaction) {
        throw new Error('Transaction logging handler is not available.');
      }

      // Loop through stock items that need to be resolved
      for (const item of deactivationStock) {
        const variety = varieties.find(v => v.id === item.varietyId);
        if (!variety) continue;

        const sourceLoc = locations.find(l => l.id === item.locationId);
        const sourceName = sourceLoc ? sourceLoc.name : item.locationId;

        if (deactivationStrategy === 'discard') {
          // Log adjustment to discard stock (quantity = -item.quantity)
          await onAddTransaction({
            type: 'adjustment',
            sku: variety.sku,
            varietyId: variety.id,
            productId: variety.productId,
            varietyName: variety.varietyName,
            productName: variety.productName,
            fromLocationId: item.locationId,
            quantity: -item.quantity,
            reportedBy: 'TSM Admin (Deactivation Audit)',
            notes: `Discarded stock of ${variety.varietyName} due to deactivation of ${sourceName}.`,
            costPrice: variety.costPrice,
            sellingPrice: variety.sellingPrice
          });
        } else if (deactivationStrategy === 'bulk') {
          const targetLocId = bulkTargetLocationId;
          const targetLoc = [...MASTER_POOL_WAREHOUSES, ...MASTER_POOL_STORES].find(l => l.id === targetLocId);
          const targetName = targetLoc ? targetLoc.name : targetLocId;

          // Log transfer from source to bulk target location
          await onAddTransaction({
            type: 'transfer',
            sku: variety.sku,
            varietyId: variety.id,
            productId: variety.productId,
            varietyName: variety.varietyName,
            productName: variety.productName,
            fromLocationId: item.locationId,
            toLocationId: targetLocId,
            quantity: item.quantity,
            reportedBy: 'TSM Admin (Deactivation Audit)',
            notes: `Bulk transferred stock of ${variety.varietyName} from deactivated ${sourceName} to ${targetName}.`,
            costPrice: variety.costPrice,
            sellingPrice: variety.sellingPrice
          });
        } else if (deactivationStrategy === 'individual') {
          const targetLocId = individualTargets[`${item.varietyId}_${item.locationId}`];
          if (!targetLocId) continue;
          
          const targetLoc = [...MASTER_POOL_WAREHOUSES, ...MASTER_POOL_STORES].find(l => l.id === targetLocId);
          const targetName = targetLoc ? targetLoc.name : targetLocId;

          // Log transfer from source to individual target location
          await onAddTransaction({
            type: 'transfer',
            sku: variety.sku,
            varietyId: variety.id,
            productId: variety.productId,
            varietyName: variety.varietyName,
            productName: variety.productName,
            fromLocationId: item.locationId,
            toLocationId: targetLocId,
            quantity: item.quantity,
            reportedBy: 'TSM Admin (Deactivation Audit)',
            notes: `Transferred stock of ${variety.varietyName} from deactivated ${sourceName} to ${targetName}.`,
            costPrice: variety.costPrice,
            sellingPrice: variety.sellingPrice
          });
        }
      }

      // After resolving all stock, execute the location scaling
      await executeScaling();
      setShowDeactivationWizard(false);
    } catch (err) {
      console.error('Error resolving stocks during deactivation:', err);
      alert('Error during stock deactivation: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessingDeactivation(false);
    }
  };

  const previewWarehouses = MASTER_POOL_WAREHOUSES.slice(0, warehouseCount);
  const previewStores = MASTER_POOL_STORES.slice(0, storeCount);

  return (
    <div className="space-y-8" id="settings-tab-view">
      {/* Tab Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg" id="settings-banner">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-[10px] font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-400/20 px-3 py-1 rounded-full uppercase">
            System Settings
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display mt-2 flex items-center gap-2">
            <Settings className="h-7 w-7 text-indigo-400" /> TSM Node Configuration
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Configure your supply chain blueprint. Dynamically select the exact scale of warehouses and retail outlets in your centralized cloud network. Any node changes reflect instantly across the entire dashboard and worker report forms.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="settings-grid">
        {/* Left Side: Select Node Counts */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-indigo-600" /> Scale TSM Nodes
            </h2>

            {/* Warehouse count selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Warehouse className="h-4 w-4 text-orange-500" /> Active Warehouses
                </label>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {warehouseCount} Node(s)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Primary receiving and transfer depots for physical bulk stock arrival. (Min: 1, Max: 4)
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={`wh-select-${n}`}
                    onClick={() => { if (isEditor) setWarehouseCount(n); }}
                    disabled={!isEditor}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      !isEditor 
                        ? (warehouseCount === n ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed')
                        : (warehouseCount === n
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs cursor-pointer'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer')
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Store count selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-blue-500" /> Retail Outlets
                </label>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {storeCount} Outlet(s)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Frontline physical retail locations. Enabled for sales registers and transfers. (Min: 1, Max: 6)
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={`st-select-${n}`}
                    onClick={() => { if (isEditor) setStoreCount(n); }}
                    disabled={!isEditor}
                    className={`flex-1 min-w-[40px] py-2 rounded-xl text-xs font-bold border transition-all ${
                      !isEditor
                        ? (storeCount === n ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed')
                        : (storeCount === n
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs cursor-pointer'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer')
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Read-Only Mode Warning banner */}
            {!isEditor && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-[11px] text-amber-800 leading-relaxed shadow-3xs" id="read-only-settings-banner">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Read-Only Mode:</span> Scaling TSM nodes is restricted. Log in using an authorized Google Sign-In account (shreeanguarunachalam@gmail.com or surechuchi@gmail.com) in the left sidebar to change active nodes.
                </div>
              </div>
            )}

            {/* Sync feedback notifications */}
            {syncSuccess && (
              <div className="bg-emerald-50 text-emerald-800 text-xs p-3.5 rounded-xl border border-emerald-100 flex items-start gap-2.5 animate-fadeIn">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Database Synchronized!</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">Centralized Cloud Ledger has updated your active node list. Unused nodes are archived.</p>
                </div>
              </div>
            )}

            {syncError && (
              <div className="bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl border border-rose-100 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Sync Failed</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">{syncError}</p>
                </div>
              </div>
            )}

            {/* Apply Button */}
            <div className="border-t border-slate-50 pt-4">
              <button
                onClick={handleApplyChanges}
                disabled={isSyncing || !isEditor}
                className={`w-full font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  !isEditor 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white shadow-md shadow-indigo-600/10 cursor-pointer'
                }`}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Syncing Ledger Nodes...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {isEditor ? "Apply Node Changes" : "Configuration Locked (Read-Only)"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 text-slate-500 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-slate-500" /> Important Guidelines
            </h4>
            <ul className="text-[11px] leading-relaxed list-disc pl-4 space-y-1">
              <li>Reducing active nodes does <strong>not</strong> delete transaction logs or history files.</li>
              <li>Stocks located at deactivated locations are hidden but remain stored in the Ledger database safely.</li>
              <li>Always sync nodes before submitting worker reports.</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Visual Blueprint Preview */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Visual Blueprint Preview</h2>
              <p className="text-xs text-slate-400">This map shows the active nodes in your supply chain network.</p>
            </div>

            <div className="space-y-4">
              {/* Warehouse Nodes list */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Warehouses ({previewWarehouses.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewWarehouses.map((wh) => {
                    // Match with actual database edited values if present
                    const dbLoc = locations.find(l => l.id === wh.id) || wh;
                    return (
                      <div 
                        key={dbLoc.id} 
                        className="border border-slate-100 bg-orange-50/20 rounded-xl p-3.5 space-y-1.5 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                              <Warehouse className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 leading-tight truncate">{dbLoc.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{dbLoc.id}</p>
                            </div>
                          </div>
                          {isEditor && (
                            <button
                              onClick={() => setEditingLoc(dbLoc)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shrink-0 cursor-pointer"
                              title="Edit warehouse name & address"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-2 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {dbLoc.address}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Retail Outlet Nodes list */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Retail Stores ({previewStores.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewStores.map((st) => {
                    // Match with actual database edited values if present
                    const dbLoc = locations.find(l => l.id === st.id) || st;
                    return (
                      <div 
                        key={dbLoc.id} 
                        className="border border-slate-100 bg-blue-50/20 rounded-xl p-3.5 space-y-1.5 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                              <Store className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 leading-tight truncate">{dbLoc.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{dbLoc.id}</p>
                            </div>
                          </div>
                          {isEditor && (
                            <button
                              onClick={() => setEditingLoc(dbLoc)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shrink-0 cursor-pointer"
                              title="Edit store name & address"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-2 truncate">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {dbLoc.address}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Location Modal */}
      {editingLoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="edit-location-modal">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                {editingLoc.type === 'warehouse' ? <Warehouse className="h-5 w-5 text-orange-500" /> : <Store className="h-5 w-5 text-blue-500" />}
                Edit Node Details ({editingLoc.id})
              </h3>
              <button 
                onClick={() => setEditingLoc(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Node Name
                </label>
                <input
                  type="text"
                  value={editingLoc.name}
                  onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={editingLoc.address}
                  onChange={(e) => setEditingLoc({ ...editingLoc, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
              <button
                onClick={() => setEditingLoc(null)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onUpdateLocation) {
                    await onUpdateLocation(editingLoc);
                  }
                  setEditingLoc(null);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Save Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Stock Deactivation Wizard */}
      {showDeactivationWizard && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 max-w-xl w-full shadow-lg overflow-y-auto max-h-[90vh] space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5 text-amber-600">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Active Stock Safeguard Wizard
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You are deactivating location nodes with active inventory. Please choose how to route these stocks.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDeactivationWizard(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* List of deactivated locations and their stocked items */}
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4 text-xs space-y-2.5">
              <span className="font-bold text-amber-800 uppercase tracking-wider text-[10px]">
                Affected Stock Levels:
              </span>
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                {deactivationStock.map(s => {
                  const loc = locations.find(l => l.id === s.locationId);
                  const variety = varieties.find(v => v.id === s.varietyId);
                  return (
                    <div key={`${s.varietyId}_${s.locationId}`} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded-lg">
                      <div>
                        <span className="font-semibold text-slate-700">{variety?.productName}</span>
                        <span className="text-slate-500 ml-1">({variety?.varietyName})</span>
                        <p className="text-[10px] text-slate-400">Location: {loc?.name}</p>
                      </div>
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {s.quantity} pcs
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1: Strategy Selection */}
            {currentWizardStep === 0 && (
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select Stock Strategy:
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setDeactivationStrategy('discard')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      deactivationStrategy === 'discard'
                        ? 'border-indigo-600 bg-indigo-50/20'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2 className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Discard All Stocks (Write-off)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Write down all remaining items to zero. This will log an adjustment write-off transaction.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeactivationStrategy('bulk')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      deactivationStrategy === 'bulk'
                        ? 'border-indigo-600 bg-indigo-50/20'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowRightLeft className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Bulk Transfer to Another Node</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Transfer all orphaned stocks completely to a single active warehouse or store.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeactivationStrategy('individual')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      deactivationStrategy === 'individual'
                        ? 'border-indigo-600 bg-indigo-50/20'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Transfer Each Item Individually</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Map and route each variety and category independently to specific target active locations.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (deactivationStrategy === 'discard') {
                        setCurrentWizardStep(2); // Skip straight to confirm
                      } else {
                        setCurrentWizardStep(1); // Go to configure targets
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    Continue <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Strategy Configuration */}
            {currentWizardStep === 1 && (
              <div className="space-y-4">
                {deactivationStrategy === 'bulk' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Select Target Destination Node:
                    </label>
                    <select
                      value={bulkTargetLocationId}
                      onChange={(e) => setBulkTargetLocationId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-medium"
                    >
                      {[
                        ...MASTER_POOL_WAREHOUSES.slice(0, warehouseCount),
                        ...MASTER_POOL_STORES.slice(0, storeCount)
                      ].map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Retail Store'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      All items from deactivated nodes will automatically register as a ledger stock transfer to this node.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Route Each Variety Individually:
                    </label>
                    <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1" id="individual-route-mapping">
                      {deactivationStock.map(s => {
                        const variety = varieties.find(v => v.id === s.varietyId);
                        const locFrom = locations.find(l => l.id === s.locationId);
                        const key = `${s.varietyId}_${s.locationId}`;
                        const currentTarget = individualTargets[key] || '';

                        return (
                          <div key={key} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                            <div className="flex justify-between items-start text-xs">
                              <div>
                                <h4 className="font-bold text-slate-700 leading-tight">
                                  {variety?.productName} ({variety?.varietyName})
                                </h4>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  From: {locFrom?.name} | SKU: {variety?.sku}
                                </p>
                              </div>
                              <span className="font-mono font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 shrink-0 text-[11px]">
                                {s.quantity} pcs
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Destination:</span>
                              <select
                                value={currentTarget}
                                onChange={(e) => setIndividualTargets({
                                  ...individualTargets,
                                  [key]: e.target.value
                                })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500"
                              >
                                {[
                                  ...MASTER_POOL_WAREHOUSES.slice(0, warehouseCount),
                                  ...MASTER_POOL_STORES.slice(0, storeCount)
                                ].map(loc => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.name} ({loc.type === 'warehouse' ? 'Warehouse' : 'Store'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-3">
                  <button
                    type="button"
                    onClick={() => setCurrentWizardStep(0)}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentWizardStep(2)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    Review & Confirm <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Final Review and Execution */}
            {currentWizardStep === 2 && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800 space-y-2">
                  <h4 className="font-bold flex items-center gap-1 text-xs">
                    <Check className="h-4 w-4" /> Ready to Apply Stock Mitigation
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    You have selected: <strong className="uppercase">{deactivationStrategy === 'discard' ? 'Discard Stocks' : deactivationStrategy === 'bulk' ? 'Bulk Transfer' : 'Individual Transfer'}</strong> strategy.
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {deactivationStock.length} stock line entries will be parsed and re-routed. Once confirmed, the system will execute backend ledger mutations and deactivate {deactivationLocations.length} locations.
                  </p>
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (deactivationStrategy === 'discard') {
                        setCurrentWizardStep(0);
                      } else {
                        setCurrentWizardStep(1);
                      }
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeactivation}
                    disabled={isProcessingDeactivation}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {isProcessingDeactivation ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Processing Stocks...
                      </>
                    ) : (
                      <>
                        Apply & Deactivate Nodes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
