import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME, migrate } from './schema';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Satu koneksi untuk seluruh app. Migrasi dijalankan sekali saat pertama dibuka.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return databasePromise;
}
