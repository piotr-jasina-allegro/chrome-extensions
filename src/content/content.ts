import { websiteMatches } from '../shared/utils.js';
import setupApreelTs from './sites/apreelts.js';
import { setupJira } from './sites/jira.js';
import { setupAdp } from './sites/adp.js';
import type { RenderOptions } from '../shared/types.js';

const websiteType = websiteMatches(window.location.href);

console.log(`✅ Loading content js for ${websiteType} ${window.location.href}`);

chrome.storage.local.get('buttonsVisible', (data) => {
    const isVisible = data.buttonsVisible !== false;
    console.log('Buttons visible get:', data.buttonsVisible);
    renderPlugin({ isVisible });
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.buttonsVisible) {
        const isVisible = changes.buttonsVisible.newValue !== false;
        renderPlugin({ isVisible });
        console.log('Buttons visible onChanged:', changes.buttonsVisible.newValue);
    }
});

function renderPlugin(options: RenderOptions): void {
    if (websiteType === 'APREELTS') {
        setupApreelTs();
        console.log('APREELTS script executed');
    }

    if (websiteType === 'JIRA' || websiteType === 'GOOGLESHEET') {
        setupJira();
        console.log('JIRA/GOOGLESHEET script executed');
    }

    let isRunning = false;
    let pending = false;
    const safeSetupAdp = async (renderOptions: RenderOptions): Promise<void> => {
        if (isRunning) {
            pending = true;
            return;
        }

        isRunning = true;
        try {
            await setupAdp(renderOptions);
        } catch (err) {
            console.error('Error on setupAdp:', err);
        } finally {
            isRunning = false;
            if (pending) {
                pending = false;
                await setupAdp(renderOptions);
            }
        }
    };

    if (websiteType === 'ADP') {
        safeSetupAdp(options);
        const observer = new MutationObserver(() => {
            safeSetupAdp(options);
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
        console.log('ADP script executed');
    }

    console.log(
        `✅ Rendered for ${websiteType} ${window.location.href} visibility ${options.isVisible}`,
    );
}

console.log(`✅ Loading js loaded for ${websiteType} ${window.location.href}`);
