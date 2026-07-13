import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { logger } from '../config/logger';

let dbInstance: FirebaseFirestore.Firestore | any = null;

export async function initFirebase(): Promise<void> {
  const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    try {
      initializeApp({
        credential: cert(serviceAccountPath),
      });
      logger.info('✓ Firebase Initialized (via service-account.json)');
    } catch (err: any) {
      throw new Error(`Failed to initialize via service-account.json: ${err.message}`);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Replace escaped newlines if passed via certain env environments
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      logger.info('✓ Firebase Initialized (via Environment Variables)');
    } catch (err: any) {
      throw new Error(`Failed to initialize via ENV variables: ${err.message}`);
    }
  } else {
    logger.error('✗ Firebase Initialization Failed');
    logger.error('Missing configuration. You must provide EITHER a service-account.json file OR the following environment variables:');
    logger.error('FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    throw new Error('Firebase Configuration Missing');
  }

  try {
    dbInstance = getFirestore();
    logger.info('✓ Firestore Connected');
  } catch (error: any) {
    logger.error('✗ Firestore Connection Failed');
    throw new Error(`Firestore could not connect: ${error.message}`);
  }
}

// Proxied getter so that imports don't crash if imported before init
export const db = new Proxy({} as any, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error('Firestore is not initialized');
    }
    return dbInstance[prop];
  }
});

export const pool = { end: async () => {} };
