import { setupJira } from '../src/content/sites/jira.js';

describe('jira content script', () => {
    const sprintResponse = { values: [{ id: 4242 }] };
    const issuesResponse = {
        issues: [{ key: 'PROJ-1', fields: { summary: 'Task one', status: { id: '3' } } }],
    };

    const flushAsyncWork = async (): Promise<void> => {
        await jest.runAllTimersAsync();
    };

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20T10:00:00Z'));

        (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
            storage: { local: { set: jest.fn() } },
        } as unknown as typeof chrome;

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

    test('stores fetched issues under the current month key in localStorage and chrome.storage.local', async () => {
        setupJira();
        await flushAsyncWork();

        const stored = localStorage.getItem('issuesMont-2025-11');
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored as string)).toEqual([['2025-11-20', issuesResponse.issues]]);

        const chromeMock = (
            globalThis as typeof globalThis & {
                chrome: { storage: { local: { set: jest.Mock } } };
            }
        ).chrome;
        expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
            'issuesMont-2025-11': [['2025-11-20', issuesResponse.issues]],
        });
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

        const stored = JSON.parse(localStorage.getItem('issuesMont-2025-11') as string);
        expect(stored).toEqual([
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
        localStorage.setItem(
            'issuesMont-2025-11',
            JSON.stringify([
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
            ]),
        );

        setupJira();
        await flushAsyncWork();

        const stored = JSON.parse(localStorage.getItem('issuesMont-2025-11') as string);
        const oldDayEntry = stored.find(([date]: [string, unknown]) => date === '2025-11-01');
        expect(oldDayEntry[1]).toEqual([
            { key: 'OLD-1', fields: { summary: 'Old task', status: { id: '1' } } },
        ]);
        expect(JSON.stringify(oldDayEntry)).not.toContain('X'.repeat(100_000));
    });

    test('prunes the oldest stored days and retries once when localStorage.setItem throws QuotaExceededError', async () => {
        localStorage.setItem(
            'issuesMont-2025-11',
            JSON.stringify(
                Array.from({ length: 20 }, (_, i) => [
                    `2025-11-${String(i + 1).padStart(2, '0')}`,
                    [{ key: `OLD-${i}`, fields: { summary: 'Old', status: { id: '1' } } }],
                ]),
            ),
        );

        const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
        const originalSetItem = Storage.prototype.setItem.bind(localStorage);
        const setItemSpy = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementationOnce(() => {
                throw quotaError;
            })
            .mockImplementation((key, value) => {
                // second call (after pruning) succeeds via the real implementation
                originalSetItem(key, value);
            });

        setupJira();
        await flushAsyncWork();

        expect(setItemSpy).toHaveBeenCalledTimes(2);
        const stored = JSON.parse(localStorage.getItem('issuesMont-2025-11') as string);
        // pruned down to at most 14 days + today
        expect(stored.length).toBeLessThanOrEqual(15);
        expect(stored.some(([date]: [string, unknown]) => date === '2025-11-20')).toBe(true);

        setItemSpy.mockRestore();
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
        expect(localStorage.getItem('issuesMont-2025-11')).toBeNull();
    });
});
