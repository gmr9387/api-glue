// MVP Vault: Uses in-memory store for browser environment
// In production, this would use process.env or encrypted storage

const secrets: Map<string, string> = new Map();

export const vault = {
  get(key: string): string | undefined {
    return secrets.get(key);
  },

  set(key: string, value: string): void {
    secrets.set(key, value);
  },

  has(key: string): boolean {
    return secrets.has(key);
  },

  remove(key: string): void {
    secrets.delete(key);
  },

  listKeys(): string[] {
    return Array.from(secrets.keys());
  },
};
