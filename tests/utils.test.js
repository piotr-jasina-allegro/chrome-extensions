// const { getMonthStrings, buildIssuesSummary, getStatusMap } = require('../utils.js');

import {buildIssuesSummary, getMonthStrings, getStatusMap} from "../utils.js";

describe('Utils', () => {
    beforeAll(() => {
        // Mock Date to a fixed date for consistent tests
        jest.useFakeTimers().setSystemTime(new Date('2025-11-20'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('getMonthStrings returns correct current and previous month strings', () => {
        const result = getMonthStrings();
        expect(result.current).toBe('2025-11');
        expect(result.previous).toBe('2025-10');
    });

    test('getStatusMap returns the correct status mapping', () => {
        const statusMap = getStatusMap();
        expect(statusMap['1']).toBe('TODO');
        expect(statusMap['3']).toBe('IN_PROGRESS');
        expect(statusMap['10142']).toBe('IN_REVIEW');
        expect(statusMap['10153']).toBe('TO_TEST');
        expect(statusMap['10145']).toBe('IN_TEST');
        expect(statusMap['6']).toBe('DONE');
    });

    test('buildIssuesSummary builds correct HTML summary', () => {
        const issuesMap = new Map([
            ['2025-11-20', [
                {
                    key: 'PROJ-123', fields: {
                        status: {
                            id: '10153'
                        },
                        summary: 'Fix bug',
                        assignee: {
                            emailAddress: "piotr.jasina@allegro.com"
                        }
                    }
                },
                {
                    key: 'PROJ-124', fields: {
                        status: {
                            id: '10142'
                        },
                        summary: 'Add feature',
                        assignee: {
                            emailAddress: "piotr.jasina@allegro.com"
                        }
                    }
                }
            ]]
        ]);
        const statusMap = getStatusMap();
        const summary = buildIssuesSummary(issuesMap, statusMap);
        expect(summary).toContain('2025-11-20:');
        expect(summary).toContain('<a href="https://allegrogroup.atlassian.net/browse/PROJ-123" target="_blank">PROJ-123</a> TO_TEST Fix bug');
        expect(summary).toContain('<a href="https://allegrogroup.atlassian.net/browse/PROJ-124" target="_blank">PROJ-124</a> IN_REVIEW Add feature');
    });

    test('buildIssuesSummary handles empty issues map', () => {
        const issuesMap = new Map();
        const statusMap = getStatusMap();
        const summary = buildIssuesSummary(issuesMap, statusMap);
        expect(summary).toBe('');
    });
});
