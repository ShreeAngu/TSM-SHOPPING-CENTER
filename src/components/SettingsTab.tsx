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
  Info 
} from 'lucide-react';
import { Location } from '../types';
import { 
  MASTER_POOL_WAREHOUSES, 
  MASTER_POOL_STORES, 
  updateLocationsCountInDb 
} from '../lib/dbService';

interface SettingsTabProps {
  locations: Location[];
}

export default function SettingsTab({ locations }: SettingsTabProps) {
  // Determine current active counts from locations
  const currentWarehouseCount = locations.filter(l => l.type === 'warehouse').length;
  const currentStoreCount = locations.filter(l => l.type === 'store').length;

  const [warehouseCount, setWarehouseCount] = useState<number>(currentWarehouseCount || 2);
  const [storeCount, setStoreCount] = useState<number>(currentStoreCount || 4);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
                    onClick={() => setWarehouseCount(n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      warehouseCount === n
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
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
                    onClick={() => setStoreCount(n)}
                    className={`flex-1 min-w-[40px] py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      storeCount === n
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

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
                disabled={isSyncing}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Syncing Ledger Nodes...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Apply Node Changes
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
                  {previewWarehouses.map((wh) => (
                    <div 
                      key={wh.id} 
                      className="border border-slate-100 bg-orange-50/20 rounded-xl p-3.5 space-y-1.5 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                          <Warehouse className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 leading-tight">{wh.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{wh.id}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-2">
                        <MapPin className="h-3 w-3 text-slate-400" /> {wh.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Retail Outlet Nodes list */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Retail Stores ({previewStores.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewStores.map((st) => (
                    <div 
                      key={st.id} 
                      className="border border-slate-100 bg-blue-50/20 rounded-xl p-3.5 space-y-1.5 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                          <Store className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 leading-tight">{st.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{st.id}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-2">
                        <MapPin className="h-3 w-3 text-slate-400" /> {st.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
