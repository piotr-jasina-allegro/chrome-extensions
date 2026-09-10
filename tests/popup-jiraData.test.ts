/**
 * @jest-environment jsdom
 */
import { buildJiraSite } from '../src/popup/jiraData.js';

describe('buildJiraSite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<pre id="output"></pre>';
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-11-20'));

        const chromeMock = {
            storage: {
                local: {
                    get: jest.fn(
                        (keys: string[], callback: (result: Record<string, unknown>) => void) => {
                            const key = keys[0];

                            if (key === 'issuesMont-2025-11') {
                                callback({
                                    [key]: [
                                        [
                                            '2025-11-20',
                                            [
                                                {
                                                    key: 'PROJ-1',
                                                    fields: {
                                                        summary: 'Task',
                                                        status: { id: '3' },
                                                        assignee: {
                                                            emailAddress:
                                                                'piotr.jasina@allegro.com',
                                                        },
                                                    },
                                                },
                                            ],
                                        ],
                                    ],
                                });
                                return;
                            }

                            if (key === 'issuesMont-2025-10') {
                                callback({});
                                return;
                            }

                            callback({});
                        },
                    ),
                },
            },
        };

        (globalThis as unknown as { chrome: typeof chrome }).chrome =
            chromeMock as unknown as typeof chrome;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('renders current month details with fetched issues and empty previous month', () => {
        buildJiraSite();

        const output = document.getElementById('output') as HTMLElement;
        expect(output.innerHTML).toContain('Current month 2025-11');
        expect(output.innerHTML).toContain('PROJ-1');
        expect(output.innerHTML).toContain('Prev month 2025-10');
        expect(output.innerHTML).toContain('details open');
    });
});
