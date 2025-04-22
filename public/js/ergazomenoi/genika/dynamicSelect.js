let currentPage = 1;

async function loadEidikothtesErganh(page) {
    const response = await fetch(`/api/eidikothtesErganh?page=${page}`);
    if (response.ok) {
        const eidikothtesErganh = await response.json();
        const select = document.getElementById('eidikothta_erganh');
        eidikothtesErganh.forEach(e => {
            const option = new Option(e.kodikos.padEnd(7,'\u00A0') + e.perigrafh, e.kodikos);
            select.add(option);
        });
    } else {
        console.error('Failed to load data');
    }
}

function checkScroll() {
    const select = document.getElementById('eidikothta_erganh');
    if (select.scrollTop + select.offsetHeight >= select.scrollHeight) {
        currentPage++;
        loadEidikothtesErganh(currentPage);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const selectElement = document.getElementById('eidikothta_erganh');
    selectElement.addEventListener('scroll', checkScroll);
    loadEidikothtesErganh(currentPage);
});
