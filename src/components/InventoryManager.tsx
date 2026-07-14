import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  FolderPlus, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  DollarSign, 
  Barcode, 
  Warehouse, 
  Store, 
  Trash2,
  Edit2,
  Image as ImageIcon
} from 'lucide-react';
import { Product, ProductVariety, Location, StockLevel } from '../types';

interface InventoryManagerProps {
  products: Product[];
  varieties: ProductVariety[];
  locations: Location[];
  stock: StockLevel[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onAddVariety: (variety: Omit<ProductVariety, 'id'>, initialStocks: Record<string, number>) => void;
  onDeleteVariety: (varietyId: string) => void;
  isEditor?: boolean;
}

export default function InventoryManager({
  products,
  varieties,
  locations,
  stock,
  onAddProduct,
  onAddVariety,
  onDeleteVariety,
  isEditor = false
}: InventoryManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Expanded state for product rows
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Forms state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddVarietyModal, setShowAddVarietyModal] = useState(false);
  
  // New Product Form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Handbags');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [newProdImage, setNewProdImage] = useState('');
  const [showProdImageField, setShowProdImageField] = useState(false);

  // New Variety Form state
  const [selectedParentProductId, setSelectedParentProductId] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newVarSku, setNewVarSku] = useState('');
  const [newVarCost, setNewVarCost] = useState('');
  const [newVarSell, setNewVarSell] = useState('');
  const [initialStocks, setInitialStocks] = useState<Record<string, number>>({});
  const [newVarImage, setNewVarImage] = useState('');
  const [showVarImageField, setShowVarImageField] = useState(false);

  // Unique categories list
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    const categoryToSave = isCustomCategory ? customCategory.trim() : newProdCategory;
    if (!categoryToSave) return;

    onAddProduct({
      name: newProdName,
      category: categoryToSave,
      description: newProdDesc,
      imageUrl: showProdImageField ? newProdImage.trim() : undefined
    });

    // Reset Form
    setNewProdName('');
    setNewProdDesc('');
    setCustomCategory('');
    setIsCustomCategory(false);
    setNewProdImage('');
    setShowProdImageField(false);
    setShowAddProductModal(false);
  };

  const handleCreateVariety = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentProductId || !newVarName.trim() || !newVarSku.trim() || !newVarCost || !newVarSell) {
      alert('Please fill in all variety fields');
      return;
    }

    const parentProduct = products.find(p => p.id === selectedParentProductId);
    if (!parentProduct) return;

    onAddVariety({
      productId: selectedParentProductId,
      productName: parentProduct.name,
      sku: newVarSku.toUpperCase().trim(),
      varietyName: newVarName,
      costPrice: parseFloat(newVarCost),
      sellingPrice: parseFloat(newVarSell),
      category: parentProduct.category,
      imageUrl: showVarImageField ? newVarImage.trim() : undefined
    }, initialStocks);

    // Reset Variety Form
    setNewVarName('');
    setNewVarSku('');
    setNewVarCost('');
    setNewVarSell('');
    setInitialStocks({});
    setNewVarImage('');
    setShowVarImageField(false);
    setShowAddVarietyModal(false);
  };

  const handleInitialStockChange = (locId: string, val: string) => {
    const parsed = parseInt(val, 10);
    setInitialStocks(prev => ({
      ...prev,
      [locId]: isNaN(parsed) ? 0 : parsed
    }));
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          varieties.some(v => v.productId === p.id && v.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6" id="inventory-manager-container">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Inventory Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Add new products, specify multiple varieties/types, and configure cost and selling prices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setShowAddProductModal(true)}
            disabled={!isEditor}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              isEditor 
                ? 'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white cursor-pointer' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
            id="add-product-btn"
            title={isEditor ? "Add a new product category" : "Log in as an authorized editor to add products"}
          >
            <FolderPlus className="h-4 w-4" /> Add Product Category
          </button>
          <button
            onClick={() => {
              if (products.length === 0) {
                alert('Please create at least one product first before adding varieties.');
                return;
              }
              setSelectedParentProductId(products[0].id);
              setShowAddVarietyModal(true);
            }}
            disabled={!isEditor}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              isEditor
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white cursor-pointer'
                : 'bg-indigo-50 text-indigo-300 cursor-not-allowed border border-indigo-100/50'
            }`}
            id="add-variety-btn"
            title={isEditor ? "Add a new variety style or SKU" : "Log in as an authorized editor to add varieties"}
          >
            <Plus className="h-4 w-4" /> Add Variety / SKU
          </button>
        </div>
      </div>

      {/* Read-Only Status Notice Banner */}
      {!isEditor && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-amber-800 shadow-2xs" id="read-only-banner">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">Read-Only Mode:</span> You are currently viewing the live ledger. Registering new products, adding variety styles, or deleting SKUs is locked. Log in using an authorized Google Sign-In account (shreeanguarunachalam@gmail.com or surechuchi@gmail.com) in the left sidebar to perform edits.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs" id="inventory-filters">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products and Varieties Collapsible Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="products-table-box">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No products found matching your filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => {
              const productVarieties = varieties.filter(v => v.productId === product.id);
              const isExpanded = !!expandedProducts[product.id];
              const varietyCount = productVarieties.length;

              return (
                <div key={product.id} className="transition-all" id={`product-row-${product.id}`}>
                  {/* Parent Product Header */}
                  <div 
                    onClick={() => toggleExpand(product.id)}
                    className={`p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-all ${isExpanded ? 'bg-slate-50/20 border-b border-slate-100/40' : ''}`}
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3.5">
                      {product.imageUrl && (
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          className="h-11 w-11 rounded-xl object-cover border border-slate-200/80 shrink-0 shadow-2xs" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {product.category}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {varietyCount} {varietyCount === 1 ? 'Variety' : 'Varieties'} / SKUs
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 mt-1">{product.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{product.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50/70 px-2.5 py-1 rounded-lg">
                        Manage SKUs
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Collapsible Varieties Area */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-slate-50/40"
                      >
                        {varietyCount === 0 ? (
                          <div className="p-5 text-center text-xs text-slate-400">
                            No varieties created yet for this product. Click "Add Variety / SKU" above to add sizes, colors, or types!
                          </div>
                        ) : (
                          <div className="p-5 pt-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse mt-4">
                              <thead>
                                <tr className="border-b border-slate-200/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                                  <th className="py-2.5 px-3">SKU</th>
                                  <th className="py-2.5 px-3">Variety / Description</th>
                                  <th className="py-2.5 px-3 text-right">Cost Price (Me)</th>
                                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                                  <th className="py-2.5 px-3 text-right">Markup %</th>
                                  <th className="py-2.5 px-3 text-center">Total Stock</th>
                                  <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {productVarieties.map((variety) => {
                                  // Compute total stock
                                  const totalVarStock = stock
                                    .filter(s => s.varietyId === variety.id)
                                    .reduce((sum, s) => sum + s.quantity, 0);

                                  const markup = variety.costPrice > 0 
                                    ? ((variety.sellingPrice - variety.costPrice) / variety.costPrice) * 100 
                                    : 0;

                                  return (
                                    <tr key={variety.id} className="hover:bg-white transition-all text-xs">
                                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                                        {variety.sku}
                                      </td>
                                      <td className="py-3 px-3 font-medium text-slate-800">
                                        <div className="flex items-center gap-2">
                                          {variety.imageUrl && (
                                            <img 
                                              src={variety.imageUrl} 
                                              alt={variety.varietyName} 
                                              className="h-8 w-8 rounded-md object-cover border border-slate-200/80 shrink-0 shadow-3xs" 
                                              referrerPolicy="no-referrer"
                                            />
                                          )}
                                          <span>{variety.varietyName}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-600">
                                        ${variety.costPrice.toFixed(2)}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                        ${variety.sellingPrice.toFixed(2)}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600">
                                        {markup.toFixed(1)}%
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                                          totalVarStock === 0 
                                            ? 'bg-rose-50 text-rose-700' 
                                            : totalVarStock <= 10 
                                            ? 'bg-amber-50 text-amber-700' 
                                            : 'bg-slate-100 text-slate-700'
                                        }`}>
                                          {totalVarStock} pcs
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        <button
                                          onClick={() => {
                                            if (!isEditor) return;
                                            if (confirm(`Are you sure you want to delete variety SKU ${variety.sku}? This will clear its stock levels.`)) {
                                              onDeleteVariety(variety.id);
                                            }
                                          }}
                                          disabled={!isEditor}
                                          className={`p-1 rounded-md transition-all ${
                                            isEditor 
                                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer' 
                                              : 'text-slate-300 opacity-45 cursor-not-allowed'
                                          }`}
                                          title={isEditor ? "Delete Variety" : "Deleting is restricted to authorized editors"}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Product Category */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-100 p-6 max-w-md w-full shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-indigo-600" />
                Add Product Category Group
              </h3>
              <button 
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Product Name / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leather Satchel Handbags"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category Group
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-[11px] text-indigo-600 font-semibold hover:underline"
                  >
                    {isCustomCategory ? 'Select Existing' : 'Create Custom'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    placeholder="e.g. Wallets, Footwear, Bags"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                    required
                  />
                ) : (
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="Handbags">Handbags</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Product Description
                </label>
                <textarea
                  placeholder="Details about material, specs, fabric..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Product Image (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProdImageField(!showProdImageField)}
                    className="text-[11px] text-indigo-600 font-semibold hover:underline"
                  >
                    {showProdImageField ? 'Hide Field' : 'Add Image URL'}
                  </button>
                </div>
                {showProdImageField && (
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or any image URL"
                    value={newProdImage}
                    onChange={(e) => setNewProdImage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all animate-fadeIn"
                  />
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                >
                  Create Product Group
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal: Add Variety / SKU */}
      {showAddVarietyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-100 p-6 max-w-lg w-full shadow-lg overflow-y-auto max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-600" />
                Add Specific Variety SKU
              </h3>
              <button 
                onClick={() => setShowAddVarietyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateVariety} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Product Group
                </label>
                <select
                  value={selectedParentProductId}
                  onChange={(e) => setSelectedParentProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Variety / Type Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tan Calfskin (Large)"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Barcode className="h-3 w-3" /> SKU Code (Unique)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HB-SAF-TAN-L"
                    value={newVarSku}
                    onChange={(e) => setNewVarSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-emerald-600" /> Cost Price (To Purchase)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 45.00"
                    value={newVarCost}
                    onChange={(e) => setNewVarCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-indigo-600" /> Selling Price (Retail)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 110.00"
                    value={newVarSell}
                    onChange={(e) => setNewVarSell(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Variety Image (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVarImageField(!showVarImageField)}
                    className="text-[11px] text-indigo-600 font-semibold hover:underline"
                  >
                    {showVarImageField ? 'Hide Field' : 'Add Image URL'}
                  </button>
                </div>
                {showVarImageField && (
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/... or any style image URL"
                    value={newVarImage}
                    onChange={(e) => setNewVarImage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all animate-fadeIn"
                  />
                )}
              </div>

              {/* Initial Stock Seeding */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5 text-slate-500" />
                  Initialize Stock Levels (Optional)
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">Set original stock quantities across your store/warehouse network.</p>

                <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {locations.map(loc => (
                    <div key={loc.id} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100/85">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium truncate">
                        {loc.type === 'warehouse' ? <Warehouse className="h-3 w-3 text-orange-500" /> : <Store className="h-3 w-3 text-emerald-500" />}
                        <span className="truncate">{loc.name}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={initialStocks[loc.id] || ''}
                        onChange={(e) => handleInitialStockChange(loc.id, e.target.value)}
                        className="w-14 bg-slate-50 border border-slate-200 rounded text-center text-xs font-mono py-1 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                >
                  Create Variety SKU
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
