import { Injectable } from '@nestjs/common';
import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

@Injectable()
export class FirebaseService {
  private readonly app: App;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly storage: Storage;

  constructor() {
    this.app =
      getApps()[0] ??
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    this.storage = getStorage(this.app);
  }

  bucket() {
    return this.storage.bucket();
  }
}
