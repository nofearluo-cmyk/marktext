// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

const bootedMuyas: Muya[] = [];
const originalVersion = window.MUYA_VERSION;
const hadVersion = 'MUYA_VERSION' in window;

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();

    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function createMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    bootedMuyas.push(muya);
    return muya;
}

function create143KiBDocument(): string {
    return Array.from(
        { length: 2_100 },
        (_, index) => `${index.toString().padStart(4, '0')} ${'x'.repeat(63)}`,
    ).join('\n\n');
}

describe('large document loading', () => {
    it('reads the full JSON state a constant number of times while rendering a 143 KiB document', () => {
        const markdown = create143KiBDocument();
        const size = new TextEncoder().encode(markdown).byteLength;
        expect(size).toBeGreaterThanOrEqual(143 * 1_024);
        expect(size).toBeLessThan(144 * 1_024);

        const muya = createMuya(markdown);
        const getState = vi.spyOn(muya.editor.jsonState, 'getState');
        const start = performance.now();

        muya.init();

        const elapsed = performance.now() - start;
        expect(muya.editor.scrollPage?.length()).toBe(2_100);
        expect(getState.mock.calls.length).toBeLessThanOrEqual(3);
        expect(elapsed).toBeLessThan(5_000);
    }, 15_000);

    it('refreshes a reference definition when its text changes without changing the block count', () => {
        const muya = createMuya('[ref]: https://old.example\n\n[value][ref]\n');
        muya.init();

        expect(muya.editor.inlineRenderer.labels.get('ref')?.href).toBe('https://old.example');

        muya.setContent('[ref]: https://new.example\n\n[value][ref]\n');

        expect(muya.editor.inlineRenderer.labels.get('ref')?.href).toBe('https://new.example');
    });

    it('does not rescan reference definitions when several blocks render the same state revision', () => {
        const markdown = Array.from({ length: 50 }, (_, index) => `paragraph ${index}`).join('\n\n');
        const muya = createMuya(markdown);
        const getState = vi.spyOn(muya.editor.jsonState, 'getState');

        muya.init();

        expect(getState.mock.calls.length).toBeLessThanOrEqual(3);
        expect(muya.editor.inlineRenderer.labels.size).toBe(0);
    });

    it('advances the state revision after a queued inline edit is applied', async () => {
        const muya = createMuya('before\n');
        muya.init();
        const beforeRevision = muya.editor.jsonState.getRevision();
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;

        block.text = 'after';

        await vi.waitFor(() => {
            expect(muya.editor.jsonState.getRevision()).toBe(beforeRevision + 1);
        });
    });
});
