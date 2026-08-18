import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

export class MongoConfigurationError extends Error {
  constructor() {
    super("Missing MONGODB_URI");
    this.name = "MongoConfigurationError";
  }
}

export function isMongoConfigured() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export function isMongoConfigurationError(error: unknown) {
  return (
    error instanceof MongoConfigurationError ||
    (error instanceof Error && error.message === "Missing MONGODB_URI")
  );
}

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "blog";

  if (!uri?.trim()) {
    throw new MongoConfigurationError();
  }

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  const client = await clientPromise;
  return client.db(dbName);
}
