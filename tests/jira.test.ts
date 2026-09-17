import { setupJira } from '../src/content/sites/jira.js';
import type { JiraIssue } from '../src/shared/types.js';

describe('jira content script', () => {
    const sprintResponse = { values: [{ id: 4242 }] };
    const issuesResponse = {
        issues: [{ key: 'PROJ-1', fields: { summary: 'Task one', status: { id: '3' } } }],
    };

    const flushAsyncWork = async (): Promise<void> => {
        await jest.runAllTimersAsync();
    };

    /** In-memory stand-in for chrome.storage.local, backing get/set/remove. */
    let store: Record<string, unknown>;

    const setupChromeMock = (): void => {
        store = {};
        (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
            storage: {
                local: {
                    get: jest.fn(async (keys?: string | string[] | null) => {
                        if (keys === null || keys === undefined) {
                            return { ...store };
                        }
                        const keyList = Array.isArray(keys) ? keys : [keys];
                        const result: Record<string, unknown> = {};
                        for (const key of keyList) {
                            if (key in store) {
                                result[key] = store[key];
                            }
                        }
                        return result;
                    }),
                    set: jest.fn(async (items: Record<string, unknown>) => {
                        Object.assign(store, items);
                    }),
                    remove: jest.fn(async (keys: string | string[]) => {
                        for (const key of Array.isArray(keys) ? keys : [keys]) {
                            delete store[key];
                        }
                    }),
                },
            },
        } as unknown as typeof chrome;
    };

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20T10:00:00Z'));
        localStorage.clear();

        setupChromeMock();

        globalThis.fetch = jest
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => sprintResponse })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => issuesResponse,
            }) as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('stores fetched issues under the current month key in chrome.storage.local', async () => {
        setupJira();
        await flushAsyncWork();

        expect(store['issuesMont-2025-11']).toEqual([['2025-11-20', issuesResponse.issues]]);
    });

    test('trims extraneous Jira fields before persisting, keeping only what buildIssuesSummary needs', async () => {
        (globalThis.fetch as jest.Mock).mockReset();
        (globalThis.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, json: async () => sprintResponse })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    issues: [
                        {
                            key: 'PROJ-1',
                            fields: {
                                summary: 'Task one',
                                status: { id: '3' },
                                assignee: { emailAddress: 'a@example.com' },
                                parent: { key: 'PROJ-0' },
                                description: 'A'.repeat(50_000),
                                comment: { comments: [{ body: 'B'.repeat(50_000) }] },
                                customfield_10099: 'unrelated bloat',
                            },
                        },
                    ],
                }),
            });

        setupJira();
        await flushAsyncWork();

        expect(store['issuesMont-2025-11']).toEqual([
            [
                '2025-11-20',
                [
                    {
                        key: 'PROJ-1',
                        fields: {
                            summary: 'Task one',
                            status: { id: '3' },
                            assignee: { emailAddress: 'a@example.com' },
                            parent: { key: 'PROJ-0' },
                        },
                    },
                ],
            ],
        ]);
    });

    test('re-trims previously stored bloated snapshots on read, so old oversized data does not persist forever', async () => {
        store['issuesMont-2025-11'] = [
            [
                '2025-11-01',
                [
                    {
                        key: 'OLD-1',
                        fields: { summary: 'Old task', status: { id: '1' } },
                        description: 'X'.repeat(100_000),
                    },
                ],
            ],
        ];

        setupJira();
        await flushAsyncWork();

        const stored = store['issuesMont-2025-11'] as [string, unknown][];
        const oldDayEntry = stored.find(([date]) => date === '2025-11-01') as [string, unknown];
        expect(oldDayEntry[1]).toEqual([
            { key: 'OLD-1', fields: { summary: 'Old task', status: { id: '1' } } },
        ]);
        expect(JSON.stringify(oldDayEntry)).not.toContain('X'.repeat(100_000));
    });

    test('prunes the oldest stored days and retries once when chrome.storage.local.set rejects with a quota error', async () => {
        store['issuesMont-2025-11'] = Array.from({ length: 20 }, (_, i) => [
            `2025-11-${String(i + 1).padStart(2, '0')}`,
            [{ key: `OLD-${i}`, fields: { summary: 'Old', status: { id: '1' } } }],
        ]);

        const chromeMock = (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome;
        const setMock = chromeMock.storage.local.set as jest.Mock;
        setMock
            .mockImplementationOnce(async () => {
                throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
            })
            .mockImplementation(async (items: Record<string, unknown>) => {
                Object.assign(store, items);
            });

        setupJira();
        await flushAsyncWork();

        expect(setMock).toHaveBeenCalledTimes(2);
        const stored = store['issuesMont-2025-11'] as [string, unknown][];
        // pruned down to at most 14 days + today
        expect(stored.length).toBeLessThanOrEqual(15);
        expect(stored.some(([date]) => date === '2025-11-20')).toBe(true);
    });

    test('logs an error and stores nothing when there is no active sprint', async () => {
        (globalThis.fetch as jest.Mock).mockReset();
        (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ values: [] }),
        });

        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        setupJira();
        await flushAsyncWork();

        expect(errorSpy).toHaveBeenCalledWith('Błąd pobierania danych:', expect.any(Error));
        expect(store['issuesMont-2025-11']).toBeUndefined();
    });

    test('removes issuesMont keys for months older than the last 3', async () => {
        store['issuesMont-2025-08'] = [['2025-08-01', []]];
        store['issuesMont-2025-09'] = [['2025-09-01', []]];
        store['issuesMont-2025-10'] = [['2025-10-01', []]];

        setupJira();
        await flushAsyncWork();

        expect(store['issuesMont-2025-08']).toBeUndefined();
        expect(store['issuesMont-2025-09']).toEqual([['2025-09-01', []]]);
        expect(store['issuesMont-2025-10']).toEqual([['2025-10-01', []]]);
        expect(store['issuesMont-2025-11']).toBeDefined();
    });

    test('migrates legacy issuesMont data still sitting in localStorage into chrome.storage.local without losing it', async () => {
        localStorage.setItem(
            'issuesMont-2025-10',
            JSON.stringify([
                ['2025-10-05', [{ key: 'LEGACY-1', fields: { summary: 'Legacy', status: { id: '1' } } }]],
            ]),
        );
        // Chrome storage already has a different day for the same month; it must be preserved too.
        store['issuesMont-2025-10'] = [
            ['2025-10-10', [{ key: 'EXISTING-1', fields: { summary: 'Existing', status: { id: '2' } } }]],
        ];

        setupJira();
        await flushAsyncWork();

        expect(localStorage.getItem('issuesMont-2025-10')).toBeNull();
        const merged = store['issuesMont-2025-10'] as [string, JiraIssue[]][];
        const dates = merged.map(([date]) => date).sort();
        expect(dates).toEqual(['2025-10-05', '2025-10-10']);
    });
});
