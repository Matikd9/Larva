
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { UPLOADS_DIR, detectImageExtension } from '#lib/server/uploads';
import { checkRateLimit } from '#lib/server/loginRateLimit';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;
	if (!checkRateLimit(`upload:${user!.id}`, 60)) return Response.json({ error: 'Too many uploads', code: 'rate_limited' }, { status: 429 });

	try {
		if (!existsSync(UPLOADS_DIR)) {
			await mkdir(UPLOADS_DIR, { recursive: true });
		}

		const formData = await event.request.formData();
		const file = formData.get('image');
		if (!file || !(file instanceof File)) {
			return Response.json({ error: 'No image provided', code: 'no_image' }, { status: 400 });
		}

		if (file.size > 5 * 1024 * 1024) {
			return Response.json({ error: 'Image too large (max 5 MB)', code: 'image_too_large' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const ext = detectImageExtension(buffer);
		if (!ext) return Response.json({ error: 'Not a supported image', code: 'unsupported_image' }, { status: 400 });
		const filename = `${randomUUID()}.${ext}`;
		await writeFile(path.join(UPLOADS_DIR, filename), buffer);

		return Response.json({ url: `/uploads/${filename}` }, { status: 201 });
	} catch (e) {
		console.error('POST /api/uploads/image error:', e);
		return Response.json({ error: 'Upload failed', code: 'upload_failed' }, { status: 500 });
	}
};
