// ─── product.model.ts ─────────────────────────────────────────────────────────
//
// Best-practice schema design:
//   • hashKey  = productId  (partition key  — point lookups: GetItem)
//   • index    = category-price-index (GSI) — Query by category, sorted by price
//     → avoids full-table Scan for the most common list operation
//   • timestamps: true  → createdAt / updatedAt managed by Dynamoose
//   • saveUnknown: false → rejects extra fields silently dropped by DynamoDB

import dynamoose from "../../config/dynamodb";
import { Schema } from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import { v4 as uuidv4 } from "uuid";

// ── 1. TypeScript shape for the stored item ──────────────────────────────────
export class Product extends Item {
  productId!: string;
  name!: string;
  price!: number;
  category!: string;
  stock!: number;
  description?: string;
  image?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── 2. Schema ─────────────────────────────────────────────────────────────────
const productSchema = new Schema(
  {
    productId: {
      type: String,
      hashKey: true,
      // Auto-generate a UUID on create so callers never need to supply one.
      default: () => uuidv4(),
    },

    name: {
      type: String,
      required: true,
      set: (v) => (typeof v === "string" ? v.trim() : v),
    },

    price: {
      type: Number,
      required: true,
      validate: (v: number) => v > 0,
    },

    // ── GSI partition key ─────────────────────────────────────────────────
    // Putting `category` here allows a cheap Query instead of a full Scan
    // whenever you list products by category.
    category: {
      type: String,
      required: true,
      index: {
        name: "category-price-index", // GSI name
        type: "global",
        rangeKey: "price", // sort within category by price
        project: true, // project ALL attributes (convenience)
        // In production you can list only the attributes your list view needs
        // to reduce RCU cost: project: ["productId","name","price","image"]
      },
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
    },

    description: { type: String },
    image: { type: String },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
    saveUnknown: false, // never silently persist unknown fields
  },
);

// ── 3. Model export ───────────────────────────────────────────────────────────
export const ProductModel = dynamoose.model<Product>("Product", productSchema);
