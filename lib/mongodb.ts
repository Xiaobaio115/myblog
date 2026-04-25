import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "blog";

  if (!uri) {
    throw new Error("Missing MONGODB_URI. 请在 Vercel 环境变量里设置 MONGODB_URI");
  }

  if (!clientPromise) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}
