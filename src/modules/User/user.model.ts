// ─── user.model.ts ────────────────────────────────────────────────────────────
//
// Table design:
//   hashKey  = userId  (PK — used for GetItem by token payload)
//   GSI      = email-index (email as PK) — used for login lookup by email
//
// Why a GSI for email?
//   Login = "find user WHERE email = ?". Without a GSI that's a full Scan.
//   With email-index we do a cheap Query → O(1) reads.
//
// Password is stored as a bcrypt hash — never plaintext.
// The `password` field is explicitly excluded from responses in the service.

import dynamoose from "../../config/dynamodb";
import { Schema } from "dynamoose";
import { Item } from "dynamoose/dist/Item";
import { v4 as uuidv4 } from "uuid";
import { UserRole } from "./user.types";

export class User extends Item {
  userId!: string;
  name!: string;
  email!: string;
  password!: string;
  role!: UserRole;
  phone?: string;
  avatar?: string;
  isActive!: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema(
  {
    userId: {
      type: String,
      hashKey: true,
      default: () => uuidv4(),
    },
    name: {
      type: String,
      required: true,
      set: (v) => (typeof v === "string" ? v.trim() : v),
    },

    email: {
      type: String,
      required: true,
      index: {
        name: "email-index",
        type: "global",
        project: true,
      },
      // Safely check if v is a string before normalizing
      set: (v) => (typeof v === "string" ? v.toLowerCase().trim() : v),
    },

    // bcrypt hash — NEVER store or return plaintext
    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    phone: { type: String },
    avatar: { type: String },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    saveUnknown: false,
  },
);

export const UserModel = dynamoose.model<User>("User", userSchema);
