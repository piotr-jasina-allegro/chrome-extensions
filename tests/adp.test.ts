import { findKibanaLink } from '../src/content/sites/adp.js';

describe('adp findKibanaLink', () => {
    test('finds the link matching both KIBANA and the env name, case-insensitively', () => {
        const anchors = [
            { textContent: 'Kibana - dev', href: 'https://kibana.dev.example/' },
            { textContent: 'Kibana - prod', href: 'https://kibana.prod.example/' },
            { textContent: 'Grafana', href: 'https://grafana.example/' },
        ];
        expect(findKibanaLink(anchors, 'DEV')).toBe('https://kibana.dev.example/');
        expect(findKibanaLink(anchors, 'PROD')).toBe('https://kibana.prod.example/');
    });

    test('returns undefined when no anchor matches', () => {
        const anchors = [{ textContent: 'Grafana', href: 'https://grafana.example/' }];
        expect(findKibanaLink(anchors, 'DEV')).toBeUndefined();
    });

    test('handles null textContent without throwing', () => {
        const anchors = [{ textContent: null, href: 'https://example/' }];
        expect(findKibanaLink(anchors, 'DEV')).toBeUndefined();
    });
});
