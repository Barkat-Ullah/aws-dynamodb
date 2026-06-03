// ─── product.service.ts ───────────────────────────────────────────────────────
//
// DynamoDB operation cheat-sheet used in this file
// ──────────────────────────────────────────────────
//  Model.create()          → PutItem      (write new item, fails if exists)
//  Model.get()             → GetItem      (exact PK lookup, O(1) — cheapest read)
//  Model.update()          → UpdateItem   (partial update, no full read needed)
//  Model.delete()          → DeleteItem   (exact PK delete)
//  Model.query().exec()    → Query        (reads within a partition, uses index)
//  Model.scan().exec()     → Scan         (reads ENTIRE table — use sparingly!)
//  Model.batchGet()        → BatchGetItem (up to 100 items in one round trip)
//  Model.transaction.*     → TransactWrite/TransactGet (ACID across ≤25 ops)

import { ProductModel, Product } from "./product.model";
import { fileService } from "../../utils/fileuploader";
import { getS3KeyFromUrl } from "../../utils/Imagekey";
import AppError from "../../helper/AppError";
import {
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilters,
  PaginationOptions,
  PaginatedResult,
} from "./product.types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE  →  PutItem
// ─────────────────────────────────────────────────────────────────────────────
// Best practice: let the schema default generate productId (UUID v4).
// Never trust the client to supply a PK — it creates collision risk.

const createProduct = async (
  dto: CreateProductDTO,
  file?: Express.Multer.File,
): Promise<Product> => {
  if (file) {
    const uploaded = await fileService.uploadToLocalStack(file);
    dto.image = uploaded.url;
  }

  // Model.create() maps to PutItem — it will overwrite if productId collides,
  // so the UUID default in the schema is important.
  const product = await ProductModel.create(dto);
  return product;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET (single)  →  GetItem
// ─────────────────────────────────────────────────────────────────────────────
// GetItem is the fastest, cheapest DynamoDB operation.
// Always use it when you know the exact partition key.

const getProductById = async (productId: string): Promise<Product> => {
  const product = await ProductModel.get({ productId });
  if (!product) throw new AppError(404, "Product not found");
  return product;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. LIST with cursor pagination  →  Query (GSI) or Scan (fallback)
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚡ Rule of thumb:
//   • If `category` is given  → Query on the GSI  (reads only matching items)
//   • If no filter given       → Scan with limit   (reads whole table — OK for
//                                                   small catalogs / admin UIs)
//
// Cursor pagination (lastKey) vs offset pagination:
//   DynamoDB doesn't support OFFSET.  Instead it returns a `lastEvaluatedKey`
//   that you pass back as `ExclusiveStartKey` to get the next page.
//   This is more efficient and consistent under concurrent writes.

const listProducts = async (
  filters: ProductFilters = {},
  pagination: PaginationOptions = {},
): Promise<PaginatedResult<Product>> => {
  const limit = Math.min(pagination.limit ?? 20, 100);
  const startKey = pagination.lastKey;

  // ── Branch A: category filter → Query on GSI ────────────────────────────
  if (filters.category) {
    let q = ProductModel.query("category")
      .eq(filters.category)
      .using("category-price-index") // explicit GSI name
      .limit(limit);

    if (startKey) q = q.startAt(startKey);

    // Filter by price range AFTER the query reads the GSI partition.
    // Note: FilterExpression in DynamoDB runs AFTER items are read from the
    // index, so it reduces what's returned but NOT the RCU consumed.
    if (filters.minPrice !== undefined) {
      q = q.where("price").ge(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      q = q.where("price").le(filters.maxPrice);
    }
    if (filters.inStockOnly) {
      q = q.where("stock").gt(0);
    }

    const result = await q.exec();
    return {
      items: result,
      count: result.count,
      lastKey: result.lastKey,
      scannedCount: (result as any).scannedCount,
    };
  }

  // ── Branch B: no category → Scan (full table) ────────────────────────────
  // ⚠️  Scan is expensive at scale: it reads every item in the table.
  //     Acceptable for: admin dashboards, small tables, background jobs.
  //     Avoid in high-traffic user-facing endpoints.
  let s = ProductModel.scan().limit(limit);

  if (startKey) s = s.startAt(startKey);
  if (filters.minPrice !== undefined) s = s.where("price").ge(filters.minPrice);
  if (filters.maxPrice !== undefined) s = s.where("price").le(filters.maxPrice);
  if (filters.inStockOnly) s = s.where("stock").gt(0);

  const result = await s.exec();
  return {
    items: result,
    count: result.count,
    lastKey: result.lastKey,
    scannedCount: result.scannedCount, // helps you see how many items were read
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. UPDATE  →  UpdateItem
// ─────────────────────────────────────────────────────────────────────────────
// Best practice: use Model.update() (UpdateItem) instead of
// get-then-save (GetItem + PutItem).
//   • UpdateItem only writes the fields you pass → cheaper WCU
//   • Atomic: no lost-update race condition
//   • DynamoDB supports ADD, DELETE, SET expressions natively

const updateProduct = async (
  productId: string,
  dto: UpdateProductDTO,
  file?: Express.Multer.File,
): Promise<Product> => {
  const existing = await getProductById(productId); // throws 404 if missing

  if (file) {
    if (existing.image) {
      const oldKey = getS3KeyFromUrl(existing.image);
      const uploaded = await fileService.updateFromS3(oldKey, file);
      dto.image = uploaded.url;
    } else {
      const uploaded = await fileService.uploadToLocalStack(file);
      dto.image = uploaded.url;
    }
  }

  // Dynamoose Model.update() generates a DynamoDB UpdateItem expression.
  // Only the fields present in `dto` are written — others are untouched.
  const updated = await ProductModel.update({ productId }, dto);
  return updated;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. ATOMIC STOCK DECREMENT  →  UpdateItem with ADD expression
// ─────────────────────────────────────────────────────────────────────────────
// Industry pattern for inventory: use an atomic counter update with a
// ConditionExpression so stock never goes below zero — no application-level
// read-modify-write race condition.
//
// Raw AWS SDK style shown here because Dynamoose doesn't expose
// ConditionExpression on update directly.

import {
  DynamoDBClient,
  UpdateItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

const decrementStock = async (
  productId: string,
  qty: number,
): Promise<void> => {
  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: "Product",
        Key: { productId: { S: productId } },
        UpdateExpression: "ADD #stock :decrement",
        // ConditionExpression ensures stock >= qty atomically
        ConditionExpression: "#stock >= :qty",
        ExpressionAttributeNames: { "#stock": "stock" },
        ExpressionAttributeValues: {
          ":decrement": { N: String(-qty) },
          ":qty": { N: String(qty) },
        },
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new AppError(409, `Insufficient stock for product ${productId}`);
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. BATCH GET  →  BatchGetItem (up to 100 items, single round-trip)
// ─────────────────────────────────────────────────────────────────────────────
// Use when you need several specific products (e.g. cart items).
// Much cheaper than N individual GetItem calls.

const getProductsByIds = async (productIds: string[]): Promise<Product[]> => {
  if (productIds.length === 0) return [];
  if (productIds.length > 100)
    throw new AppError(400, "BatchGet supports max 100 items");

  // Dynamoose batchGet wraps BatchGetItem
  const results = await ProductModel.batchGet(
    productIds.map((id) => ({ productId: id })),
  );
  return results as Product[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE  →  DeleteItem
// ─────────────────────────────────────────────────────────────────────────────

const deleteProduct = async (productId: string): Promise<void> => {
  const existing = await getProductById(productId);

  if (existing.image) {
    const key = getS3KeyFromUrl(existing.image);
    await fileService.deleteFromS3(key);
  }

  await ProductModel.delete({ productId });
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. PARALLEL GET (Promise.all)
// ─────────────────────────────────────────────────────────────────────────────
// When you need to fetch from multiple tables/models simultaneously,
// fire them in parallel — don't await sequentially.

const getProductWithRelatedData = async (productId: string) => {
  const [product /* reviewsModel.get(...), */] = await Promise.all([
    getProductById(productId),
    // add more parallel fetches here (e.g. ratings, seller info)
  ]);
  return product;
};

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
export const productService = {
  createProduct,
  getProductById,
  listProducts,
  updateProduct,
  decrementStock,
  getProductsByIds,
  deleteProduct,
  getProductWithRelatedData,
};
