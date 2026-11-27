import path from 'path';
import { readdir, stat, unlink } from 'fs/promises';
import { sqlite } from '#lib/db';

export const UPLOADS_DIR = path.resolve(path.dirname(process.env.DATABASE_URL ?? './data/groly.db'), 'uploads');

// Identify an uploaded image by its leading bytes, never by the client-declared MIME type.
export function detectImageExtension(bytes: Uint8Array): 'jpg' | 'png' | 'gif' | 'webp' | 'avif' | 'heic' | null {
	const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
	if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
	if (ascii(0, 4) === 'GIF8') return 'gif';
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
	if (ascii(4, 8) === 'ftyp') {
		// iPhone photos reach the server unconverted when the browser cannot re-encode them.
		const brand = ascii(8, 12);
		if (brand === 'avif' || brand === 'avis') return 'avif';
		if (['heic', 'heix', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
	}
	return null;
}

/**
 * Deletes uploaded files that no row references any more (images of deleted recipes, meals, favourites).
 * Every table with an image_url column counts, so a new table cannot lose images by being forgotten here.
 * Files younger than a day are kept: an image is uploaded before the recipe or meal using it is saved.
 */
export async function cleanupOrphanUploads(dir = UPLOADS_DIR, now = Date.now()): Promise<number> {
	let files: string[];
	try { files = await readdir(dir); } catch { return 0; }
	const referenced = new Set<string>();
	const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
	for (const { name } of tables) {
		const quoted = `"${name.replaceAll('"', '""')}"`;
		const columns = sqlite.prepare(`PRAGMA table_info(${quoted})`).all() as { name: string }[];
		if (!columns.some(column => column.name === 'image_url')) continue;
		for (const row of sqlite.prepare(`SELECT image_url FROM ${quoted} WHERE image_url LIKE '/uploads/%'`).all() as { image_url: string }[]) {
			referenced.add(path.basename(row.image_url.split('?')[0]));
		}
	}
	let removed = 0;
	for (const file of files) {
		if (referenced.has(file)) continue;
		const filepath = path.join(dir, file);
		const info = await stat(filepath).catch(() => null);
		if (!info?.isFile() || now - info.mtimeMs < 24 * 60 * 60 * 1000) continue;
		await unlink(filepath).catch(() => {});
		removed++;
	}
	if (removed > 0) console.log(`[groly:cleanup] Removed ${removed} unreferenced upload(s).`);
	return removed;
}
