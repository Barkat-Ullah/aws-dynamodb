// ─── product.route.ts (updated) ───────────────────────────────────────────────
// Shows how to wire auth middleware onto existing product endpoints.

import { Router } from "express";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  batchGetProducts,
  decrementStock,
} from "./product.controller";
import { upload } from "../../utils/fileuploader";
import { protect } from "../../middleware/auth";

export const productRouter = Router();

productRouter.get("/", listProducts);
productRouter.get("/:id", getProduct);
productRouter.post("/batch", batchGetProducts);

productRouter.patch("/:id/decrement-stock", protect, decrementStock);

productRouter.post(
  "/",
  protect,
  upload.single("image"),
  createProduct
);

productRouter.patch(
  "/:id",
  protect,
  upload.single("image"),
  updateProduct
);

productRouter.delete(
  "/:id",
  protect,
  deleteProduct
);