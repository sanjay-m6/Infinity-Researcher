import { PageTextItem } from "../../lib/desktop-api";

class ExtractedPagesStore {
  private cache = new Map<string, PageTextItem[]>();

  set(key: string, pages: PageTextItem[]): void {
    if (!key || !pages || pages.length === 0) return;
    this.cache.set(key, pages);
    if (typeof window !== "undefined") {
      (window as unknown as { __extractedPdfPages?: Map<string, PageTextItem[]> }).__extractedPdfPages = this.cache;
    }
  }

  get(key?: string | null): PageTextItem[] | null {
    if (!key) return null;
    return this.cache.get(key) || null;
  }

  has(key?: string | null): boolean {
    if (!key) return false;
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const extractedPagesStore = new ExtractedPagesStore();

