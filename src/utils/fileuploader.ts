import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand
} from "@aws-sdk/client-s3";
import multer, { FileFilterCallback } from "multer";
import sharp from "sharp";
import crypto from "crypto";
import path from "path";
import { Request } from "express";

const BUCKET_NAME = process.env.S3_BUCKET || "orbit-project-assets";
const LOCALSTACK_URL = process.env.S3_ENDPOINT || "http://localhost:4566";

// Configure S3 Client for 
export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: LOCALSTACK_URL,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  forcePathStyle: true,
});

export const ensureBucketExists = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
  } catch (error: any) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === "NotFound") {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`🎉 Bucket "${BUCKET_NAME}" created successfully in Floci!`);
      } catch (createErr) {
        console.error("❌ Failed to create bucket:", createErr);
      }
    }
  }
};

// Configure Multer Middleware (Memory Storage)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 100) * 1024 * 1024 }, // MB
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "video/mp4",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

// Upload and Optimize File
export const uploadToLocalStack = async (file?: Express.Multer.File) => {
  if (!file) throw new Error("No file provided");

  try {
    let fileBuffer = file.buffer;
    let contentType = file.mimetype;
    const ext = path.extname(file.originalname) || "";
    let filename = file.originalname.replace(/\s+/g, "_");

    if (file.mimetype.startsWith("image/")) {
      const nameWithoutExt = path.basename(file.originalname, ext);
      filename = `${nameWithoutExt}.webp`;
      contentType = "image/webp";
      fileBuffer = await sharp(file.buffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    }

    const key = `${crypto.randomUUID()}-${filename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }),
    );

    return { url: `${LOCALSTACK_URL}/${BUCKET_NAME}/${key}`, key };
  } catch (err) {
    throw err;
  }
};

// Delete File from S3
export const deleteFromS3 = async (key: string) => {
  return await s3Client.send(
    new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
  );
};

const updateFromS3 = async (key: string, file: Express.Multer.File) => {
  await deleteFromS3(key);
  return await uploadToLocalStack(file);
};

export const fileService = {
  upload,
  uploadToLocalStack,
  deleteFromS3,
  updateFromS3,
};
