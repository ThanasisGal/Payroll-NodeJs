import { initTomDropdown } from './dropdown-item.js';

const relatedDropdowns = {
    xrhsh: [],
    team: [],
    company: [],
    mhnas: [],
};

function getSessionOrDefault(field) {
    if (window.getSessionContext) {
        const ctx = window.getSessionContext();
        return ctx[field] || '';
    }
    return '';
}

export function updateFilter(field, value) {
    if (!relatedDropdowns[field]) return;

    relatedDropdowns[field].forEach(dropdown => {
        const currentValues = dropdown.items;

        if (Array.isArray(currentValues) && currentValues.includes(value)) return;
        if (!Array.isArray(currentValues) && currentValues === value) return;

        const activeElement = document.activeElement;
        if (activeElement && dropdown.control_input && activeElement === dropdown.control_input) return;

        dropdown.clear();
        dropdown.clearOptions();
        dropdown.load('');
    });
}

export function extractExtraParams(selectElement) {
    const ctx = window.getSessionContext?.() || {};
    const params = {};

    if (selectElement.dataset.xrhshRelated === 'true') {
        params.xrhsh = ctx.xrhsh;
    }

    if (selectElement.dataset.teamRelated === 'true') {
        params.team = ctx.team;
    }

    if (selectElement.dataset.companyRelated === 'true') {
        params.company = ctx.company;
    }

    if (selectElement.dataset.mhnasRelated === 'true') {
        params.mhnas = ctx.mhnas;
    }

    return params;
}


export function initDropdowns() {
    const allSelects = document.querySelectorAll('select[data-api]');

    allSelects.forEach(selectElement => {
        const apiPath = selectElement.getAttribute('data-api');
        const relatedFields = [];

        // Αν δεν έχει id, φτιάξε ένα μοναδικό
        if (!selectElement.id) {
            selectElement.id = 'dropdown-' + Math.random().toString(36).substring(2, 10);
        }

        ['xrhsh', 'team', 'company', 'mhnas'].forEach(field => {
            if (selectElement.getAttribute(`data-${field}-related`) === 'true') {
                relatedFields.push(field);
            }
        });

        if (selectElement.tom) {
            return; // Ή skip αν έχει ήδη αρχικοποιηθεί
        }

        initTomDropdown({
            selector: `#${selectElement.id}`,
            url: apiPath,
            extraParams: Object.fromEntries(
                relatedFields.map(field => [field, getSessionOrDefault(field)])
            ),
            hooks: {
                onInit: (tomInstance) => {
                    relatedFields.forEach(field => {
                        relatedDropdowns[field].push(tomInstance);
                    });
                },
                onChange: (values, records) => {
                // Μπορείς να προσθέσεις custom συμπεριφορά εδώ αν θέλεις
                }
            },
            minChars: 2
        });
    });
}
