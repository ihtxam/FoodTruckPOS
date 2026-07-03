import fs from 'node:fs/promises';
import path from 'node:path';

export function createReceiptStorage(dataDir) {
  const root = path.resolve(dataDir);

  async function ensureDir() {
    await fs.mkdir(root, { recursive: true });
  }

  function filePath(id) {
    return path.join(root, `${id}.json`);
  }

  return {
    async save(receipt) {
      await ensureDir();
      const payload = {
        ...receipt,
        updatedAt: new Date().toISOString()
      };
      await fs.writeFile(filePath(receipt.id), JSON.stringify(payload, null, 2), 'utf8');
      return payload;
    },

    async get(id) {
      try {
        const raw = await fs.readFile(filePath(id), 'utf8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  };
}
