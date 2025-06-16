import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs, { promises as fsPromises } from 'fs';
import PDFDocument from 'pdfkit';

import Models_A from "../../models/stathera_arxeia.js";
import Models_B from "../../models/privileges.js";
import Models_C from "../../models/companies.js";
import Models_D from "../../models/ergazomenoi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

