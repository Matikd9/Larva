import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	consume: vi.fn<() => Promise<string | null>>(),
	store: vi.fn<(url: string) => Promise<void>>(),
	drain: vi.fn(),
	refreshSettings: vi.fn(),
	goto: vi.fn<(url: string) => Promise<void>>()
}));

vi.mock('#lib/pendingDeeplink', () => ({ consumePendingDeeplink: mocks.consume, setPendingDeeplink: mocks.store }));
vi.mock('#lib/sync/manager', () => ({ drainPendingMutations: mocks.drain }));
vi.mock('#lib/userSettings.svelte', () => ({ refreshActiveUserSettings: mocks.refreshSettings }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import { initResumeOrchestrator } from './resumeOrchestrator';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

let pageWindow: EventTarget;
let pageDocument: EventTarget;
let worker: EventTarget;
let visibility: 'visible' | 'hidden';
let address: { pathname: string; search: string };
let mailbox: string | null;

async function settle() {
	await vi.dynamicImportSettled();
	await vi.advanceTimersByTimeAsync(0);
}

function setVisibility(value: 'visible' | 'hidden') {
	visibility = value;
	pageDocument.dispatchEvent(new Event('visibilitychange'));
}

function nudge() {
	const event = new Event('message');
	Object.defineProperty(event, 'data', { value: { type: 'deeplink-nudge' } });
	worker.dispatchEvent(event);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-21T08:00:00Z'));
	vi.resetAllMocks();
	pageWindow = new EventTarget();
	pageDocument = new EventTarget();
	worker = new EventTarget();
	visibility = 'visible';
	Object.defineProperty(pageDocument, 'visibilityState', { get: () => visibility });
	address = { pathname: '/', search: '' };
	mailbox = null;
	vi.stubGlobal('window', pageWindow);
	vi.stubGlobal('document', pageDocument);
	vi.stubGlobal('navigator', { serviceWorker: worker });
	vi.stubGlobal('location', address);
	mocks.consume.mockImplementation(async () => {
		const url = mailbox;
		mailbox = null;
		return url;
	});
	mocks.store.mockImplementation(async url => { mailbox = url; });
	mocks.goto.mockImplementation(async url => {
		const target = new URL(url, 'https://groly.example');
		address.pathname = target.pathname;
		address.search = target.search;
	});
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('push navigation on resume', () => {
	it.each(['log-supplement', 'log-mood'])('opens %s from the mailbox once and skips the settings refresh', async action => {
		mailbox = `/?action=${action}`;
		initResumeOrchestrator();
		pageWindow.dispatchEvent(new Event('focus'));
		setVisibility('visible');
		await settle();
		expect(mocks.goto).toHaveBeenCalledExactlyOnceWith(`/?action=${action}`);
		expect(mocks.refreshSettings).not.toHaveBeenCalled();
	});

	it('refreshes settings on a normal opening and again after backgrounding', async () => {
		initResumeOrchestrator();
		await settle();
		expect(mocks.refreshSettings).toHaveBeenCalledTimes(1);
		setVisibility('hidden');
		await vi.advanceTimersByTimeAsync(1000);
		setVisibility('visible');
		await settle();
		expect(mocks.refreshSettings).toHaveBeenCalledTimes(2);
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it('keeps polling after a worker nudge until a delayed mailbox write arrives', async () => {
		initResumeOrchestrator();
		await settle();
		const read = deferred<string | null>();
		mocks.consume.mockReturnValueOnce(read.promise);
		nudge();
		read.resolve(null);
		await settle();
		mailbox = '/?action=log-supplement';
		await vi.advanceTimersByTimeAsync(250);
		await settle();
		expect(mocks.goto).toHaveBeenLastCalledWith('/?action=log-supplement');
	});

	it('keeps a second push target while the first is still navigating and opens it on the next signal', async () => {
		const first = deferred<void>();
		mailbox = '/?action=log-water';
		mocks.goto.mockImplementationOnce(() => first.promise);
		initResumeOrchestrator();
		await settle();
		mailbox = '/?action=log-mood';
		nudge();
		await settle();
		expect(mailbox).toBe('/?action=log-mood');
		first.resolve();
		await settle();
		pageWindow.dispatchEvent(new Event('focus'));
		await settle();
		expect(mocks.goto.mock.calls.map(([url]) => url)).toEqual(['/?action=log-water', '/?action=log-mood']);
	});

	it('preserves the target after a failed navigation so a later signal can retry', async () => {
		mailbox = '/?action=log-supplement';
		mocks.goto.mockRejectedValueOnce(new Error('navigation failed'));
		initResumeOrchestrator();
		await settle();
		expect(mailbox).toBe('/?action=log-supplement');
		pageWindow.dispatchEvent(new Event('focus'));
		await settle();
		expect(mailbox).toBeNull();
		expect(mocks.goto).toHaveBeenCalledTimes(2);
	});
});
