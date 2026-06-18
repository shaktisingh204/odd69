// src/lib/mongo.ts
// Shared MongoDB connection for website (Next.js API routes + server actions)

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
    console.warn('[mongo] MONGO_URI not set — MongoDB features will be disabled');
}

declare global {
    // eslint-disable-next-line no-var
    var _mongoConnPromise: Promise<typeof mongoose> | undefined;
}

let connPromise: Promise<typeof mongoose> | undefined;

if (MONGO_URI) {
    if (process.env.NODE_ENV === 'development') {
        if (!global._mongoConnPromise) {
            global._mongoConnPromise = mongoose.connect(MONGO_URI);
        }
        connPromise = global._mongoConnPromise;
    } else {
        connPromise = mongoose.connect(MONGO_URI);
    }
}

export default async function connectMongo() {
    if (!MONGO_URI || !connPromise) return;
    await connPromise;
}
