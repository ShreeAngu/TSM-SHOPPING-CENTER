import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import { Location, Product, ProductVariety, StockLevel, Transaction, CategoryTreeNode } from '../types';

// Error Handling Infrastructure following Firebase Skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Attempts to sign in anonymously if no current user exists.
 * This satisfies standard/default security rules that require authentication (allow read, write: if request.auth != null).
 */
export async function ensureAuthenticated() {
  try {
    if (!auth.currentUser) {
      console.log('No current user detected. Attempting anonymous authentication...');
      await signInAnonymously(auth);
      console.log('Anonymous authentication successful! User UID:', auth.currentUser?.uid);
    }
  } catch (err) {
    console.warn('Anonymous authentication failed (it might be disabled in Firebase Console):', err);
  }
}


export const INITIAL_LOCATIONS: Location[] = [
  { id: 'wh-1', name: 'Warehouse A (Main Depot)', type: 'warehouse', address: '12 Logistics Blvd, Industrial Zone' },
  { id: 'wh-2', name: 'Warehouse B (North Hub)', type: 'warehouse', address: '404 Storage Ave, Northern Business Park' },
  { id: 'st-1', name: 'Downtown Boutique', type: 'store', address: '101 Fashion St, City Center' },
  { id: 'st-2', name: 'Metro Mall Outlet', type: 'store', address: 'Level 2, Premium Shopping Galleria' },
  { id: 'st-3', name: 'Westside Showroom', type: 'store', address: '55 Boulevard Crescent, Westside' },
  { id: 'st-4', name: 'Eastside Plaza', type: 'store', address: '99 Boulevard Plaza, Eastside' },
];

/**
 * Seed Firestore database if it is empty.
 * Checks if mock data exists (product 'p-1') and wipes the database to clear it, seeding only locations.
 */
export async function seedDatabaseIfNeeded() {
  try {
    // Try to ensure the client is authenticated (e.g. anonymous auth) before doing reads/writes
    await ensureAuthenticated();

    // Check if the database contains mock data (identified by the existence of mock product 'p-1')
    const productsSnap = await getDocs(collection(db, 'products'));
    const hasMockData = productsSnap.docs.some(doc => doc.id === 'p-1');

    if (hasMockData) {
      console.log('Mock data detected in Firestore. Initiating automatic removal and database clearing...');
      const batch = writeBatch(db);

      // Clear all mock data collections
      const collectionsToClear = ['locations', 'products', 'varieties', 'stock', 'transactions', 'categoryTree'];
      for (const collName of collectionsToClear) {
        const snap = await getDocs(collection(db, collName));
        snap.forEach(document => {
          batch.delete(doc(db, collName, document.id));
        });
      }
      await batch.commit();

      // Seed ONLY the clean physical locations blueprint so the system is fully operational
      const locBatch = writeBatch(db);
      INITIAL_LOCATIONS.forEach(loc => {
        locBatch.set(doc(db, 'locations', loc.id), loc);
      });
      await locBatch.commit();
      console.log('Mock data removed and physical supply chain locations cleared/reset!');
      return;
    }

    // If locations are empty, seed only base locations
    const locationsSnap = await getDocs(collection(db, 'locations'));
    if (locationsSnap.empty) {
      console.log('Firestore is empty. Seeding physical locations blueprint...');
      const batch = writeBatch(db);
      INITIAL_LOCATIONS.forEach(loc => {
        const docRef = doc(db, 'locations', loc.id);
        batch.set(docRef, loc);
      });
      await batch.commit();
      console.log('Physical supply chain locations seeded successfully!');
    }
  } catch (error) {
    console.warn('Database seeding skipped or failed. This is expected if the security rules on your custom project do not allow unauthenticated or unauthorized writes. Details:', error);
    // Do not throw! Let the application continue so listeners can be mounted.
  }
}

/**
 * Real-time listeners with strict error callbacks
 */
export function listenLocations(callback: (locations: Location[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'locations'), 
    (snapshot) => {
      const list: Location[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Location);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'locations');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function listenProducts(callback: (products: Product[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'products'), 
    (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Product);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'products');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function listenVarieties(callback: (varieties: ProductVariety[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'varieties'), 
    (snapshot) => {
      const list: ProductVariety[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as ProductVariety);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'varieties');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function listenStock(callback: (stock: StockLevel[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'stock'), 
    (snapshot) => {
      const list: StockLevel[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as StockLevel);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'stock');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function listenTransactions(callback: (transactions: Transaction[]) => void, onError?: (error: Error) => void) {
  const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q, 
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as Transaction);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function listenCategoryTree(callback: (treeNodes: CategoryTreeNode[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'categoryTree'), 
    (snapshot) => {
      const list: CategoryTreeNode[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as CategoryTreeNode);
      });
      callback(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'categoryTree');
      } catch (err: any) {
        if (onError) onError(err);
        else throw err;
      }
    }
  );
}

export function cleanDocData<T extends object>(obj: T): T {
  const clean: any = {};
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        clean[key] = cleanDocData(val);
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
}

/**
 * Mutations
 */

// Category Tree Node CRUD
export async function addCategoryNode(node: CategoryTreeNode) {
  try {
    await setDoc(doc(db, 'categoryTree', node.id), cleanDocData(node));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categoryTree/${node.id}`);
  }
}

export async function deleteCategoryNode(nodeId: string) {
  try {
    await deleteDoc(doc(db, 'categoryTree', nodeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categoryTree/${nodeId}`);
  }
}

// Product Management
export async function addProductDoc(product: Product) {
  try {
    await setDoc(doc(db, 'products', product.id), cleanDocData(product));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${product.id}`);
  }
}

// Master pools for dynamic location generation
export const MASTER_POOL_WAREHOUSES: Location[] = [
  { id: 'wh-1', name: 'Warehouse A (Main Depot)', type: 'warehouse', address: '12 Logistics Blvd, Industrial Zone' },
  { id: 'wh-2', name: 'Warehouse B (North Hub)', type: 'warehouse', address: '404 Storage Ave, Northern Business Park' },
  { id: 'wh-3', name: 'Warehouse C (South Terminal)', type: 'warehouse', address: '88 Supply Way, Southern Industrial Park' },
  { id: 'wh-4', name: 'Warehouse D (East Gateway)', type: 'warehouse', address: '71 Express Highway, Eastern District' },
];

export const MASTER_POOL_STORES: Location[] = [
  { id: 'st-1', name: 'Downtown Boutique', type: 'store', address: '101 Fashion St, City Center' },
  { id: 'st-2', name: 'Metro Mall Outlet', type: 'store', address: 'Level 2, Premium Shopping Galleria' },
  { id: 'st-3', name: 'Westside Showroom', type: 'store', address: '55 Boulevard Crescent, Westside' },
  { id: 'st-4', name: 'Eastside Plaza', type: 'store', address: '99 Boulevard Plaza, Eastside' },
  { id: 'st-5', name: 'Southside Hub', type: 'store', address: '12 South Retail Avenue, Southside' },
  { id: 'st-6', name: 'Airport Duty Free', type: 'store', address: 'Terminal 3 Departure Lounge, International Airport' },
];

export async function updateLocationsCountInDb(warehouseCount: number, storeCount: number) {
  try {
    const desiredWarehouses = MASTER_POOL_WAREHOUSES.slice(0, warehouseCount);
    const desiredStores = MASTER_POOL_STORES.slice(0, storeCount);
    const desiredLocations = [...desiredWarehouses, ...desiredStores];
    const desiredIds = new Set(desiredLocations.map(l => l.id));

    // Get current locations in database
    const locationsSnap = await getDocs(collection(db, 'locations'));
    const currentLocIds: string[] = [];
    locationsSnap.forEach(doc => {
      currentLocIds.push(doc.id);
    });

    const batch = writeBatch(db);

    // 1. Add/Update desired locations
    desiredLocations.forEach(loc => {
      const docRef = doc(db, 'locations', loc.id);
      batch.set(docRef, loc);
    });

    // 2. Delete current locations that are NOT in the desired set
    currentLocIds.forEach(id => {
      if (!desiredIds.has(id)) {
        batch.delete(doc(db, 'locations', id));
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'locations_update_count');
  }
}

// Variety & Initial Stock Seeding
export async function addVarietyDoc(variety: ProductVariety, initialStockMap: Record<string, number>) {
  try {
    const batch = writeBatch(db);

    // Set variety doc
    batch.set(doc(db, 'varieties', variety.id), cleanDocData(variety));

    // Add initial stock docs
    Object.entries(initialStockMap).forEach(([locId, qty]) => {
      if (qty > 0) {
        const stockId = `${variety.id}_${locId}`;
        batch.set(doc(db, 'stock', stockId), {
          varietyId: variety.id,
          locationId: locId,
          quantity: qty
        });

        // Log initialization seed transaction
        const txId = `tx-seed-${Date.now()}-${locId}`;
        batch.set(doc(db, 'transactions', txId), cleanDocData({
          id: txId,
          timestamp: new Date().toISOString(),
          type: 'receive',
          sku: variety.sku,
          varietyId: variety.id,
          productId: variety.productId,
          varietyName: variety.varietyName,
          productName: variety.productName,
          toLocationId: locId,
          quantity: qty,
          reportedBy: 'System Initialization',
          notes: `Seeded initial warehouse stock of style directly on registry.`,
          costPrice: variety.costPrice,
          sellingPrice: variety.sellingPrice
        }));
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `varieties/${variety.id}`);
  }
}

export async function deleteVarietyDoc(varietyId: string, associatedStockIds: string[]) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'varieties', varietyId));
    associatedStockIds.forEach(locId => {
      batch.delete(doc(db, 'stock', `${varietyId}_${locId}`));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `varieties/${varietyId}`);
  }
}

// Transaction Logging & Stock Level Propagation (Atomic WriteBatch)
export async function addTransactionDoc(
  tx: Transaction,
  currentStockForVarietyAndFromLoc: number,
  currentStockForVarietyAndToLoc: number
) {
  try {
    const batch = writeBatch(db);

    // 1. Write the transaction
    batch.set(doc(db, 'transactions', tx.id), cleanDocData(tx));

    // 2. Adjust Stock
    const { type, varietyId, fromLocationId, toLocationId, quantity } = tx;

    if (type === 'receive' && toLocationId) {
      const stockId = `${varietyId}_${toLocationId}`;
      batch.set(doc(db, 'stock', stockId), {
        varietyId,
        locationId: toLocationId,
        quantity: Math.max(0, currentStockForVarietyAndToLoc + quantity)
      });
    } else if (type === 'sale' && fromLocationId) {
      const stockId = `${varietyId}_${fromLocationId}`;
      batch.set(doc(db, 'stock', stockId), {
        varietyId,
        locationId: fromLocationId,
        quantity: Math.max(0, currentStockForVarietyAndFromLoc - quantity)
      });
    } else if (type === 'transfer' && fromLocationId && toLocationId) {
      const fromStockId = `${varietyId}_${fromLocationId}`;
      const toStockId = `${varietyId}_${toLocationId}`;

      batch.set(doc(db, 'stock', fromStockId), {
        varietyId,
        locationId: fromLocationId,
        quantity: Math.max(0, currentStockForVarietyAndFromLoc - quantity)
      });

      batch.set(doc(db, 'stock', toStockId), {
        varietyId,
        locationId: toLocationId,
        quantity: Math.max(0, currentStockForVarietyAndToLoc + quantity)
      });
    } else if (type === 'adjustment' && fromLocationId) {
      const stockId = `${varietyId}_${fromLocationId}`;
      batch.set(doc(db, 'stock', stockId), {
        varietyId,
        locationId: fromLocationId,
        quantity: Math.max(0, currentStockForVarietyAndFromLoc + quantity) // can be +/-
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${tx.id}`);
  }
}

// Wipe & Hard Reset Cloud Firestore
export async function resetCloudDatabase() {
  try {
    const batch = writeBatch(db);

    // Delete all existing documents we can find across collections
    const collectionsToClear = ['locations', 'products', 'varieties', 'stock', 'transactions', 'categoryTree'];
    for (const collName of collectionsToClear) {
      const snap = await getDocs(collection(db, collName));
      snap.forEach(document => {
        batch.delete(doc(db, collName, document.id));
      });
    }

    // Commit deletion
    await batch.commit();

    // Re-seed ONLY the clean physical locations blueprint so the system is fully operational
    const seedBatch = writeBatch(db);
    INITIAL_LOCATIONS.forEach(loc => seedBatch.set(doc(db, 'locations', loc.id), loc));

    await seedBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reset_database');
  }
}
