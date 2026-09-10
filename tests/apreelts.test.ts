import { CLIENT_ALLEGRO_ID, computeHoursBackgroundColor } from '../src/content/sites/apreelts.js';

describe('apreelts', () => {
    test('computeHoursBackgroundColor returns pink for "0"', () => {
        expect(computeHoursBackgroundColor('0')).toBe('rgb(223 68 226)');
    });

    test('computeHoursBackgroundColor returns white for any non-zero value', () => {
        expect(computeHoursBackgroundColor('8')).toBe('#ffffff');
        expect(computeHoursBackgroundColor('')).toBe('#ffffff');
    });

    test('CLIENT_ALLEGRO_ID matches the Allegro client select value', () => {
        expect(CLIENT_ALLEGRO_ID).toBe('40064');
    });
});
