export const CLIENT_ALLEGRO_ID = '40064';

/**
 * Pure extraction of the "which background color should this hours input
 * have" rule, previously inlined identically in two places
 * (colorizeInputs' updateBg and setAllHoursTo). Behavior is unchanged:
 * "0" -> pink, anything else -> white.
 */
export function computeHoursBackgroundColor(value: string): string {
    return value === '0' ? 'rgb(223 68 226)' : '#ffffff';
}

/** Injects the apreelts.azurewebsites.net helper buttons and wires up the hours-input color feedback. */
export default function setupApreelTs(): void {
    createApreelButtons();
    colorizeInputs();
}

function colorizeInputs(): void {
    document.querySelectorAll('td').forEach((td) => {
        if (
            td.classList.contains('sunday') ||
            td.classList.contains('saturday') ||
            td.classList.contains('vacation')
        ) {
            return;
        }

        td.querySelectorAll<HTMLInputElement>('input[type="text"][title="Godziny pracy"]').forEach(
            (input) => {
                const updateBg = (event: Event): void => {
                    const target = event.target as HTMLInputElement;
                    target.style.backgroundColor = computeHoursBackgroundColor(target.value);
                };

                input.addEventListener('input', updateBg);
                updateBg({ target: input } as unknown as Event);
            },
        );
    });
}

function createApreelButtons(): void {
    const button = document.createElement('button');
    button.textContent = 'All to 8!';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 16px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', () => {
        setAllHoursTo('8');
        console.log('APREELTS Set all hours');
    });
    document.body.appendChild(button);

    const button2 = document.createElement('button');
    button2.textContent = 'All to 0!';
    button2.style.position = 'fixed';
    button2.style.bottom = '70px';
    button2.style.right = '20px';
    button2.style.zIndex = '9999';
    button2.style.padding = '10px 16px';
    button2.style.backgroundColor = '#4CAF50';
    button2.style.color = '#fff';
    button2.style.border = 'none';
    button2.style.borderRadius = '4px';
    button2.style.cursor = 'pointer';
    button2.addEventListener('click', () => {
        setAllHoursTo('0');
        console.log('APREELTS Set all hours to 0');
    });
    document.body.appendChild(button2);

    const buttonHolders = document.querySelectorAll('.buttonHolder');
    console.log('APREELTS buttonHolders:', buttonHolders);
    const lastButtonHolder = buttonHolders[buttonHolders.length - 1];
    const button3 = document.createElement('button');
    button3.textContent = 'Fill allegro1';
    button3.type = 'button';
    button3.style.padding = '3px 16px';
    button3.style.backgroundColor = '#4CAF50';
    button3.style.color = '#fff';
    button3.style.border = 'none';
    button3.style.borderRadius = '4px';
    button3.style.cursor = 'pointer';
    button3.style.display = 'inline-block';
    if (lastButtonHolder) {
        lastButtonHolder.appendChild(button3);
    }
    button3.addEventListener('click', () => {
        setClientAndHours();
        console.log('APREELTS Set Allegro hours to 8');
    });
}

function setClientAndHours(): void {
    const clientSelect = document.querySelector<HTMLSelectElement>('select.clientsDropDown');
    if (clientSelect) {
        clientSelect.value = CLIENT_ALLEGRO_ID;
        clientSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setAllHoursTo('8');
}

function setAllHoursTo(num: string): void {
    document.querySelectorAll('td').forEach((td) => {
        if (
            td.classList.contains('sunday') ||
            td.classList.contains('saturday') ||
            td.classList.contains('vacation')
        ) {
            return;
        }

        td.querySelectorAll<HTMLInputElement>('input[type="text"][title="Godziny pracy"]').forEach(
            (input) => {
                input.value = num;
                input.style.backgroundColor = computeHoursBackgroundColor(input.value);
            },
        );
    });
    console.log('APREELTS Set all hours to ', num);
}
