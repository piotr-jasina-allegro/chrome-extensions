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
