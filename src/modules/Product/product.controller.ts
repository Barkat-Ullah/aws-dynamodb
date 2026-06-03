import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { sendResponse, sendError } from "../../utils/sendResponse";
import { productService } from "./product.service";
 
// ── POST /products ────────────────────────────────────────────────────────────
export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const dto = req.body.data ? JSON.parse(req.body.data) : req.body;
  if (typeof dto.price === "string") dto.price = Number(dto.price);
  if (typeof dto.stock === "string") dto.stock = Number(dto.stock);
 
  const product = await productService.createProduct(dto, req.file);
  return sendResponse(res, { statusCode: 201, message: "Product created", data: product });
});
 
// ── GET /products ─────────────────────────────────────────────────────────────
// Supports cursor-based pagination: ?limit=20&lastKey=<base64>
// Also supports: ?category=electronics&minPrice=100&inStockOnly=true
export const listProducts = catchAsync(async (req: Request, res: Response) => {
  const { limit, category, minPrice, maxPrice, inStockOnly, lastKey } = req.query;
 
  const pagination = {
    limit: limit ? Math.min(Number(limit), 100) : 20,
    // Client sends lastKey as base64 JSON (safer than raw JSON in query string)
    lastKey: lastKey
      ? JSON.parse(Buffer.from(lastKey as string, "base64").toString())
      : undefined,
  };
 
  const filters = {
    category: category as string | undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    inStockOnly: inStockOnly === "true",
  };
 
  const result = await productService.listProducts(filters, pagination);
 
  // Encode the next cursor as base64 so it's URL-safe
  const nextCursor = result.lastKey
    ? Buffer.from(JSON.stringify(result.lastKey)).toString("base64")
    : null;
 
  return sendResponse(res, {
    statusCode: 200,
    message: "Products retrieved",
    data: {
      items: result.items,
      count: result.count,
      nextCursor, // client passes this as ?lastKey= in the next request
    },
  });
});
 
// ── GET /products/:id ─────────────────────────────────────────────────────────
export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  return sendResponse(res, { statusCode: 200, message: "Product retrieved", data: product });
});
 
// ── PATCH /products/:id ───────────────────────────────────────────────────────
export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const dto = req.body.data ? JSON.parse(req.body.data) : req.body;
  if (typeof dto.price === "string") dto.price = Number(dto.price);
  if (typeof dto.stock === "string") dto.stock = Number(dto.stock);
 
  const updated = await productService.updateProduct(req.params.id, dto, req.file);
  return sendResponse(res, { statusCode: 200, message: "Product updated", data: updated });
});
 
// ── POST /products/batch ──────────────────────────────────────────────────────
// Batch fetch: body = { ids: ["id1", "id2", ...] }
export const batchGetProducts = catchAsync(async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return sendError(res, "ids must be an array", 400);
 
  const products = await productService.getProductsByIds(ids);
  return sendResponse(res, { statusCode: 200, message: "Products retrieved", data: products });
});
 
// ── PATCH /products/:id/decrement-stock ───────────────────────────────────────
export const decrementStock = catchAsync(async (req: Request, res: Response) => {
  const qty = Number(req.body.qty);
  if (!qty || qty < 1) return sendError(res, "qty must be >= 1", 400);
 
  await productService.decrementStock(req.params.id, qty);
  return sendResponse(res, { statusCode: 200, message: "Stock decremented", data: null });
});
 
// ── DELETE /products/:id ──────────────────────────────────────────────────────
export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id);
  return res.status(204).send();
});
 

