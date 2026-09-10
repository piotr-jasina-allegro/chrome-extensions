import type { RenderOptions } from '../../shared/types.js';

const ELEMENT_PROCESSED_ATTRIBUTE = 'data-deployment-button-created';
const EXT_CLASS = 'boring-stuff-extension';

/**
 * Pure extraction of the "find the Kibana link for this env among the
 * anchors on the page" rule from createButton's fetchLink. Same matching
 * behavior: textContent must contain both "KIBANA" and the env name,
 * case-insensitively.
 */
export function findKibanaLink(
    anchors: Array<{ textContent: string | null; href: string }>,
    env: string,
): string | undefined {
    return anchors.find((a) => {
        const text = (a.textContent ?? '').toUpperCase();
        return text.includes('KIBANA') && text.includes(env.toUpperCase());
    })?.href;
}

/** Toggles visibility of already-rendered extension buttons and (re-)creates Kibana/deploy buttons for ADP catalog links, deduplicating via a processed-marker attribute. */
export async function setupAdp(options: RenderOptions): Promise<void> {
    const elements = document.querySelectorAll<HTMLElement>(`.${EXT_CLASS}`);
    elements.forEach((el) => {
        el.style.display = options.isVisible ? 'inline' : 'none';
    });

    async function createButton(
        env: string,
        htmlAnchorElement: Element,
        componentId: string,
        scale = 1,
    ): Promise<void> {
        const getButtonStyles = (scale = 1) => ({
            marginLeft: `${5 * scale}px`,
            padding: `${5 * scale}px ${10 * scale}px`,
            backgroundColor: '#7d00ca',
            color: 'white',
            border: 'none',
            borderRadius: `${4 * scale}px`,
            cursor: 'pointer',
            fontWeight: 'bold',
            display: options.isVisible ? 'inline-flex' : 'none',
            alignItems: 'center',
            gap: `${5 * scale}px`,
            fontSize: `${14 * scale}px`,
        });
        const BUTTON_STYLES = getButtonStyles(scale);
        const kibanaBtn = document.createElement('button');
        kibanaBtn.classList.add(EXT_CLASS);
        Object.assign(kibanaBtn.style, BUTTON_STYLES);
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('favicon-32x32.png');
        img.width = 10 * scale;
        img.height = 10 * scale;
        const label = document.createElement('span');
        label.textContent = env;
        kibanaBtn.append(img, label);

        let kibanaLink: string | undefined;
        function fetchLink(): void {
            const anchors = Array.from(document.querySelectorAll('a'));
            console.log(
                'EXT - looking for Kibana link among anchors:',
                anchors.map((a) => a.textContent),
            );
            const foundLink = findKibanaLink(anchors, env);

            console.log(
                'EXT - extracted kibanaLink:',
                foundLink,
                'for env:',
                env,
                'componentId:',
                componentId,
            );
            if (foundLink) {
                kibanaLink = foundLink;
            }
            chrome.storage.local.set({
                [`link-${componentId}-${env}`]: foundLink,
            });
        }
        fetchLink();
        setTimeout(() => {
            fetchLink();
        }, 800);
        setTimeout(() => {
            fetchLink();
        }, 2000);

        const storageResult = await chrome.storage.local.get([`link-${componentId}-${env}`]);
        const linkFromStorage = storageResult[`link-${componentId}-${env}`] as string | undefined;
        kibanaBtn.onclick = async () => {
            if (kibanaLink || linkFromStorage) {
                window.open(kibanaLink || linkFromStorage, '_blank');
            } else {
                console.error(
                    "Nie znaleziono linku 'Kibana - DEV' na tej stronie. Upewnij się, że sekcja Links jest załadowana.",
                );
            }
        };
        if (kibanaLink || linkFromStorage) {
            htmlAnchorElement.parentNode?.insertBefore(kibanaBtn, htmlAnchorElement.nextSibling);
        } else {
            console.error("Nie znaleziono linku 'Kibana - DEV' na tej stronie.");
        }
    }

    async function createDeploymentButton(
        htmlAnchorElement: Element,
        componentId: string,
        scale = 1,
    ): Promise<void> {
        const getButtonStyles = (scale = 1.0) => ({
            marginLeft: `${5 * scale}px`,
            padding: `${5 * scale}px ${10 * scale}px`,
            gap: `${5 * scale}px`,
            borderRadius: `${4 * scale}px`,
            backgroundColor: '#0051ca',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: options.isVisible ? 'inline-flex' : 'none',
            alignItems: 'center',
            fontSize: `${14 * scale}px`,
        });
        const BUTTON_STYLES = getButtonStyles(scale);
        const dpButton = document.createElement('button');
        dpButton.classList.add(EXT_CLASS);
        Object.assign(dpButton.style, BUTTON_STYLES);
        const icon = document.createElement('span');
        icon.textContent = '🚀';
        icon.style.fontSize = `${9 * scale}px`;
        const label = document.createElement('span');
        label.textContent = ' DEPLOY';
        dpButton.append(icon, label);

        dpButton.onclick = async () => {
            let newPath: string;
            if (document.title.startsWith('opbox-')) {
                newPath = `/catalog/default/component/${componentId}/deployment`;
            } else {
                newPath = `/catalog/default/component/${componentId}/lifecycle/deployment`;
            }
            window.history.pushState({}, '', newPath);
            window.dispatchEvent(new PopStateEvent('popstate'));
        };
        htmlAnchorElement.parentNode?.insertBefore(dpButton, htmlAnchorElement.nextSibling);
    }

    async function setupButtons(
        htmlAnchorElement: Element,
        componentId: string,
        scale = 1,
    ): Promise<void> {
        await Promise.all([
            createButton('PROD', htmlAnchorElement, componentId, scale),
            createButton('TEST', htmlAnchorElement, componentId, scale),
            createButton('DEV', htmlAnchorElement, componentId, scale),
            createDeploymentButton(htmlAnchorElement, componentId, scale),
        ]).catch((err) => console.error('Error creating ADP buttons:', err));
    }

    if (window.location.pathname === '/') {
        const anchors = Array.from(document.querySelectorAll('a'));

        const an = anchors.filter((a) => /\/catalog\/default\/component\/(\d+)/.test(a.href));

        for (const linkElement of an) {
            const match = linkElement.href.match(/\/catalog\/default\/component\/(\d+)/);
            const componentId = match?.[1];
            if (!componentId) continue;
            if (linkElement.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE) !== 'true') {
                linkElement.setAttribute(ELEMENT_PROCESSED_ATTRIBUTE, 'true');
                await setupButtons(linkElement, componentId, 0.7).catch((err) => {
                    console.error('Error setting up ADP buttons:', err);
                    linkElement.removeAttribute(ELEMENT_PROCESSED_ATTRIBUTE);
                });
                console.log(
                    `Processed ${linkElement} componentId: ${componentId} ${ELEMENT_PROCESSED_ATTRIBUTE}: ${linkElement.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE)}`,
                );
            }
        }
    } else if (window.location.pathname.match(/component\/(\d+)/)) {
        const match = window.location.pathname.match(/component\/(\d+)/);
        const componentId = match?.[1];
        if (!componentId) return;
        const favoriteBtn = document.getElementById(`favorite-component-default-${componentId}`);
        if (!favoriteBtn) return;
        if (favoriteBtn.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE) !== 'true') {
            favoriteBtn.setAttribute(ELEMENT_PROCESSED_ATTRIBUTE, 'true');
            await setupButtons(favoriteBtn, componentId).catch((err) => {
                console.error('Error setting up ADP buttons:', err);
                favoriteBtn.removeAttribute(ELEMENT_PROCESSED_ATTRIBUTE);
            });
            console.log(
                `Processed componentId: ${componentId} ${ELEMENT_PROCESSED_ATTRIBUTE}: ${favoriteBtn.getAttribute(ELEMENT_PROCESSED_ATTRIBUTE)}`,
            );
        }
    }
}
