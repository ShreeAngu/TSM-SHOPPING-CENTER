import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitCommit, 
  Plus, 
  Trash2, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  FolderPlus, 
  Tag, 
  Layers,
  ArrowRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { CategoryTreeNode } from '../types';

interface CategoryTreeDeskProps {
  treeNodes: CategoryTreeNode[];
  onAddNode: (name: string, parentId: string | null) => Promise<void>;
  onDeleteNode: (id: string) => Promise<void>;
  isEditor?: boolean;
}

export default function CategoryTreeDesk({ treeNodes, onAddNode, onDeleteNode, isEditor = false }: CategoryTreeDeskProps) {
  const [newRootName, setNewRootName] = useState('');
  const [activeParentAddId, setActiveParentAddId] = useState<string | null>(null);
  const [childNodeName, setChildNodeName] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'node-handbag': true,
    'node-footwear': true
  });

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim()) return;
    await onAddNode(newRootName.trim(), null);
    setNewRootName('');
  };

  const handleAddChild = async (parentId: string) => {
    if (!childNodeName.trim()) return;
    await onAddNode(childNodeName.trim(), parentId);
    setChildNodeName('');
    setActiveParentAddId(null);
    setExpandedNodes(prev => ({ ...prev, [parentId]: true }));
  };

  // Build recursive node hierarchy
  const roots = treeNodes.filter(node => node.parentId === null);

  const renderTreeNode = (node: CategoryTreeNode, level: number = 0) => {
    const children = treeNodes.filter(child => child.parentId === node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes[node.id];
    const isAddingChild = activeParentAddId === node.id;

    return (
      <div key={node.id} className="select-none" style={{ marginLeft: `${level > 0 ? 24 : 0}px` }}>
        <div className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100 group mt-1">
          <div className="flex items-center gap-2.5">
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(node.id)}
                className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 cursor-pointer transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-6 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              </div>
            )}
            
            <Folder className={`h-4 w-4 shrink-0 ${level === 0 ? 'text-indigo-500' : level === 1 ? 'text-teal-500' : 'text-amber-500'}`} />
            <span className={`text-xs ${level === 0 ? 'font-bold text-slate-800' : level === 1 ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
              {node.name}
            </span>
            {hasChildren && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-bold">
                {children.length}
              </span>
            )}
          </div>

          {isEditor && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setActiveParentAddId(isAddingChild ? null : node.id);
                  setChildNodeName('');
                }}
                className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 cursor-pointer transition-all"
                title="Add sub-specification"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete "${node.name}" and all its subcategories?`)) {
                    onDeleteNode(node.id);
                  }
                }}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 cursor-pointer transition-all"
                title="Delete node"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Form to add child under this node */}
        {isAddingChild && (
          <div className="mt-1 ml-6 p-2 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-2 max-w-sm">
            <input
              type="text"
              placeholder={`Sub-spec under ${node.name}`}
              value={childNodeName}
              onChange={(e) => setChildNodeName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
              autoFocus
            />
            <button
              onClick={() => handleAddChild(node.id)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded-lg cursor-pointer text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setActiveParentAddId(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1 font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Recursive Children rendering */}
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-l border-slate-100 ml-3"
            >
              {children.map(child => renderTreeNode(child, level + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="category-tree-tab-pane">
      {/* Tab Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5 font-display">
            <Layers className="h-5.5 w-5.5 text-indigo-600" />
            Product Classification Tree Editor
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build and configure generic, nested specification chains (Root Class → Secondary Spec → Attribute Levels) that unify SKU registry and logistics.
          </p>
        </div>
        
        {!isEditor ? (
          <div className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Read-Only Inspector
          </div>
        ) : (
          <form onSubmit={handleAddRoot} className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <input
              type="text"
              placeholder="Create New Root Node..."
              value={newRootName}
              onChange={(e) => setNewRootName(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs font-semibold shadow-2xs outline-hidden focus:ring-1 focus:ring-indigo-500 w-full sm:w-60"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1 shrink-0 transition-all"
            >
              <Plus className="h-4 w-4" /> Root Class
            </button>
          </form>
        )}
      </div>

      {/* Read-Only Status Notice Banner */}
      {!isEditor && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5 text-xs text-amber-800 shadow-2xs" id="read-only-tree-banner">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-bold">Read-Only Mode:</span> Classification tree hierarchy modifications are locked. Log in using an authorized Google Sign-In account (shreeanguarunachalam@gmail.com or surechuchi@gmail.com) in the left sidebar to add sub-specifications or delete classes.
          </div>
        </div>
      )}

      {/* Main Grid: Visual Tree on Left, Usage documentation/Pathfinder on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Tree Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display">
            Hierarchy Inspector
          </h3>

          <div className="divide-y divide-slate-100 bg-slate-50/40 rounded-2xl p-4 border border-slate-100">
            {roots.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No hierarchy trees defined yet. Create a root class node above (e.g. "Hand Bag") to begin.
              </div>
            ) : (
              roots.map(root => (
                <div key={root.id} className="py-2 first:pt-0 last:pb-0">
                  {renderTreeNode(root)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hierarchy Information & Direct Path Finder */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6 self-start">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-display flex items-center gap-1.5">
              <Info className="h-4 w-4 text-indigo-500" />
              Integration Rules
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              When registering new SKUs or monitoring low stocks, the warehouse fulfillment managers use this structure to match products precisely to physical items.
            </p>
          </div>

          <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-indigo-900 font-display flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-indigo-500" />
              Active Specification Chains
            </h4>
            
            <div className="space-y-2.5">
              {roots.slice(0, 3).map(root => {
                const subNodes = treeNodes.filter(n => n.parentId === root.id);
                return (
                  <div key={root.id} className="text-[11px] text-slate-600 space-y-1">
                    <div className="font-bold text-indigo-800 flex items-center gap-1">
                      <span>{root.name}</span>
                      <ArrowRight className="h-3 w-3 text-indigo-400" />
                    </div>
                    {subNodes.length === 0 ? (
                      <p className="text-slate-400 italic pl-3">No subclasses added yet.</p>
                    ) : (
                      <div className="pl-3 border-l-2 border-indigo-100 space-y-1">
                        {subNodes.slice(0, 2).map(sub => {
                          const leafNodes = treeNodes.filter(n => n.parentId === sub.id);
                          return (
                            <div key={sub.id} className="text-slate-500">
                              <span className="font-semibold">{sub.name}</span>
                              {leafNodes.length > 0 && (
                                <span className="text-[10px] text-indigo-500 font-mono">
                                  {' '}→ ({leafNodes.map(l => l.name).join(', ')})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
