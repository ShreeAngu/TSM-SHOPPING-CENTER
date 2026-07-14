export type LocationType = 'warehouse' | 'store';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
}

export interface ProductVariety {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  varietyName: string; // e.g. "Black Suede", "Tan Leather", etc.
  costPrice: number;   // Cost to purchase
  sellingPrice: number; // Retail price
  category: string;
  imageUrl?: string;
}

export interface StockLevel {
  varietyId: string;
  locationId: string;
  quantity: number;
}

export type TransactionType = 'receive' | 'transfer' | 'sale' | 'adjustment';

export interface Transaction {
  id: string;
  timestamp: string; // ISO String
  type: TransactionType;
  sku: string;
  varietyId: string;
  productId: string;
  varietyName: string;
  productName: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  reportedBy: string; // Worker name / Admin
  notes?: string;
  costPrice: number;   // recorded at time of transaction
  sellingPrice: number; // recorded at time of transaction
}

export interface DashboardStats {
  totalItems: number;
  totalValuationCost: number;
  totalValuationRetail: number;
  lowStockAlerts: number;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string | null; // null for roots like "Hand Bag"
}

