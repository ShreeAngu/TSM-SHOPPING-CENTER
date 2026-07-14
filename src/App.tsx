import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Layers, 
  FileText, 
  Search, 
  RefreshCw, 
  Download, 
  Upload, 
  Clock, 
  Database,
  Store,
  Warehouse,
  Menu,
  X,
  GitBranch,
  Settings
} from 'lucide-react';
import { 
  Location, 
  Product, 
  ProductVariety, 
  StockLevel, 
  Transaction,
  CategoryTreeNode
} from './types';

// Modular Components
import Dashboard from './components/Dashboard';
import InventoryManager from './components/InventoryManager';
import ReportForm from './components/ReportForm';
import ProductSearchTab from './components/ProductSearchTab';
import CategoryTreeDesk from './components/CategoryTreeDesk';
import SettingsTab from './components/SettingsTab';

// Firebase Services
import {
  seedDatabaseIfNeeded,
  listenLocations,
  listenProducts,
  listenVarieties,
  listenStock,
  listenTransactions,
  listenCategoryTree,
  addCategoryNode,
  deleteCategoryNode,
  addProductDoc,
  addVarietyDoc,
  deleteVarietyDoc,
  addTransactionDoc,
  resetCloudDatabase
} from './lib/dbService';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Core Real-Time State (Cloud Synced)
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [varieties, setVarieties] = useState<ProductVariety[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Selected Variety for the Search/Detail View
  const [selectedVarietyId, setSelectedVarietyId] = useState<string>('');

  // 1. Initialize State and Sync Real-Time from Cloud Firestore
  useEffect(() => {
    let unsubLocs: () => void = () => {};
    let unsubProds: () => void = () => {};
    let unsubVars: () => void = () => {};
    let unsubStock: () => void = () => {};
    let unsubTxs: () => void = () => {};
    let unsubTree: () => void = () => {};

    // Keep track of which initial queries have completed
    const loadedQueries = {
      locs: false,
      prods: false,
      vars: false,
      stock: false,
      txs: false,
      tree: false
    };

    const checkIfFullyLoaded = () => {
      if (Object.values(loadedQueries).every(v => v === true)) {
        setIsLoading(false);
      }
    };

    // Run dynamic seed first, then establish active cloud subscriptions
    seedDatabaseIfNeeded()
      .then(() => {
        unsubLocs = listenLocations((data) => {
          setLocations(data);
          loadedQueries.locs = true;
          checkIfFullyLoaded();
        });
        unsubProds = listenProducts((data) => {
          setProducts(data);
          loadedQueries.prods = true;
          checkIfFullyLoaded();
        });
        unsubVars = listenVarieties((data) => {
          setVarieties(data);
          loadedQueries.vars = true;
          checkIfFullyLoaded();
        });
        unsubStock = listenStock((data) => {
          setStock(data);
          loadedQueries.stock = true;
          checkIfFullyLoaded();
        });
        unsubTxs = listenTransactions((data) => {
          setTransactions(data);
          loadedQueries.txs = true;
          checkIfFullyLoaded();
        });
        unsubTree = listenCategoryTree((data) => {
          setCategoryTree(data);
          loadedQueries.tree = true;
          checkIfFullyLoaded();
        });
      })
      .catch((err) => {
        console.error('Error seeding/listening to Firebase:', err);
        setSyncError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });

    return () => {
      unsubLocs();
      unsubProds();
      unsubVars();
      unsubStock();
      unsubTxs();
      unsubTree();
    };
  }, []);

  // 2. Action: Register a Product
  const handleAddProduct = async (newProduct: Omit<Product, 'id'>) => {
    const generatedId = `p-${Date.now()}`;
    const productRecord: Product = {
      id: generatedId,
      ...newProduct
    };
    await addProductDoc(productRecord);
  };

  // 3. Action: Register a Variety SKU and seed initial stock
  const handleAddVariety = async (
    newVariety: Omit<ProductVariety, 'id'>, 
    initialStockMap: Record<string, number>
  ) => {
    const generatedId = `v-${Date.now()}`;
    const varietyRecord: ProductVariety = {
      id: generatedId,
      ...newVariety
    };
    await addVarietyDoc(varietyRecord, initialStockMap);
  };

  // 4. Action: Delete a variety style (and clean stock states)
  const handleDeleteVariety = async (varietyId: string) => {
    const locationIds = locations.map(l => l.id);
    await deleteVarietyDoc(varietyId, locationIds);
  };

  // 5. Core Engine: Add and Process worker report transactions (Batch Sync)
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string }) => {
    const { timestamp, ...restTx } = newTx;
    const txRecord: Transaction = {
      id: `tx-${Date.now()}`,
      timestamp: timestamp || new Date().toISOString(),
      ...restTx
    } as Transaction;

    const fromLocStockObj = stock.find(s => s.varietyId === txRecord.varietyId && s.locationId === txRecord.fromLocationId);
    const toLocStockObj = stock.find(s => s.varietyId === txRecord.varietyId && s.locationId === txRecord.toLocationId);

    const fromLocStock = fromLocStockObj ? fromLocStockObj.quantity : 0;
    const toLocStock = toLocStockObj ? toLocStockObj.quantity : 0;

    await addTransactionDoc(txRecord, fromLocStock, toLocStock);
  };

  // 6. Category Tree Management
  const handleAddCategoryNode = async (name: string, parentId: string | null) => {
    const newNode: CategoryTreeNode = {
      id: `node-${Date.now()}`,
      name,
      parentId
    };
    await addCategoryNode(newNode);
  };

  const handleDeleteCategoryNode = async (nodeId: string) => {
    // Recursively delete children
    const deleteNodeAndChildren = async (id: string) => {
      await deleteCategoryNode(id);
      const children = categoryTree.filter(n => n.parentId === id);
      for (const child of children) {
        await deleteNodeAndChildren(child.id);
      }
    };
    await deleteNodeAndChildren(nodeId);
  };

  // 7. Maintenance: Clear Database and reset to clean slate
  const handleResetToDefaults = async () => {
    if (window.confirm('Wipe & Clear Cloud Database? This will permanently erase all products, varieties, stock states, transaction logs, and category trees, resetting the system to a completely clean workspace.')) {
      await resetCloudDatabase();
    }
  };

  // 8. Data Transfer: Export Backup File (JSON)
  const handleExportData = () => {
    const payload = {
      locations,
      products,
      varieties,
      stock,
      transactions,
      categoryTree,
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tsm_centralized_cloud_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 9. Data Transfer: Import Backup File & sync with Firebase
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.locations && parsed.products && parsed.varieties && parsed.stock && parsed.transactions) {
          if (window.confirm('Restore Backup? This will replace your current Firestore records with the backup file data.')) {
            const batch = writeBatch(db);

            // Write locations
            parsed.locations.forEach((loc: Location) => batch.set(doc(db, 'locations', loc.id), loc));
            // Write products
            parsed.products.forEach((prod: Product) => batch.set(doc(db, 'products', prod.id), prod));
            // Write varieties
            parsed.varieties.forEach((v: ProductVariety) => batch.set(doc(db, 'varieties', v.id), v));
            // Write stock
            parsed.stock.forEach((st: StockLevel) => batch.set(doc(db, 'stock', `${st.varietyId}_${st.locationId}`), st));
            // Write transactions
            parsed.transactions.forEach((tx: Transaction) => batch.set(doc(db, 'transactions', tx.id), tx));
            // Write tree if exists in backup
            if (parsed.categoryTree) {
              parsed.categoryTree.forEach((node: CategoryTreeNode) => batch.set(doc(db, 'categoryTree', node.id), node));
            }

            await batch.commit();
            alert('Cloud Backup restored successfully!');
          }
        } else {
          alert('Invalid backup structure. Please make sure the JSON file is correct.');
        }
      } catch (err) {
        alert('Failed to parse backup file.');
      }
    };
    fileReader.readAsText(files[0]);
  };

  // Navigate to query and select product detail
  const handleNavigateToProductSearch = (varietyId: string) => {
    setSelectedVarietyId(varietyId);
    setActiveTab('search');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col antialiased" id="main-applet-root">
      
      {/* Upper Navigation Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shadow-2xs" id="applet-header-bar">
        <div className="flex items-center space-x-3 lg:hidden">
          <div className="p-2 bg-slate-900 rounded-xl text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none font-display">TSM Suite</h1>
            <p className="text-[9px] text-indigo-500 font-semibold uppercase tracking-wider mt-0.5">Inventory Desk</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-500 tracking-tight">TSM Centralized Cloud Node (Online)</span>
        </div>

        {/* Live System Time and Backup actions */}
        <div className="hidden lg:flex items-center space-x-6 text-xs">
          <div className="flex items-center space-x-2 text-slate-400 font-medium bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl shadow-2xs">
            <Clock className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
            <span className="text-[11px] text-slate-500">Live Clock:</span>
            <span className="font-mono text-slate-700 font-bold bg-white px-2 py-0.5 rounded border border-slate-100 shadow-2xs">
              {currentTime.toISOString().replace('T', ' ').substring(0, 19)} UTC
            </span>
          </div>

          <div className="flex items-center space-x-2 border-l border-slate-100 pl-6" id="maintenance-actions-desktop">
            {/* Backup Import Input */}
            <label className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-semibold cursor-pointer flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" /> Restore Backup
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
            <button 
              onClick={handleExportData}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Backup Ledger (JSON)
            </button>
            <button 
              onClick={handleResetToDefaults}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
              title="Wipe & Clear Database"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-1.5 rounded bg-slate-100 text-slate-700"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex flex-col lg:flex-row" id="applet-body-grid">
        
        {/* Left Navigation Sidebar - Premium Dark Theme */}
        <aside className="lg:w-64 bg-slate-900 text-slate-300 p-5 shrink-0 hidden lg:flex flex-col justify-between border-r border-slate-800" id="applet-sidebar">
          <div className="space-y-8">
            {/* Brand Logo Header */}
            <div className="flex items-center space-x-3 px-2 py-1">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl text-white shadow-md shadow-indigo-900/40">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight leading-none font-display">TSM Suite</h1>
                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mt-1">Inventory Desk</p>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3">Navigation Desk</h4>
              <nav className="space-y-1.5" id="sidebar-nav-list">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span>Dashboard Overview</span>
                </button>

                <button
                  onClick={() => setActiveTab('directory')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'directory'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Inventory Registry</span>
                </button>

                <button
                  onClick={() => setActiveTab('report')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'report'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Log Worker Reports</span>
                </button>

                <button
                  onClick={() => setActiveTab('search')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'search'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>SKU Search & Analytics</span>
                </button>

                 <button
                  onClick={() => setActiveTab('tree')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'tree'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <GitBranch className="h-4 w-4" />
                  <span>Product Class Tree</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                    activeTab === 'settings'
                      ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/10'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>System Settings</span>
                </button>
              </nav>
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-800 text-[11px] text-slate-400 space-y-2 mt-auto">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <Warehouse className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
              <span>TSM Network Nodes</span>
            </div>
            <div className="space-y-1 font-medium">
              <p className="flex justify-between"><span>Warehouses:</span> <span className="text-white font-mono font-bold">{locations.filter(l => l.type === 'warehouse').length} active</span></p>
              <p className="flex justify-between"><span>Retail Outlets:</span> <span className="text-white font-mono font-bold">{locations.filter(l => l.type === 'store').length} connected</span></p>
            </div>
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                style={{ width: `${((locations.filter(l => l.type === 'warehouse').length + locations.filter(l => l.type === 'store').length) / 10) * 100}%` }}
              />
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 p-4 space-y-3 shadow-md" id="mobile-navigation-dropdown">
            <nav className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <Database className="h-3.5 w-3.5" /> Overview
              </button>
              <button
                onClick={() => { setActiveTab('directory'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'directory' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <Layers className="h-3.5 w-3.5" /> Registry
              </button>
              <button
                onClick={() => { setActiveTab('report'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <FileText className="h-3.5 w-3.5" /> Log Reports
              </button>
              <button
                onClick={() => { setActiveTab('search'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'search' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <Search className="h-3.5 w-3.5" /> SKU Query
              </button>
              <button
                onClick={() => { setActiveTab('tree'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'tree' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <GitBranch className="h-3.5 w-3.5" /> Class Tree
              </button>
              <button
                onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600'}`}
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </button>
            </nav>

            <hr className="border-slate-100" />

            {/* Mobile Maintenance Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <label className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 py-1.5 px-3 rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1.5 flex-1">
                <Upload className="h-3.5 w-3.5" /> Restore Backup
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>
              <button 
                onClick={handleExportData}
                className="bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 flex-1"
              >
                <Download className="h-3.5 w-3.5" /> Backup File
              </button>
            </div>
          </div>
        )}

        {/* Primary Page Canvas (Right Hand Side) */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto max-w-(screen-xl) mx-auto w-full" id="primary-content-canvas">
          {syncError ? (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-8 max-w-lg mx-auto my-12 text-center space-y-4 shadow-sm" id="sync-error-boundary">
              <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Connection Sync Issue</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Could not sync with the centralized Firestore cloud database. Please verify your firestore.rules permission configuration.
              </p>
              <div className="text-xs bg-slate-900 text-rose-400 font-mono p-3 rounded-lg text-left overflow-x-auto select-all max-h-40">
                {syncError}
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reconnect Now
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4" id="firebase-loading-fallback">
              <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-500 animate-pulse font-sans">
                Synchronizing with Centralized Cloud Ledger...
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  locations={locations}
                  varieties={varieties}
                  stock={stock}
                  transactions={transactions}
                  onSelectProduct={handleNavigateToProductSearch}
                  onNavigate={(tab) => setActiveTab(tab)}
                  onAddTransaction={handleAddTransaction}
                />
              )}

              {activeTab === 'directory' && (
                <InventoryManager 
                  products={products}
                  varieties={varieties}
                  locations={locations}
                  stock={stock}
                  onAddProduct={handleAddProduct}
                  onAddVariety={handleAddVariety}
                  onDeleteVariety={handleDeleteVariety}
                />
              )}

              {activeTab === 'report' && (
                <ReportForm 
                  locations={locations}
                  varieties={varieties}
                  stock={stock}
                  onAddTransaction={handleAddTransaction}
                />
              )}

              {activeTab === 'search' && (
                <ProductSearchTab 
                  products={products}
                  varieties={varieties}
                  locations={locations}
                  stock={stock}
                  transactions={transactions}
                  selectedVarietyId={selectedVarietyId}
                  onSelectVariety={(id) => setSelectedVarietyId(id)}
                />
              )}

              {activeTab === 'tree' && (
                <CategoryTreeDesk 
                  treeNodes={categoryTree}
                  onAddNode={handleAddCategoryNode}
                  onDeleteNode={handleDeleteCategoryNode}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab locations={locations} />
              )}
            </>
          )}
        </main>

      </div>
    </div>
  );
}
