import type { MainOptions } from './util/create-options.ts';
import { type FileDescriptor, FileEntryCache } from './util/file-entry-cache.ts';
import { timerify } from './util/Performance.ts';
import { version } from './version.ts';

const dummyFileDescriptor: FileDescriptor<any> = { key: '', changed: true, notFound: true };

export class CacheConsultant<T> {
  private static caches = new Set<FileEntryCache<any>>();
  private cache: FileEntryCache<T> | undefined;
  getFileDescriptor: (filePath: string) => FileDescriptor<T> = () => dummyFileDescriptor;
  reconcile: () => void = () => {};
  removeEntry: (filePath: string) => void = () => {};

  constructor(name: string, options: MainOptions) {
    if (!options.isCache) return;
    const cacheName = `${name.replace(/[^a-z0-9]/g, '-').replace(/-*$/, '')}-${options.isProduction ? '-prod' : ''}-${version}`;
    this.cache = new FileEntryCache(cacheName, options.cacheLocation);
    CacheConsultant.caches.add(this.cache);
    this.getFileDescriptor = timerify(this.cache.getFileDescriptor.bind(this.cache));
    this.reconcile = timerify(this.cache.reconcile.bind(this.cache));
    this.removeEntry = timerify(this.cache.removeEntry.bind(this.cache));
  }

  static resetStats() {
    CacheConsultant.caches.clear();
  }

  static getStats() {
    let hits = 0;
    let misses = 0;
    let cacheSize = 0;
    for (const cache of CacheConsultant.caches) {
      hits += cache.hits;
      misses += cache.misses;
      cacheSize += cache.getCacheSize();
    }
    const analyzedFiles = hits + misses;
    const hitRatio = analyzedFiles === 0 ? 0 : hits / analyzedFiles;
    return { analyzedFiles, hits, misses, hitRatio, cacheSize };
  }

  getCachedFile(filePath: string): T | undefined {
    if (!this.cache) return undefined;
    const fd = this.cache.getFileDescriptor(filePath);
    return !fd.changed ? fd.meta?.data : undefined;
  }
}
