import express, { Application, Request, Response } from "express";
import globalErrorHandler from "./middleware/globalErrorHandler";
import router from "./routes";
import { ensureBucketExists } from "./utils/fileuploader";

const app: Application = express();

app.use(express.json());

app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ message: "Product management api is running successfully!" });
});

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: false,
    message: "Route not found",
  });
});
app.use(globalErrorHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running successfully on http://localhost:${PORT}`);
  await ensureBucketExists();
});

export default app;
