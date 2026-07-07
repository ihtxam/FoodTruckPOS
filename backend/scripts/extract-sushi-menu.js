import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.join(__dirname, '../../app/src/main/java/com/chaslay/pos/data/local/SushiSakeCatalogSeeder.kt'),
  'utf8'
);
const catBlock = src.match(/private val categories = listOf\(([\s\S]*?)\)\s*\n\s*private val items/)[1];
const cats = [...catBlock.matchAll(/Cat\("([^"]+)", "([^"]+)"(?:, "([^"]+)")?\)/g)].map((m, i) => ({
  name: m[1],
  color: m[2],
  sort: i,
}));
const items = [...src.matchAll(/Item\((\d+), "([^"]+)", ([\d.]+)\)/g)].map((m) => ({
  cat: Number(m[1]),
  name: m[2],
  price: Number(m[3]),
}));
fs.writeFileSync(path.join(__dirname, 'sushi-sake-menu-data.json'), JSON.stringify({ categories: cats, items }, null, 2));
console.log(`Extracted ${cats.length} categories, ${items.length} products`);
