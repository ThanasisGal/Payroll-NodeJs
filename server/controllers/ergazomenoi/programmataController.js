import mongoose from "mongoose";
import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs, { promises as fsPromises } from 'fs';
import PDFDocument from 'pdfkit';
import xmlbuilder from 'xmlbuilder';

import Models_A from "../../models/stathera_arxeia.js";
import Models_B from "../../models/privileges.js";
import Models_D from "../../models/ergazomenoi.js";

const { ArgiesModel, 
      } = Models_A; 

const { UserPrivilegesModel } = Models_B;

const { ErgazomenoiModel,
        OrariaModel,
      } = Models_D;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Έλεγχος αν είμαστε σε παραγωγή (production)
const isProduction = process.env.NODE_ENV === 'production';

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;

// Έλεγχος και δημιουργία του φακέλου downloads αν δεν υπάρχει
if (isProduction) {
  const downloadPath = '/tmp/downloads';
  if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    // Δίνουμε πλήρη δικαιώματα (777) στον φάκελο
    fs.chmodSync(downloadPath, 0o777);
  }
}

let _XMLPATH, _ALERTMESSAGE;  
class programmataController {

  static mainProgrammaErgasiasForm = async (req, res) => {
    const locals = {
      title: "Προγράμματα Εργασίας",
      description: "Web Payroll System",
    };

    const companyId = req.session.companyInUse;
    const sessionUserId = req.session.userId;
    const sessionTeam = req.session.userTeam;
  
    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "SynthrhshProgrammatosErgasias",
      }).exec();
  
      res.render("ergazomenoi/programmata/programmaErgasias", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        sessionTeam: sessionTeam,
        companyId: companyId,
      });
    } catch (error) {
      console.log("Error into programmataController -> mainProgrammaErgasiasForm :", error);
    }
  };

  static getAllErgazomenoi = async (req, res) => {
    
    const { selectedTeam, selectedCompany } = req.params;

    try {
      const ergazomenoi = await ErgazomenoiModel.find({ team: selectedTeam, company_kod: selectedCompany }).sort("eponymo onoma");

      res.json(ergazomenoi);
    } catch (error) {
      res.status(500).send("Error into programmataController -> getAllErgazomenoi :", error);
    }
  };

  static getErgazomeno = async (req, res) => {

    const { selectedTeam, selectedCompany, selectedKodikos } = req.params;

    try {
      const ergazomenoi = await ErgazomenoiModel.findOne({ team: selectedTeam, company_kod: selectedCompany, kodikos: selectedKodikos });

      res.json(ergazomenoi);
    } catch (error) {
      res.status(500).send("Error into programmataController -> getErgazomeno :", error);
    }
  };

  static postOrariaUpdate = async (req, res) => {
    const { selectedTeam, selectedCompany, selectedKodikos } = req.params;
    const formData = req.body;

    // ============================ ΕΝΗΜΕΡΩΣΗ ΩΡΑΡΙΩΝ =============================
    function createOrarioData(i1) {
      return {
        team: selectedTeam,
        company_kod: selectedCompany,
        kodikos: selectedKodikos,
        hmeromhnia: formData[`hmeromhnia_${i1}`],
        kathgoria_ergasias: formData[`kathgoria_ergasias_${i1}`],
        apo_ora_01: formData[`apo_ora_01_${i1}`],
        eos_ora_01: formData[`eos_ora_01_${i1}`],
        dialleima_apo_ora_01: formData[`dialleima_apo_ora_01_${i1}`],
        dialleima_eos_ora_01: formData[`dialleima_eos_ora_01_${i1}`],
        apo_ora_02: formData[`apo_ora_02_${i1}`],
        eos_ora_02: formData[`eos_ora_02_${i1}`],
        dialleima_apo_ora_02: formData[`dialleima_apo_ora_02_${i1}`],
        dialleima_eos_ora_02: formData[`dialleima_eos_ora_02_${i1}`],
        apo_ora_03: formData[`apo_ora_03_${i1}`],
        eos_ora_03: formData[`eos_ora_03_${i1}`],
        dialleima_apo_ora_03: formData[`dialleima_apo_ora_03_${i1}`],
        dialleima_eos_ora_03: formData[`dialleima_eos_ora_03_${i1}`],
        repo: formData[`repo_${i1}`] || false,
        adeia: false,
        astheneia: false,
        argia: formData[`argia_${i1}`] || false,
        perigrafh_argias: formData[`perigrafh_argias_${i1}`] || "",
        kathgoria_adeias: "",
        ores_ergasias: parseFloat(formData[`total_hours_day_${i1}`]).toFixed(4),
        ores_nyxtas: parseFloat(formData[`night_hours_day_${i1}`]).toFixed(4),
        ores_argion: parseFloat(formData[`holiday_hours_day_${i1}`]).toFixed(4),
        ores_yperergasias: parseFloat(formData[`overwork_hours_day_${i1}`]).toFixed(4),
        ores_yperergasias_nyxtas: parseFloat(formData[`night_overwork_hours_day_${i1}`]).toFixed(4),
        ores_yperergasias_argion: parseFloat(formData[`holiday_overwork_hours_day_${i1}`]).toFixed(4),
        ores_yperergasias_argion_nyxtas: parseFloat(formData[`night_holiday_overwork_hours_day_${i1}`]).toFixed(4),
        ores_nominhs_yperorias: parseFloat(formData[`overtimeNomimh_hours_day_${i1}`]).toFixed(4),
        ores_nominhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
        ores_nominhs_yperorias_argion: parseFloat(formData[`holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
        ores_nominhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeNomimh_hours_day_${i1}`]).toFixed(4),
        ores_paranomhs_yperorias: parseFloat(formData[`overtimeParanomh_hours_day_${i1}`]).toFixed(4),
        ores_paranomhs_yperorias_nyxtas: parseFloat(formData[`night_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
        ores_paranomhs_yperorias_argion: parseFloat(formData[`holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
        ores_paranomhs_yperorias_argion_nyxtas: parseFloat(formData[`night_holiday_overtimeParanomh_hours_day_${i1}`]).toFixed(4),
      };
    }
    
    let promises = [];
    const fromDate = new Date(formData.hmeromhnia_allaghs_orarioy_apo_hidden);
    const toDate = new Date(formData.hmeromhnia_allaghs_orarioy_eos_hidden);
    
    let currentDate = new Date(fromDate); // Ξεκινάμε από την αρχική ημερομηνία
    let i = 1;
    
    while (currentDate <= toDate) {
      let i1 = i < 10 ? '0' + i : i;
      const orarioData = createOrarioData(i1);
    
      // Χρησιμοποιούμε findOneAndUpdate για να ενημερώσουμε ή να δημιουργήσουμε εγγραφή
      const updatePromise = OrariaModel.findOneAndUpdate(
        {
          team: selectedTeam,
          company_kod: selectedCompany,
          kodikos: selectedKodikos,
          hmeromhnia: orarioData.hmeromhnia,
        },
        {
          $set: { 
            // Ενημερώνουμε μόνο τα πεδία που πρέπει να αλλάζουν πάντα
            kathgoria_ergasias: orarioData.kathgoria_ergasias,
            apo_ora_01: orarioData.apo_ora_01,
            eos_ora_01: orarioData.eos_ora_01,
            dialleima_apo_ora_01: orarioData.dialleima_apo_ora_01,
            dialleima_eos_ora_01: orarioData.dialleima_eos_ora_01,
            apo_ora_02: orarioData.apo_ora_02,
            eos_ora_02: orarioData.eos_ora_02,
            dialleima_apo_ora_02: orarioData.dialleima_apo_ora_02,
            dialleima_eos_ora_02: orarioData.dialleima_eos_ora_02,
            apo_ora_03: orarioData.apo_ora_03,
            eos_ora_03: orarioData.eos_ora_03,
            dialleima_apo_ora_03: orarioData.dialleima_apo_ora_03,
            dialleima_eos_ora_03: orarioData.dialleima_eos_ora_03,
            repo: orarioData.repo,
            adeia: orarioData.adeia,
            astheneia: orarioData.astheneia,
            argia: orarioData.argia,
            perigrafh_argias: orarioData.perigrafh_argias,
            kathgoria_adeias: orarioData.kathgoria_adeias,
            ores_ergasias: orarioData.ores_ergasias,
            ores_nyxtas: orarioData.ores_nyxtas,
            ores_argion: orarioData.ores_argion,
            ores_yperergasias: orarioData.ores_yperergasias,
            ores_yperergasias_nyxtas: orarioData.ores_yperergasias_nyxtas,
            ores_yperergasias_argion: orarioData.ores_yperergasias_argion,
            ores_yperergasias_argion_nyxtas: orarioData.ores_yperergasias_argion_nyxtas,
            ores_nominhs_yperorias: orarioData.ores_nominhs_yperorias,
            ores_nominhs_yperorias_nyxtas: orarioData.ores_nominhs_yperorias_nyxtas,
            ores_nominhs_yperorias_argion: orarioData.ores_nominhs_yperorias_argion,
            ores_nominhs_yperorias_argion_nyxtas: orarioData.ores_nominhs_yperorias_argion_nyxtas,
            ores_paranomhs_yperorias: orarioData.ores_paranomhs_yperorias,
            ores_paranomhs_yperorias_nyxtas: orarioData.ores_paranomhs_yperorias_nyxtas,
            ores_paranomhs_yperorias_argion: orarioData.ores_paranomhs_yperorias_argion,
            ores_paranomhs_yperorias_argion_nyxtas: orarioData.ores_paranomhs_yperorias_argion_nyxtas,
          },
          $setOnInsert: {
            // Τα πεδία που θα ρυθμιστούν μόνο κατά τη δημιουργία νέας εγγραφής
            team: orarioData.team,
            company_kod: orarioData.company_kod,
            kodikos: orarioData.kodikos,
            hmeromhnia: orarioData.hmeromhnia
          }
        },
        { new: true, upsert: true } // Επιστρέφει το ενημερωμένο έγγραφο, και το δημιουργεί αν δεν υπάρχει
      );
    
      promises.push(updatePromise);
    
      currentDate.setDate(currentDate.getDate() + 1); // Προσθέτουμε μία ημέρα
      i++;
    }
    
    try {
      await Promise.all(promises);
      res.json({ success: true, redirectUrl: "/ergazomenoi/programmata/programmaErgasias" });
    } catch (error) {
      console.log("Error into programmataController -> postOrariaUpdate :", error);
    }
  };

  static deleteOrariaErgazomenoyApoEos = async (req, res) => {
    try {
      const { selectedTeam, selectedCompany, selectedKodikos, startDate, endDate } = req.params;
    
      // Δημιουργία των UTC ημερομηνιών χρησιμοποιώντας Date.UTC
      const start = new Date(Date.UTC(
        parseInt(startDate.slice(0, 4)),  // Έτος
        parseInt(startDate.slice(5, 7)) - 1, // Μήνας (μηδενική βάση)
        parseInt(startDate.slice(8, 10)) // Ημέρα
      ));

      const end = new Date(Date.UTC(
        parseInt(endDate.slice(0, 4)),
        parseInt(endDate.slice(5, 7)) - 1,
        parseInt(endDate.slice(8, 10))
      ));

      // Διαγραφή των εγγραφών από τη βάση δεδομένων με τις σωστές ημερομηνίες
      await OrariaModel.deleteMany({
        team: selectedTeam,
        company_kod: selectedCompany,
        kodikos: selectedKodikos,
        hmeromhnia: { $gte: start, $lte: end }
      });    

      res.json({ success: true, redirectUrl: "/mainapp" });
    } catch (error) {
      console.log("Error into programmataController -> deleteOrariaErgazomenoyApoEos :", error);
    }
  };

  static mainAntigrafhProgrammatonForm = async (req, res) => {
    const locals = {
      title: "Αντιγραφή Προγραμμάτων Εργασίας",
      description: "Web Payroll System",
    };

    const companyId = req.session.companyInUse;
    const sessionUserId = req.session.userId;
    const sessionTeam = req.session.userTeam;
  
    try {
      // Έλεγχος CRUD των δικαιωμάτων του χρήστη
      const userPrivileges = await UserPrivilegesModel.findOne({
        userId: sessionUserId,
        form: "AntigrafhProgrammatonErgasias",
      }).exec();
  
      res.render("ergazomenoi/programmata/antigrafhProgrammatonErgasias", {
        userPrivileges: userPrivileges ? userPrivileges.privileges : {},
        locals,
        sessionTeam: sessionTeam,
        companyId: companyId,
      });
    } catch (error) {
      console.log("Error into programmataController -> mainAntigrafhProgrammatonForm :", error);
    }
  };

  static antigrafhProgrammaton = async (req, res) => {
    try {
      const { selectedTeam, selectedCompany, fromStartDate, fromEndDate, toStartDate, toEndDate, fromSelectedKodikos, toSelectedKodikos } = req.body;
  
      // Λήψη δεδομένων από τη βάση για τον "ΑΠΟ" εργαζόμενο
      const schedules = await OrariaModel.find({
        team: selectedTeam,
        company_kod: selectedCompany,
        kodikos: fromSelectedKodikos,
        hmeromhnia: { $gte: new Date(fromStartDate), $lte: new Date(fromEndDate) }
      });
  
      const [startYear, startMonth, startDay] = toStartDate.split("-");
      const [endYear, endMonth, endDay] = toEndDate.split("-");
      // Δημιουργία Date objects σε UTC
      const toStart = new Date(Date.UTC(startYear, startMonth - 1, startDay)); // Μειώνουμε το μήνα κατά 1 γιατί οι μήνες ξεκινούν από 0 στη JavaScript
      const toEnd = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  
      // Δημιουργούμε ένα array από promises για να εκτελεστούν ταυτόχρονα
      const updatePromises = schedules.map(async (schedule) => {
        const dayOfWeek = schedule.hmeromhnia.getDay(); // Παίρνουμε την ημέρα της εβδομάδας του "ΑΠΟ" εργαζόμενου

        // Βρίσκουμε όλες τις ημερομηνίες μέσα στο διάστημα του "ΣΕ" εργαζόμενου που είναι η ίδια ημέρα της εβδομάδας
        for (let currentDate = new Date(toStart); currentDate.toISOString() <= toEnd.toISOString(); currentDate.setUTCDate(currentDate.getUTCDate() + 1)) {
            if (currentDate.getDay() === dayOfWeek) {
            const adjustedCurrentDate = new Date(currentDate);
            adjustedCurrentDate.setUTCHours(0, 0, 0, 0); // Θέτουμε την ώρα στο T00:00:00.000+00:00 UTC
        
            // Έλεγχος αν η ημερομηνία είναι αργία στο `ArgiesModel`
            const isHoliday = await ArgiesModel.findOne({ hmeromhnia: adjustedCurrentDate });
            const isArgia = !!isHoliday; // Επιστρέφει true αν είναι αργία, αλλιώς false
            let perigrafhArgias = isArgia ? isHoliday.perigrafh : "";
  
            // Εκτέλεση της ενημέρωσης ή δημιουργίας νέας εγγραφής για τον "ΣΕ" εργαζόμενο
            await OrariaModel.findOneAndUpdate(
              {
                team: selectedTeam,
                company_kod: selectedCompany,
                kodikos: toSelectedKodikos, // Αντιστοίχιση με τον κωδικό του "ΣΕ" εργαζόμενου
                hmeromhnia: currentDate // Η νέα ημερομηνία του "ΣΕ" εργαζόμενου
              },
              {
                $set: {
                  kathgoria_ergasias: schedule.kathgoria_ergasias,
                  apo_ora_01: schedule.apo_ora_01,
                  eos_ora_01: schedule.eos_ora_01,
                  dialleima_apo_ora_01: schedule.dialleima_apo_ora_01,
                  dialleima_eos_ora_01: schedule.dialleima_eos_ora_01,
                  apo_ora_02: schedule.apo_ora_02,
                  eos_ora_02: schedule.eos_ora_02,
                  dialleima_apo_ora_02: schedule.dialleima_apo_ora_02,
                  dialleima_eos_ora_02: schedule.dialleima_eos_ora_02,
                  apo_ora_03: schedule.apo_ora_03,
                  eos_ora_03: schedule.eos_ora_03,
                  dialleima_apo_ora_03: schedule.dialleima_apo_ora_03,
                  dialleima_eos_ora_03: schedule.dialleima_eos_ora_03,
                  repo: schedule.repo,
                  adeia: false,
                  astheneia: false,
                  argia: isArgia,
                  perigrafh_argias: perigrafhArgias,
                  kathgoria_adeias: "",
                  ores_ergasias: 0,
                  ores_nyxtas: 0,
                  ores_argion: 0,
                  ores_yperergasias: 0,
                  ores_yperergasias_nyxtas: 0,
                  ores_yperergasias_argion: 0,
                  ores_yperergasias_argion_nyxtas: 0,
                  ores_nominhs_yperorias: 0,
                  ores_nominhs_yperorias_nyxtas: 0,
                  ores_nominhs_yperorias_argion: 0,
                  ores_nominhs_yperorias_argion_nyxtas: 0,
                  ores_paranomhs_yperorias: 0,
                  ores_paranomhs_yperorias_nyxtas: 0,
                  ores_paranomhs_yperorias_argion: 0,
                  ores_paranomhs_yperorias_argion_nyxtas: 0,
                },
                $setOnInsert: {
                  // Τα πεδία που θα οριστούν μόνο κατά την εισαγωγή (όχι κατά την ενημέρωση)
                  team: selectedTeam,
                  company_kod: selectedCompany,
                  kodikos: toSelectedKodikos,
                  hmeromhnia: currentDate
                }
              },
              { upsert: true, new: true }
            );
          }
        }
      });
  
      // Εκτέλεση όλων των updates παράλληλα με Promise.all
      await Promise.all(updatePromises);
  
      // ========================= ΥΠΟΛΟΓΙΣΜΟΣ / ΕΝΗΜΕΡΩΣΗ ΤΩΝ ΗΜΕΡΗΣΙΩΝ ΩΡΩΝ =============================
      try {
        const orariaSErgazomenou = await OrariaModel.find({
          team: selectedTeam,
          company_kod: selectedCompany,
          kodikos: toSelectedKodikos,
          hmeromhnia: { $gte: new Date(toStartDate), $lte: new Date(toEndDate) }
        }).sort({ hmeromhnia: 1 });
    
        // Προετοιμασία των ενεργειών bulkWrite
        const bulkOps = orariaSErgazomenou.map((schedule, index) => {
          // Λογική υπολογισμών
          const isHoliday = schedule.argia;
          const isSunday = new Date(schedule.hmeromhnia).getDay() === 0;
          let isNextHoliday = false;
          let isNextSunday = false;
    
          if (index + 1 < orariaSErgazomenou.length) {
            const nextSchedule = orariaSErgazomenou[index + 1];
            isNextHoliday = nextSchedule.argia;
            isNextSunday = new Date(nextSchedule.hmeromhnia).getDay() === 0;
          }
    
          let intervals = [];
          for (let j = 1; j <= 3; j++) {
            const startTimeInput = schedule[`apo_ora_0${j}`];
            const endTimeInput = schedule[`eos_ora_0${j}`];
            if (startTimeInput && endTimeInput) {
              let startTime = convertTimeToMinutes(startTimeInput);
              let endTime = convertTimeToMinutes(endTimeInput);
              if (endTime < startTime) endTime += 1440;
              intervals.push({ start: startTime, end: endTime, shift: j });
            }
          }

          const workHours = calculateWorkHoursForIntervals(intervals, isHoliday || isSunday, isNextHoliday || isNextSunday);
    
          // Καθορίζουμε το αντικείμενο για την ενημέρωση
          return {
            updateOne: {
              filter: { _id: schedule._id },
              update: {
                $inc: {
                  ores_ergasias: workHours.working,
                  ores_nyxtas: workHours.night,
                  ores_argion: workHours.holiday,
                  ores_yperergasias: workHours.overwork,
                  ores_yperergasias_nyxtas: workHours.nightOverwork,
                  ores_yperergasias_argion: workHours.holidayOverwork,
                  ores_yperergasias_argion_nyxtas: workHours.nightHolidayOverwork,
                  ores_nominhs_yperorias: workHours.overtime,
                  ores_nominhs_yperorias_nyxtas: workHours.nightOvertime,
                  ores_nominhs_yperorias_argion: workHours.holidayOvertime,
                  ores_nominhs_yperorias_argion_nyxtas: workHours.nightHolidayOvertime,
                  ores_paranomhs_yperorias: workHours.overtimeIllegal,
                  ores_paranomhs_yperorias_nyxtas: workHours.nightOvertimeIllegal,
                  ores_paranomhs_yperorias_argion: workHours.holidayOvertimeIllegal,
                  ores_paranomhs_yperorias_argion_nyxtas: workHours.nightHolidayOvertimeIllegal
                }
              }
            }
          };
        });

        let weeksInMonth = findWeeksInMonth(startYear, startMonth); 
        let intervals = processWeeks(weeksInMonth, startYear, startMonth);

        const daysOfPreviousMonth = getDaysFromLastMondayOfPreviousMonth(startYear, startMonth);
        const firstDate = daysOfPreviousMonth[0]; 
        const lastDate = daysOfPreviousMonth[daysOfPreviousMonth.length - 1]; 

        const orariaProhgMhna = await OrariaModel.find({
          team: selectedTeam,
          company_kod: selectedCompany,
          kodikos: toSelectedKodikos,
          hmeromhnia: { $gte: new Date(firstDate), $lte: new Date(lastDate) }
        }).sort({ hmeromhnia: 1 });
    
        // Υπολογισμός του συνόλου των πεδίων
        const data = orariaProhgMhna.reduce((accumulator, schedule) => {
          return {
            ores_ergasias: accumulator.ores_ergasias + schedule.ores_ergasias,
            ores_yperergasias: accumulator.ores_yperergasias + schedule.ores_yperergasias,
            ores_yperergasias_nyxtas: accumulator.ores_yperergasias_nyxtas + schedule.ores_yperergasias_nyxtas,
            ores_yperergasias_argion: accumulator.ores_yperergasias_argion + schedule.ores_yperergasias_argion,
            ores_yperergasias_argion_nyxtas: accumulator.ores_yperergasias_argion_nyxtas + schedule.ores_yperergasias_argion_nyxtas
          };
        }, {
          ores_ergasias: 0,
          ores_yperergasias: 0,
          ores_yperergasias_nyxtas: 0,
          ores_yperergasias_argion: 0,
          ores_yperergasias_argion_nyxtas: 0
        });

        const total = Object.values(data).reduce((sum, value) => sum + value, 0);
        let weeklyTotal = 0;

        for (let i = 0; i < intervals.length; i++) {
          let fromDay = parseInt(intervals[i].start.substring(8, 10)) -1;
          let toDay = parseInt(intervals[i].end.substring(8, 10)) - 1;
          if (i === 0) {
            weeklyTotal = total;
          } else {
            weeklyTotal = 0;
          }

          // Πρώτα υπολογίζουμε το συνολικό weeklyTotal για όλες τις ημέρες της εβδομάδας
          for (let j = fromDay; j <= toDay; j++) {
            // Έλεγχος αν το incValues έχει τιμές (δηλαδή δεν είναι undefined ή null)
            const incValues = bulkOps[j]?.updateOne?.update?.$inc;
            
            if (incValues && Object.keys(incValues).length > 0) {
              // Ορισμός των πεδίων που θέλουμε να αθροίσουμε
              const fieldsToSum = ['ores_ergasias', 'ores_yperergasias', 'ores_yperergasias_nyxtas', 'ores_yperergasias_argion', 'ores_yperergasias_argion_nyxtas'];
              
              // Χρήση Object.entries() για να αθροίσουμε μόνο τα επιθυμητά πεδία
              weeklyTotal += Object.entries(incValues)
                .filter(([key]) => fieldsToSum.includes(key))  // Επιλογή μόνο των επιθυμητών πεδίων
                .reduce((sum, [, value]) => sum + value, 0);   // Άθροισμα των τιμών
            }
          }

          // Τώρα, αφού έχει υπολογιστεί το weeklyTotal για όλη την εβδομάδα, κάνουμε τον έλεγχο
          if (weeklyTotal <= 40) {
            // Εδώ γίνονται οι ενημερώσεις για όλες τις ημέρες
            for (let j = fromDay; j <= toDay; j++) {
              let ores_ergasias = bulkOps[j].updateOne.update.$inc.ores_ergasias + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_nyxtas + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion_nyxtas || 0;

              let ores_nyxtas =   bulkOps[j].updateOne.update.$inc.ores_nyxtas + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_nyxtas + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion_nyxtas || 0;

              let ores_argion =   bulkOps[j].updateOne.update.$inc.ores_argion + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion + 
                                  bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion_nyxtas || 0;

              bulkOps[j].updateOne.update.$inc.ores_ergasias = ores_ergasias;
              bulkOps[j].updateOne.update.$inc.ores_nyxtas = ores_nyxtas;
              bulkOps[j].updateOne.update.$inc.ores_argion = ores_argion;
              bulkOps[j].updateOne.update.$inc.ores_yperergasias = 0;
              bulkOps[j].updateOne.update.$inc.ores_yperergasias_nyxtas = 0;
              bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion = 0;
              bulkOps[j].updateOne.update.$inc.ores_yperergasias_argion_nyxtas = 0;
            }
          }
        }

        // Εκτελούμε την bulkWrite ενημέρωση
        const result = await OrariaModel.bulkWrite(bulkOps);
        res.json({ success: true, redirectUrl: "/mainapp" });
      } catch (error) {
        console.error('Error updating schedules:', error);
      }

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Σφάλμα κατά την αποθήκευση των ωραρίων' });
    }

    function calculateWorkHoursForIntervals(intervals, isHoliday, isNextHoliday) {
      const NIGHT_START = 22 * 60;
      const NIGHT_END = 6 * 60;
  
      const WORK_HOURS_LIMIT = 8 * 60;
      const OVERTIME_LIMIT = WORK_HOURS_LIMIT + 60;
      const LEGAL_OVERTIME_LIMIT = OVERTIME_LIMIT + 180;
  
      let totalMinutesWorked = 0;
  
      let working = 0;
      let night = 0;
      let holiday = 0;
      let overwork = 0;
      let nightOverwork = 0;
      let holidayOverwork = 0;
      let nightHolidayOverwork = 0;
      let overtime = 0;
      let nightOvertime = 0;
      let holidayOvertime = 0;
      let nightHolidayOvertime = 0;
      let overtimeIllegal = 0;
      let nightOvertimeIllegal = 0;
      let holidayOvertimeIllegal = 0;
      let nightHolidayOvertimeIllegal = 0;
      let shift = 0;
  
      intervals.forEach(interval => {
        let startMinute = interval.start;
        let endMinute = interval.end;
        shift = interval.shift;
        let hasCrossedMidnight = false;
        let prevMinute = startMinute;
  
        for (let i = startMinute; i < endMinute; i++) {
          let currentMinute = i % 1440;
        
          // Ελέγχουμε αν το τρέχον λεπτό είναι πριν τα μεσάνυχτα ή μετά τα μεσάνυχτα.
          if (currentMinute < prevMinute) {
            hasCrossedMidnight = true;
          }
        
          let isNight = currentMinute >= NIGHT_START || currentMinute < NIGHT_END;
          // Ελέγχουμε αν είναι αργία πριν τα μεσάνυχτα ή μετά τα μεσάνυχτα
          let isEffectiveHoliday = (isHoliday && !hasCrossedMidnight) || (isNextHoliday && hasCrossedMidnight);
  
          if (totalMinutesWorked < WORK_HOURS_LIMIT) {
            if (isEffectiveHoliday) {
              holiday++;
              working++;
              if (isNight) night++;
            } else {
              working++;
              if (isNight) night++;
            }
          } else if (totalMinutesWorked < OVERTIME_LIMIT) {
            if (isNight && isEffectiveHoliday) {
              nightHolidayOverwork++;
            } else if (isEffectiveHoliday) {
              holidayOverwork++;
            } else if (isNight) {
              nightOverwork++;
            } else {
              overwork++;
            }
          } else if (totalMinutesWorked < LEGAL_OVERTIME_LIMIT) {
            if (isNight && isEffectiveHoliday) {
              nightHolidayOvertime++;
            } else if (isEffectiveHoliday) {
              holidayOvertime++;
            } else if (isNight) {
              nightOvertime++;
            } else {
              overtime++;
            }
          } else {
            if (isNight && isEffectiveHoliday) {
              nightHolidayOvertimeIllegal++;
            } else if (isEffectiveHoliday) {
              holidayOvertimeIllegal++;
            } else if (isNight) {
              nightOvertimeIllegal++;
            } else {
              overtimeIllegal++;
            }
          }

          prevMinute = currentMinute;
          totalMinutesWorked++;
        }
      });
  
      return {
        working: working / 60,
        night: night / 60,
        holiday: holiday / 60,
        overwork: overwork / 60,
        nightOverwork: nightOverwork / 60,
        holidayOverwork: holidayOverwork / 60,
        nightHolidayOverwork: nightHolidayOverwork / 60,
        overtime: overtime / 60,
        nightOvertime: nightOvertime / 60,
        holidayOvertime: holidayOvertime / 60,
        nightHolidayOvertime: nightHolidayOvertime / 60,
        overtimeIllegal: overtimeIllegal / 60,
        nightOvertimeIllegal: nightOvertimeIllegal / 60,
        holidayOvertimeIllegal: holidayOvertimeIllegal / 60,
        nightHolidayOvertimeIllegal: nightHolidayOvertimeIllegal / 60,
        shift: shift
      };
    }
  
    function convertTimeToMinutes(time) {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    }
  
    function findWeeksInMonth(year, month) {
      let monthInt = parseInt(month, 10); 

      // Ορισμός της πρώτης ημέρας του μήνα
      let startDate = new Date(Date.UTC(year, monthInt -1, 1));
      let endDate = new Date(Date.UTC(year, monthInt, 0)); // Τελευταία ημέρα του μήνα
  
      // Μεταβλητή για την αποθήκευση των εβδομάδων
      let weeks = [];
  
      // Εύρεση της πρώτης ημέρας της πρώτης εβδομάδας
      let currentDay = new Date(startDate);
  
      // Επανάληψη μέχρι την τελευταία ημέρα του μήνα
      while (currentDay <= endDate) {
          let weekStart = new Date(currentDay);
  
          // Εύρεση της Δευτέρας της τρέχουσας εβδομάδας (πρώτη ημέρα της εβδομάδας)
          let dayOfWeek = weekStart.getDay();
          let daysToMonday = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // Αν είναι Κυριακή (0), πάει πίσω 6 ημέρες
          weekStart.setDate(weekStart.getDate() - daysToMonday);
  
          // Προσθήκη στον πίνακα εβδομάδων
          weeks.push(weekStart.toISOString().substring(0, 10));
  
          // Προχωράμε στην επόμενη εβδομάδα
          currentDay.setDate(currentDay.getDate() + 7);
      }
  
      // Επιστροφή του πίνακα με τις εβδομάδες
      return weeks;
    }

    function processWeeks(weeks, year, month) {
      // Μετατροπή της συμβολοσειράς month σε ακέραιο αριθμό
      let monthInt = parseInt(month, 10);
  
      // Υπολογισμός της τελευταίας ημέρας του μήνα
      let endDate = new Date(Date.UTC(year, monthInt, 0)); // τελευταία ημέρα του μήνα

      // Πίνακας για τα διαστήματα των εβδομάδων
      let intervals = [];
  
      for (let i = 0; i < weeks.length; i++) {
          let startOfWeek, endOfWeek;
  
          if (i === 0) {
              // Η πρώτη εβδομάδα ξεκινάει από την 1η ημέρα του μήνα
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, 1));
              endOfWeek = new Date(Date.UTC(year, monthInt -1, new Date(weeks[i + 1]).getUTCDate() - 1));
          } else if (i === weeks.length - 1) {
              // Η τελευταία εβδομάδα τελειώνει στην τελευταία ημέρα του μήνα
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
              endOfWeek = endDate; // Τελευταία ημέρα του μήνα
          } else {
              // Ενδιάμεσες εβδομάδες
              startOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i]).getUTCDate()));
              endOfWeek = new Date(Date.UTC(year, monthInt - 1, new Date(weeks[i + 1]).getUTCDate() - 1));
          }
  
          // Προσθήκη του διαστήματος στον πίνακα
          intervals.push({
              start: startOfWeek.toISOString().substring(0, 10),
              end: endOfWeek.toISOString().substring(0, 10)
          });
      }
  
      return intervals;
    }
  
    function getDaysFromLastMondayOfPreviousMonth(startYear, startMonth) {
      // Δημιουργία της πρώτης ημέρας του τρέχοντος μήνα
      const firstDayOfCurrentMonth = new Date(Date.UTC(startYear, startMonth - 1, 1));
      // Έλεγχος αν η πρώτη μέρα είναι Δευτέρα
      if (firstDayOfCurrentMonth.getDay() === 1) {
        return []; // Επιστροφή κενής λίστας καθώς δεν θέλουμε να κάνουμε τίποτα
      }

      // Δημιουργία της τελευταίας ημέρας του προηγούμενου μήνα
      const lastDayOfPreviousMonth = new Date(Date.UTC(startYear, startMonth - 1, 0));

      // Βρίσκουμε την τελευταία Δευτέρα του προηγούμενου μήνα
      const lastMondayOfPreviousMonth = new Date(Date.UTC( lastDayOfPreviousMonth.getUTCFullYear(), lastDayOfPreviousMonth.getUTCMonth(), lastDayOfPreviousMonth.getUTCDate() ));

      const dayOfWeek = lastMondayOfPreviousMonth.getDay(); // 1 είναι η Δευτέρα
      
      // Αν δεν είναι Δευτέρα, πηγαίνει πίσω στις μέρες μέχρι να βρει τη Δευτέρα
      const daysToSubtract = (dayOfWeek === 0) ? 6 : (dayOfWeek - 1); // Πίσω από Κυριακή (6) ή από οποιαδήποτε μέρα μέχρι να βρούμε Δευτέρα
      lastMondayOfPreviousMonth.setDate(lastMondayOfPreviousMonth.getDate() - daysToSubtract);
  
      // Πίνακας για τις ημέρες που θέλουμε να αποθηκεύσουμε
      const daysBetween = [];
    
      // Ξεκινάμε από την τελευταία Δευτέρα του προηγούμενου μήνα μέχρι την προηγούμενη της πρώτης μέρας του τρέχοντα μήνα
      let currentDay = lastMondayOfPreviousMonth;
      
      while (currentDay < firstDayOfCurrentMonth) {
        daysBetween.push(new Date(Date.UTC( currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate() ))); // Προσθήκη της ημερομηνίας στον πίνακα
        currentDay.setDate(currentDay.getDate() + 1); // Μετακινήση στην επόμενη ημέρα
      }
    
      return daysBetween;
    }
  };

  static getOraria = async (req, res) => {
    const { team, company, kodikoi, apoHmeromhnia, eosHmeromhnia, diadikasia, filetype, username, password, ypokatasthma } = req.body;
    try {
      // 1. Ανάκτηση των ωραρίων για τους επιλεγμένους κωδικούς
      const oraria = await OrariaModel.find(
        { team: team, 
          company_kod: company, 
          kodikos: { $in: kodikoi }, 
          hmeromhnia: { $gte: new Date(apoHmeromhnia), $lte: new Date(eosHmeromhnia) } 
        },
        {
          team: 1,
          company_kod: 1,
          kodikos: 1,
          hmeromhnia: 1,
          kathgoria_ergasias: 1,
          apo_ora_01: 1,
          eos_ora_01: 1,
          apo_ora_02: 1,
          eos_ora_02: 1,
          apo_ora_03: 1,
          eos_ora_03: 1
        }
      ).sort({ kodikos: 1, hmeromhnia: 1 });
  
      // 2. Ανάκτηση των στοιχείων των εργαζομένων από το ErgazomenoiModel
      const employees = await ErgazomenoiModel.find(
        { team: team, company_kod: company, kodikos: { $in: kodikoi } },
        { afm: 1, eponymo: 1, onoma: 1, kodikos: 1 }
      );
  
      // Συνάρτηση για μορφοποίηση των ωρών (HHMM ή HH:MM)
      function formatTime(apo, eos, formatType = 'HH:MM') {
        const format = (time) => {
          if (!time) return ''; // Αν δεν υπάρχει ώρα, επιστρέφουμε κενό
      
          if (formatType === 'HH:MM') {
            // Αν η είσοδος είναι ήδη σε μορφή HH:MM, δεν χρειάζεται αλλαγή
            return time; // Επιστρέφουμε την είσοδο ως έχει
          }
      
          if (formatType === 'HHMM') {
            // Αν η είσοδος είναι σε μορφή HH:MM, αφαιρούμε τα διαχωριστικά
            return time.replace(':', ''); // Μετατροπή σε HHMM
          }
      
          return time; // Επιστροφή ως έχει αν δεν ορίστηκε σωστά το formatType
        };
        
        return {
          from: format(apo),
          to: format(eos)
        };
      }
      
      // 3. Συνδυασμός των ωραρίων με τα στοιχεία των εργαζομένων
      const combinedResults = {};
      oraria.forEach((orario) => {
        const employee = employees.find((emp) => emp.kodikos === orario.kodikos);
        const afm = employee ? employee.afm : '999999999';
        const dateKey = new Date(orario.hmeromhnia).toLocaleDateString('el-GR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const employeeKey = (filetype === "xlsx" && diadikasia === "182") ? `${afm}` : `${afm}-${dateKey}`;
  
        // Αν δεν υπάρχει ήδη το κλειδί για αυτόν τον εργαζόμενο και ημερομηνία, το δημιουργούμε
        if (!combinedResults[employeeKey]) {
          combinedResults[employeeKey] = {
            afm: afm,
            eponymo: employee.eponymo,
            onoma: employee.onoma,
            hmeromhnia: orario.hmeromhnia,
            analytics: []
          };
        }
  
        const daysMap = ['ΚΥΡΙΑΚΗ', 'ΔΕΥΤΕΡΑ', 'ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ', 'ΠΕΜΠΤΗ', 'ΠΑΡΑΣΚΕΥΗ', 'ΣΑΒΒΑΤΟ'];
        const dayOfWeek = new Date(orario.hmeromhnia).getDay();
        const dayName = daysMap[dayOfWeek];
      
      
        if (orario) {
          // Προσθέτουμε το πρώτο σύνολο ωρών (apo_ora_01, eos_ora_01)
          const times1 = formatTime(orario.apo_ora_01, orario.eos_ora_01);
          combinedResults[employeeKey].analytics.push({
            f_type: orario.kathgoria_ergasias,  // Ενημερώνεται πάντα το f_type
            f_from: times1.from,                
            f_to: times1.to,
            // Προσθήκη του `days` μόνο αν ισχύουν οι συνθήκες   Χρησιμοποιούμε το spread operator ... για να προσθέσουμε το πεδίο days μόνο όταν η συνθήκη (diadikasia === "182" && filetype === "xlsx") είναι αληθής. Αν η συνθήκη είναι ψευδής, το days δεν θα προστεθεί καθόλου στο αντικείμενο.
            ...(diadikasia === "182" && filetype === "xlsx" ? { 
              days: { [dayName]: `${times1.from.replace(':', '')}${times1.to.replace(':', '')}` } 
            } : {})
          });
        }

        if (orario.apo_ora_02 && orario.eos_ora_02) {
          const times2 = formatTime(orario.apo_ora_02, orario.eos_ora_02);

          const lastEntry = combinedResults[employeeKey].analytics[combinedResults[employeeKey].analytics.length - 1];
          if (lastEntry.days && lastEntry.days[dayName]) {
            // Συνδυασμός των ωρών για την ίδια ημέρα
            lastEntry.days[dayName] += `, ${times2.from.replace(':', '')}${times2.to.replace(':', '')}`;
          } else {
            combinedResults[employeeKey].analytics.push({
              f_type: orario.kathgoria_ergasias,
              f_from: times2.from, // Χρησιμοποιούμε την ήδη σωστή ώρα
              f_to: times2.to,
              ...(diadikasia === "182" && filetype === "xlsx" ? { 
                days: { [dayName]: `${times2.from.replace(':', '')}${times2.to.replace(':', '')}` } 
              } : {})
            });
          }
        }

        if (orario.apo_ora_03 && orario.eos_ora_03) {
          const times3 = formatTime(orario.apo_ora_03, orario.eos_ora_03);
          combinedResults[employeeKey].analytics.push({
            f_type: orario.kathgoria_ergasias,
            f_from: times3.from, // Χρησιμοποιούμε την ήδη σωστή ώρα
            f_to: times3.to,
            // το days: χρησιμοποιείται μόνο για xlsx αρχεία με Σταθερό Εβδομαδιαίο Πρόγραμμα (Κωδ. 182)
            ...(diadikasia === "182" && filetype === "xlsx" ? { 
              days: { [dayName]: `${times3.from.replace(':', '')}${times3.to.replace(':', '')}` } 
            } : {})
          });
        }
      });

      const checkDirectoryAndFile = async (directory, filename) => {
        try {
          await fsPromises.access(directory);
        } catch (error) {
          await fsPromises.mkdir(directory, { recursive: true });
        }
      
        const filePath = path.join(directory, filename);
      
        try {
          await fsPromises.access(filePath);
          await fsPromises.unlink(filePath);
        } catch (error) {
          // If file doesn't exist, do nothing
        }
      
        return filePath;
      };

      let filename, directory, fileLink;

      switch (filetype) {
        case "xlsx":
          let xlsxFilePath, worksheetData, worksheet, workbook, buffer;
      
          directory = path.join(__dirname, '..', '..', '..', 'public', 'xlsx');
      
          switch (diadikasia) {
            case "183":
              filename = `dailyWto_${team}_${company}.xlsx`;
              xlsxFilePath = await checkDirectoryAndFile(directory, filename);
      
              worksheetData = [
                ['ΑΦΜ', 'ΕΠΩΝΥΜΟ', 'ΟΝΟΜΑ', 'ΗΜΕΡΑ', 'ΤΥΠΟΣ', 'ΩΡΑ ΑΠΌ - ΩΡΑ ΕΩΣ'],
                ...Object.values(combinedResults).flatMap(item =>
                  item.analytics.map(analytic => [
                    item.afm,
                    item.eponymo,
                    item.onoma,
                    new Date(item.hmeromhnia).toLocaleDateString('el-GR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }),
                    analytic.f_type,
                    `${analytic.f_from.replace(':', '')}${analytic.f_to.replace(':', '')}`
                  ])
                )
              ];
      
              workbook = new ExcelJS.Workbook();
              worksheet = workbook.addWorksheet("Oraria");
              worksheetData.forEach(row => worksheet.addRow(row));
              buffer = await workbook.xlsx.writeBuffer();
              await fsPromises.writeFile(xlsxFilePath, buffer);
      
              fileLink = isProduction
                ? `https://${host}/xlsx/${filename}`
                : `http://${host}:${port}/xlsx/${filename}`;
              break;
      
            case "182":
              filename = `weeklyWto_${team}_${company}.xlsx`;
              xlsxFilePath = await checkDirectoryAndFile(directory, filename);
      
              function getFTypeForDay(analytics, dayName) {
                const analytic = analytics.find(analytic => analytic.days && analytic.days[dayName] !== undefined);
                if (analytic && (analytic.f_type === 'ΑΝ' || analytic.f_type === 'ΜΕ')) {
                  return analytic.f_type;
                }
                return '';
              }
      
              worksheetData = [
                ['ΑΦΜ', 'ΕΠΩΝΥΜΟ', 'ΟΝΟΜΑ', 'ΤΥΠΟΣ', 'ΔΕΥΤΕΡΑ', 'ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ', 'ΠΕΜΠΤΗ', 'ΠΑΡΑΣΚΕΥΗ', 'ΣΑΒΒΑΤΟ', 'ΚΥΡΙΑΚΗ']
              ];
      
              Object.values(combinedResults).forEach(item => {
                const dayRows = { morning: {}, afternoon: {} };
      
                item.analytics.forEach(analytic => {
                  const days = analytic.days || {};
                  Object.keys(days).forEach(day => {
                    const times = days[day].split(', ');
                    if (times.length > 0) {
                      dayRows.morning[day] = times[0];
                    }
                    if (times.length > 1) {
                      dayRows.afternoon[day] = times[1];
                    }
                  });
                });
      
                const type = item.analytics.some(analytic => analytic.f_type === 'ΤΗΛ') ? 'ΤΗΛ' : 'ΕΡΓ';
      
                const morningRow = [
                  item.afm,
                  item.eponymo,
                  item.onoma,
                  type,
                  dayRows.morning['ΔΕΥΤΕΡΑ'] || getFTypeForDay(item.analytics, 'ΔΕΥΤΕΡΑ'),
                  dayRows.morning['ΤΡΙΤΗ'] || getFTypeForDay(item.analytics, 'ΤΡΙΤΗ'),
                  dayRows.morning['ΤΕΤΑΡΤΗ'] || getFTypeForDay(item.analytics, 'ΤΕΤΑΡΤΗ'),
                  dayRows.morning['ΠΕΜΠΤΗ'] || getFTypeForDay(item.analytics, 'ΠΕΜΠΤΗ'),
                  dayRows.morning['ΠΑΡΑΣΚΕΥΗ'] || getFTypeForDay(item.analytics, 'ΠΑΡΑΣΚΕΥΗ'),
                  dayRows.morning['ΣΑΒΒΑΤΟ'] || getFTypeForDay(item.analytics, 'ΣΑΒΒΑΤΟ'),
                  dayRows.morning['ΚΥΡΙΑΚΗ'] || getFTypeForDay(item.analytics, 'ΚΥΡΙΑΚΗ')
                ];
      
                worksheetData.push(morningRow);
      
                const hasAfternoon = Object.values(dayRows.afternoon).some(value => value);
                if (hasAfternoon) {
                  const afternoonRow = [
                    item.afm,
                    item.eponymo,
                    item.onoma,
                    type,
                    dayRows.afternoon['ΔΕΥΤΕΡΑ'] || '',
                    dayRows.afternoon['ΤΡΙΤΗ'] || '',
                    dayRows.afternoon['ΤΕΤΑΡΤΗ'] || '',
                    dayRows.afternoon['ΠΕΜΠΤΗ'] || '',
                    dayRows.afternoon['ΠΑΡΑΣΚΕΥΗ'] || '',
                    dayRows.afternoon['ΣΑΒΒΑΤΟ'] || '',
                    dayRows.afternoon['ΚΥΡΙΑΚΗ'] || ''
                  ];
      
                  worksheetData.push(afternoonRow);
                }
              });
      
              workbook = new ExcelJS.Workbook();
              worksheet = workbook.addWorksheet("Oraria");
              worksheetData.forEach(row => worksheet.addRow(row));
              buffer = await workbook.xlsx.writeBuffer();
              await fsPromises.writeFile(xlsxFilePath, buffer);
      
              fileLink = isProduction
                ? `https://${host}/xlsx/${filename}`
                : `http://${host}:${port}/xlsx/${filename}`;
              break;
          }
      
          return res.json({ fileLink });

        case "xml":
          let xmlDoc, ergazomenoiElement, xmlFilePath;
          directory = path.join(__dirname, '..', '..', '..', 'public', 'xml');
          
          switch (diadikasia) {
            case "183":
              filename = `dailyWto_${team}_${company}.xml`;
              
              xmlFilePath = await checkDirectoryAndFile(directory, filename);
              
              const formattedFromDate = new Date(apoHmeromhnia).toLocaleDateString('el-GR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
              
              const formattedToDate = new Date(eosHmeromhnia).toLocaleDateString('el-GR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });

              xmlDoc = xmlbuilder.create('WTOS', { encoding: 'utf-8' })
                .att('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema')
                .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
                .att('xmlns', 'http://www.yeka.gr/WTO')
                .ele('WTO', { xmlns: '' })
                  .ele('f_aa_pararthmatos', ypokatasthma).up()
                  .ele('f_rel_protocol').up()
                  .ele('f_rel_date').up()
                  .ele('f_comments').up()
                  .ele('f_from_date', formattedFromDate).up()
                  .ele('f_to_date', formattedToDate).up();

              ergazomenoiElement = xmlDoc.ele('Ergazomenoi');

              Object.keys(combinedResults).forEach((key) => {
                const item = combinedResults[key];
                const formattedDate = new Date(item.hmeromhnia).toLocaleDateString('el-GR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
            
                // Δημιουργούμε το <ErgazomenoiWTO>
                const employee = ergazomenoiElement.ele('ErgazomenoiWTO')
                  .ele('f_afm', item.afm).up()
                  .ele('f_eponymo', item.eponymo).up()
                  .ele('f_onoma', item.onoma).up()
                  .ele('f_date', formattedDate).up()
                  .ele('ErgazomenosAnalytics');
            
                // Εισάγουμε όλα τα analytics για τον εργαζόμενο
                item.analytics.forEach((analytic) => {
                  const employeeAnalytics = employee.ele('ErgazomenosWTOAnalytics')
                    .ele('f_type', analytic.f_type).up();
            
                  // Αν το f_type είναι "ΕΡΓ" ή "ΤΗΛ", προσθέτουμε τις ώρες, αλλιώς τα αφήνουμε κενά
                  
                  const times = formatTime(analytic.f_from, analytic.f_to, 'HH:MM');
                  if (analytic.f_type === 'ΕΡΓ' || analytic.f_type === 'ΤΗΛ') {
                    employeeAnalytics
                      .ele('f_from', times.from).up()
                      .ele('f_to', times.to).up();
                  } else {
                    employeeAnalytics
                      .ele('f_from', '').up()
                      .ele('f_to', '').up();
                  }
                });
              });
              _XMLPATH = xmlFilePath;
              // 6. Αποθήκευση του XML αρχείου στον server με χρήση fsPromises API
              await fsPromises.writeFile(xmlFilePath, xmlDoc.end({ pretty: true }), 'utf-8');
              await uploadOrariaXml(username, password);
              break;

            case "182":
              filename = `weeklyWto_${team}_${company}.xml`;
              xmlFilePath = await checkDirectoryAndFile(directory, filename);
              
              xmlDoc = xmlbuilder.create('WTOS', { encoding: 'utf-8' })
                .att('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema')
                .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
                .att('xmlns', 'http://www.yeka.gr/WTO')
                .ele('WTO', { xmlns: '' })
                  .ele('f_aa_pararthmatos', ypokatasthma).up()
                  .ele('f_rel_protocol').up()
                  .ele('f_rel_date').up()
                  .ele('f_comments').up()
                  .ele('f_from_date', new Date(apoHmeromhnia).toLocaleDateString('el-GR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })).up()
                  .ele('f_to_date', '').up();
                  // .ele('f_to_date', new Date(eosHmeromhnia).toLocaleDateString('el-GR', {
                  //   day: '2-digit',
                  //   month: '2-digit',
                  //   year: 'numeric'
                  // })).up();
        
              // Προσθήκη των εργαζομένων στο XML
              ergazomenoiElement = xmlDoc.ele('Ergazomenoi');
    
              Object.keys(combinedResults).forEach((key) => {
                const item = combinedResults[key];
                const formattedDate = new Date(item.hmeromhnia).toLocaleDateString('el-GR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                
                // Υπολογισμός της ημέρας της εβδομάδας
                const dayOfWeek = getDayOfWeek(item.hmeromhnia);
          
                const employee = ergazomenoiElement.ele('ErgazomenoiWTO')
                  .ele('f_afm', item.afm || '999999999').up()
                  .ele('f_eponymo', item.eponymo || 'ΤΕΣΤ').up()
                  .ele('f_onoma', item.onoma || 'ΤΕΣΤ').up()
                  .ele('f_day', dayOfWeek).up()  // Ημέρα της εβδομάδας
                  .ele('ErgazomenosAnalytics');
          
                item.analytics.forEach((analytic) => {
                  // Χρήση της μορφής HH:MM για το XML
                  const times = formatTime(analytic.f_from, analytic.f_to, 'HH:MM');
                  
                  employee.ele('ErgazomenosWTOAnalytics')
                    .ele('f_type', analytic.f_type || 'ΑΝ').up()
                    .ele('f_from', times.from).up() // Ώρες σε μορφή HH:MM για το XML
                    .ele('f_to', times.to).up();    // Ώρες σε μορφή HH:MM για το XML
                });
              });
          
              _XMLPATH = xmlFilePath;

              // 6. Αποθήκευση του XML αρχείου στον server με χρήση fsPromises API
              await fsPromises.writeFile(xmlFilePath, xmlDoc.end({ pretty: true }), 'utf-8');
              await uploadOrariaXml(username, password);
              break;
          }
          break;

        case "json":
          let jsonFilePath, jsonData;
          directory = path.join(__dirname, '..', '..', '..', 'public', 'json');

          switch (diadikasia) {

            case "183":
              filename = `dailyWto_${team}_${company}.json`;
              jsonFilePath = await checkDirectoryAndFile(directory, filename);
        
              // 5. Δημιουργία του JSON αντικειμένου
              jsonData = {
                WTOS: {
                  WTO: [
                    {
                      f_aa_pararthmatos: ypokatasthma,
                      f_rel_protocol: "",
                      f_rel_date: "",
                      f_comments: "test",
                      f_from_date: new Date(apoHmeromhnia).toLocaleDateString('el-GR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }),
                      f_to_date: new Date(eosHmeromhnia).toLocaleDateString('el-GR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }),
                      Ergazomenoi: Object.values(combinedResults).map((item) => ({
                        f_afm: item.afm,
                        f_eponymo: item.eponymo,
                        f_onoma: item.onoma,
                        f_date: new Date(item.hmeromhnia).toLocaleDateString('el-GR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }),
                        ErgazomenosAnalytics: {
                          ErgazomenosWTOAnalytics: item.analytics.map((analytic) => ({
                            f_type: analytic.f_type || 'ΕΡΓ',
                            f_from: analytic.f_from,
                            f_to: analytic.f_to
                          }))
                        }
                      }))
                    }
                  ]
                }
              };
              // Αποθήκευση του JSON αρχείου στον server με χρήση fsPromises API
              await fsPromises.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
              break;

            case "182":
              filename = `weeklyWto_${team}_${company}.json`;
              jsonFilePath = await checkDirectoryAndFile(directory, filename);

              // Δημιουργία του JSON αντικειμένου για 182
              jsonData = {
                WTOS: {
                  WTO: [
                    {
                      f_aa_pararthmatos: ypokatasthma,
                      f_rel_protocol: "",
                      f_rel_date: "",
                      f_comments: "test",
                      f_from_date: new Date(apoHmeromhnia).toLocaleDateString('el-GR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }),
                      f_to_date: "",
                      // f_to_date: new Date(eosHmeromhnia).toLocaleDateString('el-GR', {
                      //   day: '2-digit',
                      //   month: '2-digit',
                      //   year: 'numeric'
                      // }),
                      Ergazomenoi: {
                        ErgazomenoiWTO: Object.values(combinedResults).reduce((acc, item) => {
                          // Αρχικοποίηση ενός αντικειμένου ανά ημέρα
                          item.analytics.forEach((analytic) => {
                            const day = getDayOfWeek(item.hmeromhnia);

                            // Βρίσκουμε αν υπάρχει ήδη εγγραφή για την ημέρα
                            let employeeEntry = acc.find(
                              (entry) =>
                                entry.f_afm === item.afm &&
                                entry.f_day === day
                            );

                            if (!employeeEntry) {
                              // Αν δεν υπάρχει, δημιουργούμε νέο entry
                              employeeEntry = {
                                f_afm: item.afm,
                                f_eponymo: item.eponymo,
                                f_onoma: item.onoma,
                                f_day: day,
                                ErgazomenosAnalytics: {
                                  ErgazomenosWTOAnalytics: []
                                }
                              };
                              acc.push(employeeEntry); // Προσθέτουμε στο acc (αποθηκεύουμε το entry)
                            }

                            // Προσθέτουμε τα analytics στο ErgazomenosWTOAnalytics της ημέρας
                            employeeEntry.ErgazomenosAnalytics.ErgazomenosWTOAnalytics.push({
                              f_type: analytic.f_type || 'ΕΡΓ',
                              f_from: analytic.f_from,
                              f_to: analytic.f_to
                            });
                          });

                          return acc;
                        }, []) // Αρχικοποίηση του acc ως κενό array
                      }
                    }
                  ]
                }
              };

              // Αποθήκευση του JSON αρχείου στον server με χρήση fsPromises API
              await fsPromises.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
              break;
          }
          break;
      }

      function getDayOfWeek(dateString) {
        const date = new Date(dateString);
        const dayOfWeek = date.getDay();  // Επιστρέφει αριθμό (0 για Κυριακή, 1 για Δευτέρα, ..., 6 για Σάββατο)
        return dayOfWeek.toString();      // Μετατροπή σε string για το XML
      }
      
      function downloadFileAsync(res, filePath, fileName) {
        return new Promise((resolve, reject) => {
          res.download(filePath, fileName, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      // 7. Επιστροφή απάντησης με το link του αρχείου ή αποστολή του αρχείου απευθείας

      // await downloadFileAsync(res, directory, "0001_orario.xlsx"); // Κατεβάζει το αρχείο στον client με όνομα 0001_orario.xlsx

      const checkMessage = _ALERTMESSAGE === "" ? "ok" : "wrong";

      res.json({ success: true, redirectUrl: "/ergazomenoi/programmata/exagoghOrarionSeErganh", message: _ALERTMESSAGE, checkMessage: checkMessage });

    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).send('Error fetching schedules');
    }

    // ==================================UPLOAD το ψηφιακό ωράριο στο ΕΡΓΑΝΗ ======================================
    async function uploadOrariaXml(username, password) {
      const _DIADIKASIA_YPOBOLHS = diadikasia;
      let chromeDriverPath;

      if (isProduction) {
        // Production - Διαδρομή για Linux (EC2 ή άλλος server)
        chromeDriverPath = '/usr/bin/chrome';
      } else {
        // Development - διαδρομή του Chrome τοπικά (Windows)
        chromeDriverPath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
      }

      let options = new chrome.Options();

      // Προσαρμογή φακέλου λήψεων ανάλογα με το λειτουργικό σύστημα
      if (isProduction) {
        options.setUserPreferences({
          'download.prompt_for_download': false,
          'download.default_directory': '/tmp/downloads',  // Καθορισμός φακέλου downloads για Linux
          'safebrowsing.enabled': true
        });
      } else {
        options.setUserPreferences({
          'download.prompt_for_download': false,
          'download.default_directory': path.join(__dirname, 'downloads'),  // Καθορισμός φακέλου downloads για Windows
          'safebrowsing.enabled': true
        });
      }

      // Δημιουργία επιλογών για το Chrome
      options.addArguments('--headless'); // Εκτέλεση χωρίς GUI
      options.addArguments('--disable-gpu'); // Απενεργοποίηση της GPU
      options.addArguments('--no-sandbox'); // Απενεργοποίηση του sandbox
      options.addArguments('--disable-dev-shm-usage'); // Χρήση shared memory
      
      // // Ορισμός της διαδρομής του ChromeDriver μέσω του binary
      if (chromeDriverPath) {
        options.setChromeBinaryPath(chromeDriverPath);
      }

      let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
      // let driver = await new Builder().forBrowser("chrome").build();

      await driver.get('https://eservices.yeka.gr/login.aspx');
    
      try {
        // Είσοδος
        await driver.findElement(By.id('ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_UserName')).sendKeys(username);
        await driver.findElement(By.id('ctl00_ctl00_ContentHolder_ContentHolder_SiteLogin_Password')).sendKeys(password, Key.RETURN);

        // Πλοήγηση στη σελίδα και επιλογή ημερομηνιών
        await driver.findElement(By.xpath('//*[@id="ctl00_ctl00_ContentHolder_ContentHolder_SdcTableMenu"]/div/ol/li[8]/ol/li[1]/ol/li[1]/div/a')).click();

        // Επιλέγω το dropdown και θέτω την τιμή 183 (Οργάνωση Ψηφιακού Χρόνου Μεταβαλλόμενο / Τροποποιούμενο ανά Ημέρα)
        const dropdown = await driver.wait(until.elementLocated(By.id('ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_SKYpobolesList')), 10000);
        await dropdown.click();
        const option = await dropdown.findElement(By.css(`option[value="${_DIADIKASIA_YPOBOLHS}"]`));
        await option.click();

        // Περιμένει να γίνει διαθέσιμο το πεδίο input τύπου file
        const fileInput = await driver.wait(until.elementLocated(By.id('ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_XMLFileUploader')), 10000);
        await fileInput.sendKeys(_XMLPATH);    
    
        // Περιμένουμε το alert να εμφανιστεί
        await driver.wait(until.alertIsPresent(), 10000);  // Μέχρι 10 δευτερόλεπτα αναμονή

        // Μεταφορά στο alert και κλικ στο "OK"
        let alert = await driver.switchTo().alert();
        await alert.accept();  // Κλικ στο OK του alert

        // Χρήση JavaScript για να επιλέξω το checkbox
        await driver.executeScript("document.getElementById('ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_SubmitBox').checked = true;");

        // Εντοπισμός του κουμπιού "Ενημέρωση"
        const submitButton = await driver.findElement(By.id('ctl00_ctl00_ContentHolder_ContentHolder_AnaggeliesXMLControl_UploadFileButton'));

        // Κλικ στο κουμπί "Ενημέρωση"
        await submitButton.click();

        // Περίμενε για το alert να εμφανιστεί
        await driver.wait(until.alertIsPresent(), 10000);  // 10 δευτερόλεπτα αναμονή για το alert
        
        // Εντοπισμός του alert για να ελέγξουμε την εμφάνισή του
        alert = await driver.switchTo().alert();
        
        // Το παρακάτω θα δουλέψει

        // Στο σημείο αυτό το πρόγραμμα περιμένει τον χρήστη να κάνει κλικ στο alert.
        // Μόλις ο χρήστης αποδεχθεί το alert, ο κώδικας συνεχίζει.
        // Μετά το κλείσιμο του alert από τον χρήστη
        // await driver.wait(until.stalenessOf(alert), 10000);  // Αναμονή για να κλείσει το alert
        // μόνο αν αφαιρεθεί το       
        // options.addArguments('--headless');     Στην αρχή της συνάρτησης

        let alertMessage = await alert.getText();  // Παίρνουμε το κείμενο του alert
        _ALERTMESSAGE = alertMessage;
        await alert.accept();   // Αποδοχή του alert προγραμματιστικά

        // Στέλνουμε το μήνυμα του alert πίσω στον client για εμφάνιση με SweetAlert2
        // res.json({ message: alertMessage });


      } finally {
        await driver.quit();
      }
    }
  };

};

export default programmataController;
