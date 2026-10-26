import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';

let replSet: MongoMemoryReplSet | undefined;

/** Starts an in-memory single-node replica set so transactions work in tests. */
export async function startTestDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(replSet.getUri());
}

export async function stopTestDb(): Promise<void> {
  await disconnectDatabase();
  if (replSet) {
    await replSet.stop();
    replSet = undefined;
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}
