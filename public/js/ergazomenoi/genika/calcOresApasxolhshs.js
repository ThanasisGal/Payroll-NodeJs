  let _HMERES = 0;

  let totalHours = {
    geniko_Synolo_Oron_Ergasias: 0,
    geniko_Synolo_Oron_Nyxterinhs_Ergasias: 0,
    geniko_Synolo_Oron_Ergasias_Argion: 0,
    geniko_Synolo_Oron_Yperergasias: 0,
    geniko_Synolo_Oron_Yperergasias_Nyxtas: 0,
    geniko_Synolo_Oron_Yperergasias_Argion: 0,
    geniko_Synolo_Oron_Yperergasias_Argion_Nyxtas: 0,
    geniko_Synolo_Oron_Nomimhs_Yperorias: 0,
    geniko_Synolo_Oron_Nomimhs_Yperorias_Nyxtas: 0,
    geniko_Synolo_Oron_Nomimhs_Yperorias_Argion: 0,
    geniko_Synolo_Oron_Nomimhs_Yperorias_Argion_Nyxtas: 0,
    geniko_Synolo_Oron_Paranomhs_Yperorias: 0,
    geniko_Synolo_Oron_Paranomhs_Yperorias_Nyxtas: 0,
    geniko_Synolo_Oron_Paranomhs_Yperorias_Argion: 0,
    geniko_Synolo_Oron_Paranomhs_Yperorias_Argion_Nyxtas: 0
  };

  let dailyTotals = {};

  function attachTimeInputListeners() {
    const days = parseInt(document.getElementById("differenceInDays").value);
    _HMERES = days;
    
    for (let d1 = 1; d1 <= days; d1++) {
      let day = d1 < 10 ? '0' + d1 : d1;
      for (let j = 1; j <= 3; j++) {
        const startTimeInput = document.getElementById(`apo_ora_0${j}_${day}`);
        const endTimeInput = document.getElementById(`eos_ora_0${j}_${day}`);
        if (startTimeInput) {
          startTimeInput.addEventListener('change', () => calculateDayHours(day));
          startTimeInput.addEventListener('blur', () => calculateDayHours(day));
        }
        if (endTimeInput) {
          endTimeInput.addEventListener('change', () => calculateDayHours(day));
          endTimeInput.addEventListener('blur', () => calculateDayHours(day));
        }
      }
    }
  }

  function calculateDayHours(day) {
    let minutesWorked = new Array(1440).fill(0);

    if (dailyTotals[day]) {
      totalHours.geniko_Synolo_Oron_Ergasias -= dailyTotals[day].working || 0;
      totalHours.geniko_Synolo_Oron_Nyxterinhs_Ergasias -= dailyTotals[day].night || 0;
      totalHours.geniko_Synolo_Oron_Ergasias_Argion -= dailyTotals[day].holiday || 0;
      totalHours.geniko_Synolo_Oron_Yperergasias -= dailyTotals[day].overwork || 0;
      totalHours.geniko_Synolo_Oron_Yperergasias_Nyxtas -= dailyTotals[day].nightOverwork || 0;
      totalHours.geniko_Synolo_Oron_Yperergasias_Argion -= dailyTotals[day].holidayOverwork || 0;
      totalHours.geniko_Synolo_Oron_Yperergasias_Argion_Nyxtas -= dailyTotals[day].nightHolidayOverwork || 0;
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias -= dailyTotals[day].overtime || 0;
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Nyxtas -= dailyTotals[day].nightOvertime || 0;
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion -= dailyTotals[day].holidayOvertime || 0;
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion_Nyxtas -= dailyTotals[day].nightHolidayOvertime || 0;
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias -= dailyTotals[day].overtimeIllegal || 0;
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Nyxtas -= dailyTotals[day].nightOvertimeIllegal || 0;
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion -= dailyTotals[day].holidayOvertimeIllegal || 0;
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion_Nyxtas -= dailyTotals[day].nightHolidayOvertimeIllegal || 0;
    }

    dailyTotals[day] = { 
      working: 0, 
      night: 0, 
      holiday: 0, 
      overwork: 0, 
      nightOverwork: 0, 
      holidayOverwork: 0, 
      nightHolidayOverwork: 0, 
      overtime: 0, 
      nightOvertime: 0, 
      holidayOvertime: 0, 
      nightHolidayOvertime: 0, 
      overtimeIllegal: 0, 
      nightOvertimeIllegal: 0, 
      holidayOvertimeIllegal: 0, 
      nightHolidayOvertimeIllegal: 0
    };
    
    const isHoliday = document.getElementById(`argia_${String(day).padStart(2, '0')}`).checked;
    const dateInput = document.getElementById(`hmeromhnia_${String(day).padStart(2, '0')}`).value;
    const dayOfWeek = new Date(dateInput).getDay();
    const isSunday = dayOfWeek === 0; // 0 = Κυριακή
    const isNextHoliday = (parseInt(day) + 1 <= _HMERES) ? document.getElementById(`argia_${String(parseInt(day) + 1).padStart(2, '0')}`).checked : false;
    const nextDateInput = (parseInt(day) + 1 <= _HMERES) ? document.getElementById(`hmeromhnia_${String(parseInt(day) + 1).padStart(2, '0')}`).value : null;
    const nextDayOfWeek = nextDateInput ? new Date(nextDateInput).getDay() : -1;
    const isNextSunday = nextDayOfWeek === 0; // 0 = Κυριακή

    let intervals = [];

    for (let j = 1; j <= 3; j++) {
      const startTimeInput = document.getElementById(`apo_ora_0${j}_${day}`);
      const endTimeInput = document.getElementById(`eos_ora_0${j}_${day}`);
      if (!startTimeInput || !endTimeInput || !startTimeInput.value || !endTimeInput.value) {
        continue;
      }

      let startTime = convertTimeToMinutes(startTimeInput.value);
      let endTime = convertTimeToMinutes(endTimeInput.value);
      if (endTime < startTime) endTime += 1440;

      intervals.push({ start: startTime, end: endTime, shift: j });
    }

    const workHours = calculateWorkHoursForIntervals(intervals, isHoliday || isSunday, isNextHoliday || isNextSunday);

    dailyTotals[day].working += workHours.working;
    dailyTotals[day].night += workHours.night;
    dailyTotals[day].holiday += workHours.holiday;
    dailyTotals[day].overwork += workHours.overwork;
    dailyTotals[day].nightOverwork += workHours.nightOverwork;
    dailyTotals[day].holidayOverwork += workHours.holidayOverwork;
    dailyTotals[day].nightHolidayOverwork += workHours.nightHolidayOverwork;
    dailyTotals[day].overtime += workHours.overtime;
    dailyTotals[day].nightOvertime += workHours.nightOvertime;
    dailyTotals[day].holidayOvertime += workHours.holidayOvertime;
    dailyTotals[day].nightHolidayOvertime += workHours.nightHolidayOvertime;
    dailyTotals[day].overtimeIllegal += workHours.overtimeIllegal;
    dailyTotals[day].nightOvertimeIllegal += workHours.nightOvertimeIllegal;
    dailyTotals[day].holidayOvertimeIllegal += workHours.holidayOvertimeIllegal;
    dailyTotals[day].nightHolidayOvertimeIllegal += workHours.nightHolidayOvertimeIllegal;

    document.getElementById(`total_hours_day_${day}`).value = workHours.working.toFixed(2);
    document.getElementById(`night_hours_day_${day}`).value = dailyTotals[day].night.toFixed(2);
    document.getElementById(`holiday_hours_day_${day}`).value = dailyTotals[day].holiday.toFixed(2);
    document.getElementById(`overwork_hours_day_${day}`).value = dailyTotals[day].overwork.toFixed(2);
    document.getElementById(`night_overwork_hours_day_${day}`).value = dailyTotals[day].nightOverwork.toFixed(2);
    document.getElementById(`holiday_overwork_hours_day_${day}`).value = dailyTotals[day].holidayOverwork.toFixed(2);
    document.getElementById(`night_holiday_overwork_hours_day_${day}`).value = dailyTotals[day].nightHolidayOverwork.toFixed(2);
    document.getElementById(`overtimeNomimh_hours_day_${day}`).value = dailyTotals[day].overtime.toFixed(2);
    document.getElementById(`night_overtimeNomimh_hours_day_${day}`).value = dailyTotals[day].nightOvertime.toFixed(2);
    document.getElementById(`holiday_overtimeNomimh_hours_day_${day}`).value = dailyTotals[day].holidayOvertime.toFixed(2);
    document.getElementById(`night_holiday_overtimeNomimh_hours_day_${day}`).value = dailyTotals[day].nightHolidayOvertime.toFixed(2);
    document.getElementById(`overtimeParanomh_hours_day_${day}`).value = dailyTotals[day].overtimeIllegal.toFixed(2);
    document.getElementById(`night_overtimeParanomh_hours_day_${day}`).value = dailyTotals[day].nightOvertimeIllegal.toFixed(2);
    document.getElementById(`holiday_overtimeParanomh_hours_day_${day}`).value = dailyTotals[day].holidayOvertimeIllegal.toFixed(2);
    document.getElementById(`night_holiday_overtimeParanomh_hours_day_${day}`).value = dailyTotals[day].nightHolidayOvertimeIllegal.toFixed(2);
    
    mhdenismosSynolon();
    updateTotalHours();
    updateUI();
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

  function mhdenismosSynolon() {
    totalHours.geniko_Synolo_Oron_Ergasias = 0 
    totalHours.geniko_Synolo_Oron_Nyxterinhs_Ergasias = 0 
    totalHours.geniko_Synolo_Oron_Ergasias_Argion = 0 
    totalHours.geniko_Synolo_Oron_Yperergasias = 0 
    totalHours.geniko_Synolo_Oron_Yperergasias_Nyxtas = 0 
    totalHours.geniko_Synolo_Oron_Yperergasias_Argion = 0 
    totalHours.geniko_Synolo_Oron_Yperergasias_Argion_Nyxtas = 0 
    totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias = 0 
    totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Nyxtas = 0 
    totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion = 0 
    totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion_Nyxtas = 0 
    totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias = 0 
    totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Nyxtas = 0 
    totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion = 0 
    totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion_Nyxtas = 0 
  }

  function updateTotalHours() {
    for (let d1 = 1; d1 <= _HMERES; d1++) {
      let day = d1 < 10 ? '0' + d1 : d1;
      totalHours.geniko_Synolo_Oron_Ergasias += parseFloat(document.getElementById(`total_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Nyxterinhs_Ergasias += parseFloat(document.getElementById(`night_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Ergasias_Argion += parseFloat(document.getElementById(`holiday_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Yperergasias += parseFloat(document.getElementById(`overwork_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Yperergasias_Nyxtas += parseFloat(document.getElementById(`night_overwork_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Yperergasias_Argion += parseFloat(document.getElementById(`holiday_overwork_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Yperergasias_Argion_Nyxtas += parseFloat(document.getElementById(`night_holiday_overwork_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias += parseFloat(document.getElementById(`overtimeNomimh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Nyxtas += parseFloat(document.getElementById(`night_overtimeNomimh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion += parseFloat(document.getElementById(`holiday_overtimeNomimh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion_Nyxtas += parseFloat(document.getElementById(`night_holiday_overtimeNomimh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias += parseFloat(document.getElementById(`overtimeParanomh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Nyxtas += parseFloat(document.getElementById(`night_overtimeParanomh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion += parseFloat(document.getElementById(`holiday_overtimeParanomh_hours_day_${day}`).value);
      totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion_Nyxtas += parseFloat(document.getElementById(`night_holiday_overtimeParanomh_hours_day_${day}`).value);
    }
  }

  function updateUI() {
    document.getElementById('total_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Ergasias).toFixed(2);
    document.getElementById('night_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Nyxterinhs_Ergasias).toFixed(2);
    document.getElementById('holiday_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Ergasias_Argion).toFixed(2);

    document.getElementById('overwork_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Yperergasias).toFixed(2);
    document.getElementById('night_overwork_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Yperergasias_Nyxtas).toFixed(2);
    document.getElementById('holiday_overwork_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Yperergasias_Argion).toFixed(2);
    document.getElementById('night_holiday_overwork_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Yperergasias_Argion_Nyxtas).toFixed(2);

    document.getElementById('overtimeNomimh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias).toFixed(2);
    document.getElementById('night_overtimeNomimh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Nyxtas).toFixed(2);
    document.getElementById('holiday_overtimeNomimh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion).toFixed(2);
    document.getElementById('night_holiday_overtimeNomimh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Nomimhs_Yperorias_Argion_Nyxtas).toFixed(2);

    document.getElementById('overtimeParanomh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias).toFixed(2);
    document.getElementById('night_overtimeParanomh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Nyxtas).toFixed(2);
    document.getElementById('holiday_overtimeParanomh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion).toFixed(2);
    document.getElementById('night_holiday_overtimeParanomh_hours_day').value = parseFloat(totalHours.geniko_Synolo_Oron_Paranomhs_Yperorias_Argion_Nyxtas).toFixed(2);
  }
