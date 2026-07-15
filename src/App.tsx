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
  Settings,
  AlertCircle,
  ArrowRightLeft,
  Trash2
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
  updateLocationDoc,
  updateProductDoc,
  editTransactionDoc,
  resetCloudDatabase,
  revokeTransactionDoc
} from './lib/dbService';
import { writeBatch, doc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

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

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditor, setIsEditor] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ code: string; message: string; isUnauthorizedDomain: boolean } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && user.email) {
        const emailLower = user.email.toLowerCase();
        const isAllowed = ['shreeanguarunachalam@gmail.com', 'surechuchi@gmail.com', '2403717673821050@cit.edu.in'].includes(emailLower) || emailLower.endsWith('@cit.edu.in');
        if (isAllowed) {
          setIsEditor(true);
        } else {
          setIsEditor(false);
        }
      } else {
        setIsEditor(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user && user.email) {
        const emailLower = user.email.toLowerCase();
        const isAllowed = ['shreeanguarunachalam@gmail.com', 'surechuchi@gmail.com', '2403717673821050@cit.edu.in'].includes(emailLower) || emailLower.endsWith('@cit.edu.in');
        if (isAllowed) {
          setIsEditor(true);
        } else {
          setIsEditor(false);
          alert(`Success! Signed in as ${user.email}. Note: This account is in Read-Only Mode because it is not on the authorized editors list.`);
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      const isUnauthorizedDomain = err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'));
      setAuthError({
        code: err.code || 'unknown',
        message: err.message || String(err),
        isUnauthorizedDomain: !!isUnauthorizedDomain
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsEditor(false);
      setCurrentUser(null);
    } catch (err: any) {
      console.error('Sign-Out Error:', err);
    }
  };

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

  // Custom dialog modals and flows
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [wipeIsLoading, setWipeIsLoading] = useState<boolean>(false);

  const [showCategoryDeleteModal, setShowCategoryDeleteModal] = useState<boolean>(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryTreeNode | null>(null);
  const [categoryStocksInvolved, setCategoryStocksInvolved] = useState<{
    varietyId: string;
    varietyName: string;
    sku: string;
    locationId: string;
    locationName: string;
    quantity: number;
  }[]>([]);
  const [categoryDeleteIsLoading, setCategoryDeleteIsLoading] = useState<boolean>(false);

  const [pendingTransferAlert, setPendingTransferAlert] = useState<{
    categoryName: string;
    items: { sku: string; varietyName: string; locationName: string; quantity: number }[];
  } | null>(null);

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
    const handleSubError = (err: Error) => {
      console.error('Active subscription sync error:', err);
      setSyncError(err.message);
      setIsLoading(false);
    };

    seedDatabaseIfNeeded()
      .then(() => {
        unsubLocs = listenLocations((data) => {
          setLocations(data);
          loadedQueries.locs = true;
          checkIfFullyLoaded();
        }, handleSubError);
        unsubProds = listenProducts((data) => {
          setProducts(data);
          loadedQueries.prods = true;
          checkIfFullyLoaded();
        }, handleSubError);
        unsubVars = listenVarieties((data) => {
          setVarieties(data);
          loadedQueries.vars = true;
          checkIfFullyLoaded();
        }, handleSubError);
        unsubStock = listenStock((data) => {
          setStock(data);
          loadedQueries.stock = true;
          checkIfFullyLoaded();
        }, handleSubError);
        unsubTxs = listenTransactions((data) => {
          setTransactions(data);
          loadedQueries.txs = true;
          checkIfFullyLoaded();
        }, handleSubError);
        unsubTree = listenCategoryTree((data) => {
          setCategoryTree(data);
          loadedQueries.tree = true;
          checkIfFullyLoaded();
        }, handleSubError);
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

    // Automatically build the category classification tree
    try {
      // 1. Check if the root category node exists (parentId is null and name matches the product's category)
      let rootNode = categoryTree.find(node => node.parentId === null && node.name.toLowerCase() === newProduct.category.toLowerCase());
      let rootId = '';

      if (!rootNode) {
        // Create root category node
        rootId = `node-cat-${Date.now()}`;
        const newRootNode: CategoryTreeNode = {
          id: rootId,
          name: newProduct.category,
          parentId: null
        };
        await addCategoryNode(newRootNode);
      } else {
        rootId = rootNode.id;
      }

      // 2. Check if a child node for the product name already exists under this root
      const childNode = categoryTree.find(node => node.parentId === rootId && node.name.toLowerCase() === newProduct.name.toLowerCase());
      if (!childNode) {
        // Create child node for the product under the root category
        const newChildNode: CategoryTreeNode = {
          id: `node-prod-${Date.now()}`,
          name: newProduct.name,
          parentId: rootId
        };
        await addCategoryNode(newChildNode);
      }
    } catch (err) {
      console.warn("Failed to auto-update category tree:", err);
    }
  };

  // Edit Product Category (with cached variety productName and category updates)
  const handleEditProduct = async (productId: string, updatedFields: Omit<Product, 'id'>) => {
    const batch = writeBatch(db);
    
    // 1. Update product doc
    const productRef = doc(db, 'products', productId);
    batch.set(productRef, { id: productId, ...updatedFields });

    // 2. Update all associated varieties to keep productName and category synchronized
    const associatedVars = varieties.filter(v => v.productId === productId);
    associatedVars.forEach(v => {
      const varRef = doc(db, 'varieties', v.id);
      batch.update(varRef, {
        productName: updatedFields.name,
        category: updatedFields.category
      });
    });

    // 3. Update corresponding node in categoryTree if exists
    const oldProductObj = products.find(p => p.id === productId);
    if (oldProductObj) {
      const prodNode = categoryTree.find(n => n.name.toLowerCase() === oldProductObj.name.toLowerCase());
      if (prodNode) {
        const nodeRef = doc(db, 'categoryTree', prodNode.id);
        batch.update(nodeRef, { name: updatedFields.name });
      }
    }

    await batch.commit();
  };

  // Delete Product Category (along with varieties, stock, and categoryTree node)
  const handleDeleteProduct = async (productId: string) => {
    const associatedVars = varieties.filter(v => v.productId === productId);
    const varIds = associatedVars.map(v => v.id);
    const locationIds = locations.map(l => l.id);
    
    const batch = writeBatch(db);
    // Delete the product
    batch.delete(doc(db, 'products', productId));
    
    // Delete associated varieties and stock levels
    varIds.forEach(vId => {
      batch.delete(doc(db, 'varieties', vId));
      locationIds.forEach(locId => {
        batch.delete(doc(db, 'stock', `${vId}_${locId}`));
      });
    });

    // Delete corresponding node in the category tree if exists
    const productObj = products.find(p => p.id === productId);
    if (productObj) {
      const prodNode = categoryTree.find(n => n.name.toLowerCase() === productObj.name.toLowerCase());
      if (prodNode) {
        batch.delete(doc(db, 'categoryTree', prodNode.id));
      }
    }

    await batch.commit();
  };

  // 3. Action: Register a Variety SKU and seed initial stock
  const handleAddVariety = async (
    newVariety: Omit<ProductVariety, 'id'>, 
    initialStockMap: Record<string, number>
  ) => {
    const enteredSku = newVariety.sku.toUpperCase().trim();
    const isDuplicate = varieties.some(v => v.sku.toUpperCase().trim() === enteredSku);
    if (isDuplicate) {
      alert(`Error: A variety with the SKU "${enteredSku}" is already registered. Please use a unique SKU.`);
      throw new Error(`SKU "${enteredSku}" already exists.`);
    }

    const generatedId = `v-${Date.now()}`;
    const varietyRecord: ProductVariety = {
      id: generatedId,
      ...newVariety,
      sku: enteredSku
    };
    await addVarietyDoc(varietyRecord, initialStockMap);
  };

  // 4. Action: Delete a variety style (and clean stock states)
  const handleDeleteVariety = async (varietyId: string) => {
    const locationIds = locations.map(l => l.id);
    await deleteVarietyDoc(varietyId, locationIds);
  };

  // Edit existing Transaction Log (and delta corrective stock update)
  const handleEditTransaction = async (oldTx: Transaction, newTx: Transaction) => {
    await editTransactionDoc(oldTx, newTx, stock);
  };

  // Change location name / address
  const handleUpdateLocation = async (updatedLoc: Location) => {
    await updateLocationDoc(updatedLoc);
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

  const handleRevokeTransaction = async (txRecord: Transaction) => {
    await revokeTransactionDoc(txRecord, stock);
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

  const executeCategoryDeletion = async (nodeId: string, actionOnStock: 'discard' | 'ignore' = 'discard') => {
    setCategoryDeleteIsLoading(true);
    try {
      // 1. Get all descendant category node IDs recursively
      const getAllDescendantIds = (id: string): string[] => {
        const children = categoryTree.filter(n => n.parentId === id);
        return [id, ...children.flatMap(child => getAllDescendantIds(child.id))];
      };
      const nodeIdsToDelete = getAllDescendantIds(nodeId);

      const batch = writeBatch(db);

      // Delete category nodes
      nodeIdsToDelete.forEach(id => {
        batch.delete(doc(db, 'categoryTree', id));
      });

      if (actionOnStock === 'discard') {
        // Delete all products in these categories
        const productsInDeletedCats = products.filter(p => nodeIdsToDelete.includes(p.category));
        const productIdsInDeletedCats = productsInDeletedCats.map(p => p.id);

        productsInDeletedCats.forEach(p => {
          batch.delete(doc(db, 'products', p.id));
        });

        // Delete all varieties in these categories or products
        const varietiesInDeletedCats = varieties.filter(v => 
          nodeIdsToDelete.includes(v.category) || productIdsInDeletedCats.includes(v.productId)
        );

        varietiesInDeletedCats.forEach(v => {
          batch.delete(doc(db, 'varieties', v.id));
          // Delete all stock docs for these varieties
          locations.forEach(loc => {
            batch.delete(doc(db, 'stock', `${v.id}_${loc.id}`));
          });
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error during category deletion:', error);
      alert('Error deleting category hierarchy. Please try again.');
    } finally {
      setCategoryDeleteIsLoading(false);
      setShowCategoryDeleteModal(false);
      setCategoryToDelete(null);
      setCategoryStocksInvolved([]);
    }
  };

  const handleDeleteCategoryNode = async (nodeId: string) => {
    // 1. Find the node being deleted
    const node = categoryTree.find(n => n.id === nodeId);
    if (!node) return;

    // 2. Recursively find all child category IDs to be deleted
    const getAllDescendantIds = (id: string): string[] => {
      const children = categoryTree.filter(n => n.parentId === id);
      return [id, ...children.flatMap(child => getAllDescendantIds(child.id))];
    };
    const nodeIdsToDelete = getAllDescendantIds(nodeId);

    // 3. Find any varieties linked to these categories
    const productsInDeletedCats = products.filter(p => nodeIdsToDelete.includes(p.category));
    const productIdsInDeletedCats = productsInDeletedCats.map(p => p.id);

    const varietiesInDeletedCats = varieties.filter(v => 
      nodeIdsToDelete.includes(v.category) || productIdsInDeletedCats.includes(v.productId)
    );
    const varietyIdsInDeletedCats = varietiesInDeletedCats.map(v => v.id);

    // 4. Find all stock levels for these varieties that have non-zero quantity
    const activeStocks = stock.filter(s => 
      varietyIdsInDeletedCats.includes(s.varietyId) && s.quantity > 0
    ).map(s => {
      const variety = varieties.find(v => v.id === s.varietyId);
      const loc = locations.find(l => l.id === s.locationId);
      return {
        varietyId: s.varietyId,
        varietyName: variety ? variety.varietyName : 'Unknown',
        sku: variety ? variety.sku : 'Unknown',
        locationId: s.locationId,
        locationName: loc ? loc.name : 'Unknown Location',
        quantity: s.quantity
      };
    });

    // If there is active stock, we MUST ask the user what to do with it!
    if (activeStocks.length > 0) {
      setCategoryToDelete(node);
      setCategoryStocksInvolved(activeStocks);
      setShowCategoryDeleteModal(true);
    } else {
      // No active stocks. Simple confirmation
      if (window.confirm(`Are you sure you want to delete "${node.name}" and all its subcategories?`)) {
        await executeCategoryDeletion(nodeId, 'discard');
      }
    }
  };

  // 7. Maintenance: Clear Database and reset to clean slate
  const handleResetToDefaults = async () => {
    setShowWipeModal(true);
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
          <div className="shrink-0">
            <img src="/src/assets/images/website_icon_1784108516192.jpg" alt="TSM Logo" className="h-8 w-8 rounded-xl object-cover border border-slate-200" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-800 tracking-tight leading-none font-display uppercase">TSM SHOPPING CENTER</h1>
            <p className="text-[9px] text-indigo-500 font-semibold uppercase tracking-wider mt-0.5">STOCK PORTAL</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center space-x-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-500 tracking-tight">TSM Stock Portal Cloud Node (Online)</span>
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

        {/* Mobile profile & toggle */}
        <div className="flex items-center space-x-2.5 lg:hidden">
          {currentUser && !currentUser.isAnonymous ? (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleSignOut}
                title={`Signed in as ${currentUser.email}. Click to sign out.`}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all border border-slate-200 shrink-0"
              >
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'User'} 
                    className="h-4 w-4 rounded-full border border-white"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-indigo-600 text-white font-bold text-[8px] flex items-center justify-center">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              title="Sign In with Google"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-xl font-bold text-[10px] cursor-pointer flex items-center gap-1.5 border border-indigo-500 shrink-0 transition-all shadow-xs"
            >
              <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="currentColor" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
              </svg>
              <span>Sign In</span>
            </button>
          )}

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex flex-col lg:flex-row" id="applet-body-grid">
        
        {/* Left Navigation Sidebar - Premium Dark Theme */}
        <aside className="lg:w-64 bg-slate-900 text-slate-300 p-5 shrink-0 hidden lg:flex flex-col justify-between border-r border-slate-800" id="applet-sidebar">
          <div className="space-y-8">
            {/* Brand Logo Header */}
            <div className="flex items-center space-x-3 px-1 py-1">
              <div className="shrink-0 bg-slate-800 p-1.5 rounded-xl border border-slate-700/60 shadow-inner">
                <img src="/src/assets/images/website_icon_1784108516192.jpg" alt="TSM Logo" className="h-10 w-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h1 className="text-[13px] font-black text-white tracking-tight leading-tight font-display uppercase">TSM SHOPPING</h1>
                <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">STOCK PORTAL</p>
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

          {/* User Authentication Profile Card */}
          <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3.5" id="sidebar-auth-panel">
            <div className="flex items-center gap-1.5 font-bold text-slate-400 text-[10px] uppercase tracking-wider">
              <span>Security & Access</span>
            </div>
            {currentUser && !currentUser.isAnonymous ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'User'} 
                      className="h-9 w-9 rounded-full border border-slate-700 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center border border-indigo-500 shadow-sm">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">{currentUser.displayName || 'TSM User'}</p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{currentUser.email}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {isEditor ? (
                    <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Authorized Editor
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-400/20 rounded-lg">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Read-Only Viewer
                    </span>
                  )}
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full text-center py-1.5 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    Disconnect Profile
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2.5 text-[11px] text-amber-300 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                    Read-Only Mode
                  </p>
                  <p className="text-slate-400 text-[10px]">
                    Anyone can view data. Log in to perform additions, edits, or deletions.
                  </p>
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2 border border-indigo-500"
                >
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="currentColor" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                  </svg>
                  Sign In with Google
                </button>
              </div>
            )}
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
          <div className="lg:hidden bg-white border-b border-slate-200 p-4 space-y-3.5 shadow-md animate-fadeIn" id="mobile-navigation-dropdown">
            
            {/* Mobile Auth & Security Info Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Security & Authorization</span>
                {currentUser && !currentUser.isAnonymous ? (
                  isEditor ? (
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Editor</span>
                  ) : (
                    <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Read-Only</span>
                  )
                ) : (
                  <span className="text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">Guest</span>
                )}
              </div>
              
              {currentUser && !currentUser.isAnonymous ? (
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {currentUser.photoURL ? (
                      <img 
                        src={currentUser.photoURL} 
                        alt={currentUser.displayName || 'User'} 
                        className="h-8 w-8 rounded-full border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                        {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate leading-tight">{currentUser.displayName || 'TSM User'}</p>
                      <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{currentUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-[10px] text-rose-600 hover:text-rose-500 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500 leading-normal">
                    You are currently in guest mode. Sign in to add or edit inventory items.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 border border-indigo-500"
                  >
                    <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="currentColor" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                    </svg>
                    Sign In with Google
                  </button>
                </div>
              )}
            </div>

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
            <div className="max-w-2xl mx-auto my-12 space-y-6" id="sync-error-boundary">
              {syncError.toLowerCase().includes('permission') || syncError.toLowerCase().includes('insufficient') ? (
                <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Firestore Access Adjustment Required</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                        You have successfully updated your configuration to connect to your custom external Firebase project (<span className="font-semibold text-indigo-600 font-mono">tsm-shopping-center</span>). 
                        However, because this is an external project, we do not have permission to automatically deploy the Firestore security rules.
                      </p>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quick Resolution Steps:</h4>
                    <ol className="text-sm text-slate-600 space-y-3 list-decimal pl-5">
                      <li>
                        Open your <a href="https://console.firebase.google.com/project/tsm-shopping-center/firestore/rules" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5">Firebase Console Rules page <span className="text-[10px]">↗</span></a> for <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">tsm-shopping-center</span>.
                      </li>
                      <li>
                        Paste the following security rules into the online editor (enables read and write access for all collections):
                        <div className="mt-2 text-xs bg-slate-950 text-indigo-200 font-mono p-4 rounded-xl text-left overflow-x-auto select-all shadow-inner leading-relaxed max-h-56">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                        </div>
                      </li>
                      <li>
                        Click the <strong className="text-slate-800 font-bold">Publish</strong> button in the Firebase Console.
                      </li>
                      <li>
                        Wait 5-10 seconds for Google's servers to distribute the rules, then click the button below:
                      </li>
                    </ol>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs space-y-1 text-slate-500">
                    <p className="font-semibold text-slate-700">Detailed error payload for reference:</p>
                    <p className="font-mono select-all overflow-x-auto text-[11px] bg-white p-2 rounded border border-slate-200 mt-1">{syncError}</p>
                  </div>

                  <div className="flex items-center justify-end">
                    <button 
                      onClick={() => window.location.reload()}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md shadow-indigo-600/10"
                    >
                      <RefreshCw className="h-4 w-4" /> Reconnect & Seed Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center space-y-4 shadow-xs">
                  <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Connection Sync Issue</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Could not sync with your centralized Firestore cloud database. Please verify your firestore.rules permission configuration.
                  </p>
                  <div className="text-xs bg-slate-900 text-rose-400 font-mono p-4 rounded-xl text-left overflow-x-auto select-all max-h-40">
                    {syncError}
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reconnect Now
                  </button>
                </div>
              )}
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
                  onEditProduct={handleEditProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddVariety={handleAddVariety}
                  onDeleteVariety={handleDeleteVariety}
                  isEditor={isEditor}
                />
              )}

              {activeTab === 'report' && (
                <>
                  {pendingTransferAlert && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-6 space-y-3" id="pending-transfer-banner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-5 w-5 text-indigo-600 animate-pulse" />
                          <h4 className="font-bold text-indigo-900 text-sm">
                            Pending Stock Transfers for Category "{pendingTransferAlert.categoryName}"
                          </h4>
                        </div>
                        <button 
                          onClick={() => setPendingTransferAlert(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-2 py-1 rounded-md hover:bg-slate-200/50 cursor-pointer"
                        >
                          Dismiss List
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Before deleting this category, you should transfer these remaining items to another category, location, or file negative adjustments to zero them out. Use the reporting form below to log these worker activity reports.
                      </p>
                      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="py-2 px-3">SKU</th>
                              <th className="py-2 px-3">Variety / Description</th>
                              <th className="py-2 px-3">Current Location</th>
                              <th className="py-2 px-3 text-right">In Stock Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {pendingTransferAlert.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-indigo-50/20">
                                <td className="py-2 px-3 font-mono font-bold text-indigo-700">{item.sku}</td>
                                <td className="py-2 px-3">{item.varietyName}</td>
                                <td className="py-2 px-3 text-slate-600">{item.locationName}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{item.quantity} pcs</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <ReportForm 
                    locations={locations}
                    varieties={varieties}
                    stock={stock}
                    transactions={transactions}
                    onAddTransaction={handleAddTransaction}
                    onRevokeTransaction={handleRevokeTransaction}
                    isEditor={isEditor}
                  />
                </>
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
                  isEditor={isEditor}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab 
                  locations={locations} 
                  varieties={varieties}
                  stock={stock}
                  isEditor={isEditor} 
                  onUpdateLocation={handleUpdateLocation}
                  onAddTransaction={handleAddTransaction}
                />
              )}
            </>
          )}
        </main>

      </div>

      {/* Modal: Authentication Error details and guide */}
      {authError && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" id="auth-error-modal-overlay">
          <div className="bg-white rounded-3xl border border-slate-100 p-7 max-w-lg w-full shadow-2xl relative" id="auth-error-modal-content">
            <button 
              onClick={() => setAuthError(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer"
              title="Close"
              id="auth-error-modal-close-btn"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 leading-snug">Google Sign-In Failed</h3>
                <p className="text-xs text-slate-400 font-mono mt-1 select-all">Code: {authError.code}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-50/50 border border-rose-100/60 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-rose-700 mb-1">Error Message:</p>
                <p className="font-mono text-slate-600 select-all">{authError.message}</p>
              </div>

              {authError.isUnauthorizedDomain ? (
                <div className="space-y-3.5 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-4 text-xs text-slate-600">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                    How to authorize your dev environment:
                  </div>
                  <p className="leading-relaxed">
                    Firebase requires the app's domain to be added to the authorized list for Google Authentication to complete.
                  </p>
                  
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-700">1. Copy this domain:</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-slate-100 border border-slate-200 text-indigo-700 px-3 py-1.5 rounded-xl font-mono font-bold select-all text-xs flex-1 truncate">
                        {window.location.hostname}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-2 leading-relaxed">
                    <p className="font-semibold text-slate-700">2. Update Firebase settings:</p>
                    <ol className="list-decimal pl-4.5 space-y-1 text-[11px] text-slate-500">
                      <li>Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline">Firebase Console</a>.</li>
                      <li>In the left menu, select <strong>Authentication</strong>.</li>
                      <li>Click the <strong>Settings</strong> tab at the top.</li>
                      <li>Select <strong>Authorized domains</strong> from the sidebar/list.</li>
                      <li>Click <strong>Add domain</strong> and paste <code className="font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded">{window.location.hostname}</code>.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Please verify your network connection, Google Account selection, or Firebase project configuration settings.
                </p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setAuthError(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  id="auth-error-dismiss-btn"
                >
                  Dismiss
                </button>
                {authError.isUnauthorizedDomain && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.hostname);
                      alert('Domain copied to clipboard!');
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer text-center"
                    id="auth-error-copy-domain-btn"
                  >
                    Copy Domain
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Wipe & Clear Cloud Database */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Wipe & Clear Cloud Database</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Choose your database reset preferences</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Please select whether you want to perform a partial wipe of stock levels or completely wipe the entire workspace back to clean defaults.
              </p>

              <div className="space-y-2.5">
                {/* Option 1: Only Stocks */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you absolutely sure you want to delete ONLY stock levels and transaction logs? Categories, varieties, products, and locations will remain.')) {
                      setWipeIsLoading(true);
                      try {
                        await resetCloudDatabase(true);
                        alert('Stock levels and transaction history cleared successfully!');
                      } catch (e) {
                        alert('Failed to reset stocks.');
                      } finally {
                        setWipeIsLoading(false);
                        setShowWipeModal(false);
                      }
                    }
                  }}
                  disabled={wipeIsLoading}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 mt-0.5">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Delete Stocks & Logs Only</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Removes all stock records & transaction histories. Keeps categories, product specifications, and varieties intact.
                    </p>
                  </div>
                </button>

                {/* Option 2: Full Wipe */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you absolutely sure you want to wipe the ENTIRE database? This will permanently delete categories, products, varieties, stocks, and transaction logs, resetting everything.')) {
                      setWipeIsLoading(true);
                      try {
                        await resetCloudDatabase(false);
                        alert('Entire cloud database cleared successfully!');
                      } catch (e) {
                        alert('Failed to reset database.');
                      } finally {
                        setWipeIsLoading(false);
                        setShowWipeModal(false);
                      }
                    }
                  }}
                  disabled={wipeIsLoading}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/20 transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Wipe Everything (Full Slate)</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Erase absolutely everything: products, varieties, stocks, transaction logs, and category trees. Re-seeds clean locations.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-4">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                disabled={wipeIsLoading}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200/80 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Category Deletion Stock Warning */}
      {showCategoryDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Category Stock Warning</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Category "{categoryToDelete.name}" has active stock levels</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed">
                There are currently <span className="font-bold text-slate-800">{categoryStocksInvolved.reduce((sum, item) => sum + item.quantity, 0)} pcs</span> in stock belonging to products in this category hierarchy. What would you like to do with these stocks?
              </p>

              {/* List of active stocks */}
              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2">
                <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Active Stocks:</p>
                {categoryStocksInvolved.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{item.sku}</span>
                      <span className="truncate max-w-[150px]">{item.varietyName}</span>
                      <span className="text-slate-400 text-[10px]">({item.locationName})</span>
                    </div>
                    <span className="font-bold font-mono text-slate-800">{item.quantity} pcs</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                {/* Option 1: Discard stock */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to discard all stock in this category? This will delete the products, variety SKUs, and stock records belonging to this category hierarchy.')) {
                      await executeCategoryDeletion(categoryToDelete.id, 'discard');
                    }
                  }}
                  disabled={categoryDeleteIsLoading}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/20 transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-100 mt-0.5">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Discard all stock and delete</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Deletes the category, and permanently deletes all products, varieties, and stock records in this hierarchy.
                    </p>
                  </div>
                </button>

                {/* Option 2: Transfer stock */}
                <button
                  type="button"
                  onClick={() => {
                    // Set pending transfers alert and switch tab
                    setPendingTransferAlert({
                      categoryName: categoryToDelete.name,
                      items: categoryStocksInvolved
                    });
                    setShowCategoryDeleteModal(false);
                    setActiveTab('report'); // Switch to 'Log Worker Reports'
                  }}
                  disabled={categoryDeleteIsLoading}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all group flex items-start gap-3 cursor-pointer"
                >
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 mt-0.5">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">Transfer stocks using worker reports</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Keep the category for now. We will direct you to the Log Worker Reports tab and display this list so you can transfer these stocks.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryDeleteModal(false);
                  setCategoryToDelete(null);
                  setCategoryStocksInvolved([]);
                }}
                disabled={categoryDeleteIsLoading}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200/80 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
