import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';
import { logger } from '../config/logger';

let dbInstance: FirebaseFirestore.Firestore | any = null;

export function initFirebase(): void {
  if (dbInstance) return; // Already initialized

  const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    try {
      initializeApp({
        credential: cert(serviceAccountPath),
      });
      logger.info('✓ Firebase Initialized (via service-account.json)');
    } catch (err: any) {
      logger.error(`Failed to initialize via service-account.json: ${err.message}`);
    }
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      logger.info('✓ Firebase Initialized (via Environment Variables)');
    } catch (err: any) {
      logger.error(`Failed to initialize via ENV variables: ${err.message}`);
    }
  } else {
    logger.error('✗ Firebase Initialization Failed: Missing configuration.');
  }

  try {
    dbInstance = getFirestore();
    logger.info('✓ Firestore Connected');
  } catch (error: any) {
    logger.error(`✗ Firestore Connection Failed: ${error.message}`);
  }
}

// Proxied getter so that imports don't crash if imported before init
export const db = new Proxy({} as any, {
  get(target, prop) {
    if (!dbInstance) {
      initFirebase(); // Lazy initialize for Vercel Serverless
      if (!dbInstance) {
        throw new Error('Firestore is not initialized. Please check your environment variables.');
      }
    }
    return dbInstance[prop];
  }
});

export const pool = { end: async () => {} };
