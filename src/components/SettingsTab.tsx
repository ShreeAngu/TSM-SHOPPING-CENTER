import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Warehouse, 
  Store, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  MapPin, 
  Info,
  Edit2
} from 'lucide-react';
import { Location } from '../types';
import { 
  MASTER_POOL_WAREHOUSES, 
  MASTER_POOL_STORES, 
  updateLocationsCountInDb 
} from '../lib/dbService';

interface SettingsTabProps {
  locations: Location[];
  isEditor?: boolean;
  onUpdateLocation?: (location: Location) => Promise<void>;
}

export default function SettingsTab({ locations, isEditor = false, onUpdateLocation }: SettingsTabProps) {
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

  const handleApplyChanges = async () => {
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
    </div>
  );
}
