import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const sqlite = new Database(':memory:');
	sqlite.exec(`CREATE TABLE recipes (id TEXT, image_url TEXT); CREATE TABLE meals (id TEXT, image_url TEXT); CREATE TABLE notes (id TEXT);`);
	sqlite.exec(`INSERT INTO recipes VALUES ('r', '/uploads/kept-recipe.jpg'); INSERT INTO meals VALUES ('m', '/uploads/kept-meal.png?v=2');`);
	return { sqlite, db: {} };
});

const { detectImageExtension, cleanupOrphanUploads } = await import('./uploads');

const bytes = (...values: (number | string)[]) => new Uint8Array(values.flatMap(v => typeof v === 'string' ? [...v].map(c => c.charCodeAt(0)) : [v]));

describe('detectImageExtension', () => {
	it('recognises images by their bytes and rejects everything else', () => {
		expect(detectImageExtension(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
		expect(detectImageExtension(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('png');
		expect(detectImageExtension(bytes('GIF89a'))).toBe('gif');
		expect(detectImageExtension(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('webp');
		expect(detectImageExtension(bytes(0, 0, 0, 0x18, 'ftyp', 'heic'))).toBe('heic');
		expect(detectImageExtension(bytes(0, 0, 0, 0x18, 'ftyp', 'avif'))).toBe('avif');
		expect(detectImageExtension(bytes('<svg onload=alert(1)>'))).toBeNull();
		expect(detectImageExtension(bytes())).toBeNull();
	});
});

describe('cleanupOrphanUploads', () => {
	it('removes only old files that no image_url references', async () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'groly-uploads-'));
		const now = Date.now();
		const old = new Date(now - 2 * 24 * 60 * 60 * 1000);
		try {
			for (const name of ['kept-recipe.jpg', 'kept-meal.png', 'orphan.jpg', 'fresh-orphan.jpg']) writeFileSync(path.join(dir, name), 'x');
			for (const name of ['kept-recipe.jpg', 'kept-meal.png', 'orphan.jpg']) utimesSync(path.join(dir, name), old, old);
			expect(await cleanupOrphanUploads(dir, now)).toBe(1);
			expect(existsSync(path.join(dir, 'orphan.jpg'))).toBe(false);
			for (const name of ['kept-recipe.jpg', 'kept-meal.png', 'fresh-orphan.jpg']) expect(existsSync(path.join(dir, name))).toBe(true);
			expect(await cleanupOrphanUploads(path.join(dir, 'missing'), now)).toBe(0);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
