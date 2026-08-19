'use strict';

const DEFAULT_EMPLOYEE_PAGE_SIZE = 50;
const MAX_EMPLOYEE_PAGE_SIZE = 100;

function normalizeEmployeeCodes(values = []) {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'el', { numeric: true }));
}

function paginateEmployeeCodes({
    values,
    selectedEmployeeCode = '',
    page = 1,
    limit = DEFAULT_EMPLOYEE_PAGE_SIZE
}) {
    const allEmployeeCodes = normalizeEmployeeCodes(values);
    const requestedEmployeeCode = String(selectedEmployeeCode || '').trim();
    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = requestedEmployeeCode
        ? 1
        : Math.min(Math.max(Number.parseInt(limit, 10) || DEFAULT_EMPLOYEE_PAGE_SIZE, 1),
            MAX_EMPLOYEE_PAGE_SIZE);
    const offset = (pageNumber - 1) * pageSize;
    const employeeCodes = requestedEmployeeCode
        ? allEmployeeCodes.filter((value) => value === requestedEmployeeCode)
        : allEmployeeCodes.slice(offset, offset + pageSize);
    return {
        page: pageNumber,
        limit: pageSize,
        totalEmployees: allEmployeeCodes.length,
        totalPages: Math.max(Math.ceil(allEmployeeCodes.length / pageSize), 1),
        employeeCodes
    };
}

function groupByEmployeeCode(rows = []) {
    const grouped = new Map();
    rows.forEach((row) => {
        const employeeCode = String(row?.kodikos || '').trim();
        if (!employeeCode) return;
        if (!grouped.has(employeeCode)) grouped.set(employeeCode, []);
        grouped.get(employeeCode).push(row);
    });
    return grouped;
}

async function loadEmploymentReviewRequestContext({
    employeeCodeLoader,
    dailyRowsLoader,
    dependencyRowsLoader,
    selectedEmployeeCode = '',
    page = 1,
    limit = DEFAULT_EMPLOYEE_PAGE_SIZE
}) {
    const values = await employeeCodeLoader();
    const pagination = paginateEmployeeCodes({ values, selectedEmployeeCode, page, limit });
    const [dailyRows, dependencyRows] = await Promise.all([
        dailyRowsLoader(pagination.employeeCodes),
        dependencyRowsLoader(pagination.employeeCodes)
    ]);
    return {
        ...pagination,
        dailyRows,
        dependencyRows,
        dailyRowsByEmployeeCode: groupByEmployeeCode(dailyRows),
        dependencyRowsByEmployeeCode: groupByEmployeeCode(dependencyRows)
    };
}

module.exports = {
    DEFAULT_EMPLOYEE_PAGE_SIZE,
    MAX_EMPLOYEE_PAGE_SIZE,
    normalizeEmployeeCodes,
    paginateEmployeeCodes,
    groupByEmployeeCode,
    loadEmploymentReviewRequestContext
};
