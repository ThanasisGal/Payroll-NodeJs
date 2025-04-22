import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

import Models_A from "../../models/stathera_arxeia.js";
import Models_B from "../../models/privileges.js";
import Models_C from "../../models/companies.js";
import Models_D from "../../models/ergazomenoi.js";
import Models_E from "../../models/kinhseis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const { Klimaka_ForoyModel,
        EkptoshForoyModel,
        Eisodhma_Pro_Foroy_MeioshsModel,
      } = Models_A; 

// Έλεγχος αν είμαστε σε παραγωγή (production)
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;

function toUTCDate(dateString) {
    const date = new Date(dateString);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

class forosController {
    static getKlimakiaForoy = async (req, res) => {
        const { xrhsh } = req.query; // Διαβάζουμε την παράμετρο από το query string

        try {
            // Δημιουργία βασικού φίλτρου με team και company_kod
            const filter =  {  xrhsh: xrhsh };

            const klimakiaForoy = await Klimaka_ForoyModel.find(filter)
                .sort({ xrhsh: 1, apo_poso: 1 }) // Ταξινόμηση κατά xrhsh και apo_poso σε αύξουσα σειρά
                .select('-_id') // Εξαιρούμε το _id από τα αποτελέσματα
                .lean(); // Μετατροπή σε απλό JavaScript αντικείμενο
            res.json(klimakiaForoy);

        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static getEkptoshForoy = async (req, res) => {
        try {
            const ekptoshForoy = await EkptoshForoyModel.find()
                .sort({ aa_teknon: 1 }) // Ταξινόμηση κατά xrhsh και apo_poso σε αύξουσα σειρά
                .select('-_id') // Εξαιρούμε το _id από τα αποτελέσματα
                .lean(); // Μετατροπή σε απλό JavaScript αντικείμενο
            res.json(ekptoshForoy);

        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }

    static getEisodhmaProForoyMeioshs = async (req, res) => {
        const { xrhsh } = req.query; // Διαβάζουμε την παράμετρο από το query string

        try {
            // Δημιουργία φίλτρου
            const filter = { xrhsh: xrhsh };

            // Εκτέλεση του ερωτήματος με ταξινόμηση
            const eisodhma = await Eisodhma_Pro_Foroy_MeioshsModel.find(filter)
                .sort({ xrhsh: 1, eisfora_allhleggyhs: 1, aa_teknon: 1 }) // Ταξινόμηση κατά eisf_allhl και aa_paidion σε αύξουσα σειρά
                .select('-_id') // Αφαίρεση του _id από τα αποτελέσματα
                .lean(); // Μετατροπή σε απλό JavaScript αντικείμενο

            res.json(eisodhma); // Επιστροφή των δεδομένων ως JSON

        } catch (error) {
            console.error("Σφάλμα στο API endpoint:", error);
            res.status(500).json({ error: "Κάτι πήγε στραβά" });
        }
    }





}

export default forosController;
