import express from "express";
import { productRouter } from "../modules/Product/product.route";
import { userRouter } from "../modules/User/user.route";
const router = express.Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRouter,
  },
  {
    path: "/products",
    route: productRouter,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
