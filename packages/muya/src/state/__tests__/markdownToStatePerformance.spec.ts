import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownToState } from '../markdownToState';

const tokenOperations = vi.hoisted(() => ({ largeArrayShiftCount: 0 }));

vi.mock('../../utils/marked', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/marked')>();
    return {
        ...actual,
        lexBlock(...args: Parameters<typeof actual.lexBlock>) {
            const tokens = actual.lexBlock(...args);
            const shift = tokens.shift.bind(tokens);
            tokens.shift = () => {
                if (tokens.length >= 100)
                    tokenOperations.largeArrayShiftCount += 1;
                return shift();
            };
            return tokens;
        },
    };
});

describe('markdownToState large token streams', () => {
    beforeEach(() => {
        tokenOperations.largeArrayShiftCount = 0;
    });

    it('does not repeatedly remove entries from the front of a large token array', () => {
        const markdown = Array.from({ length: 2_000 }, (_, index) => `paragraph ${index}`).join('\n\n');

        const states = new MarkdownToState().generate(markdown);

        expect(states).toHaveLength(2_000);
        expect(tokenOperations.largeArrayShiftCount).toBe(0);
    });

    it('preserves nested list order while using the large-document path', () => {
        const markdown = Array.from(
            { length: 500 },
            (_, index) => `- outer ${index}\n  - inner ${index}`,
        ).join('\n');

        const states = new MarkdownToState().generate(markdown);

        expect(states).toHaveLength(1);
        const list = states[0];
        expect(list.name).toBe('bullet-list');
        if (list.name !== 'bullet-list')
            throw new Error('Expected a bullet list');
        expect(list.children).toHaveLength(500);
    });
});
