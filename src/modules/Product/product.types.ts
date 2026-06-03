// ─── product.types.ts ─────────────────────────────────────────────────────────
// Centralise all shapes: request DTOs, response DTOs, query filters.
// Never expose the raw DynamoDB / Dynamoose Item directly to callers.

export interface CreateProductDTO {
  name: string;
  price: number;
  category: string;       // GSI partition key  → enables Query by category
  stock: number;
  description?: string;
  image?: string;
}

export interface UpdateProductDTO {
  name?: string;
  price?: number;
  stock?: number;
  description?: string;
  image?: string;
}

export interface ProductFilters {
  category?: string;      // triggers Query (cheap) instead of Scan (expensive)
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
}

export interface PaginationOptions {
  limit?: number;         // default 20, max 100
  lastKey?: Record<string, unknown>; // DynamoDB ExclusiveStartKey (cursor)
}

export interface PaginatedResult<T> {
  items: T[];
  count: number;
  lastKey?: Record<string, unknown>; // pass back to client for next page
  scannedCount?: number;             // useful for debugging filter efficiency
}