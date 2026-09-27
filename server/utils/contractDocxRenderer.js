'use strict';

const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function renderContractDocxBuffer(templateBuffer, data) {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter() {
            return '';
        }
    });

    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' });
}

module.exports = { renderContractDocxBuffer };
