const USER_ROLE_DEFINITIONS = Object.freeze({
    A: Object.freeze({ value: 'A', label: 'Admin', selectable: true }),
    S: Object.freeze({ value: 'S', label: 'Supervisor', selectable: true }),
    HR: Object.freeze({ value: 'HR', label: 'HR', selectable: true }),
    C: Object.freeze({ value: 'C', label: 'Customer', selectable: true }),
    U: Object.freeze({ value: 'U', label: 'User', selectable: false }),
    V: Object.freeze({ value: 'V', label: 'Visitor', selectable: true })
});

const USER_ROLE_CODES = Object.freeze(Object.keys(USER_ROLE_DEFINITIONS));

function normalizeUserRole(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toUpperCase();
}

function isAllowedUserRole(value) {
    return Object.prototype.hasOwnProperty.call(USER_ROLE_DEFINITIONS, normalizeUserRole(value));
}

function isAdminUserRole(value) {
    return normalizeUserRole(value) === 'A';
}

function getUserRoleLabel(value) {
    return USER_ROLE_DEFINITIONS[normalizeUserRole(value)]?.label || 'Άγνωστος ρόλος';
}

function getSelectableAdminUserRoles() {
    return USER_ROLE_CODES
        .filter((code) => USER_ROLE_DEFINITIONS[code].selectable)
        .map((code) => ({ ...USER_ROLE_DEFINITIONS[code] }));
}

function getUserRoleOptionsForCurrentValue(currentValue) {
    const normalizedRole = normalizeUserRole(currentValue);
    const options = getSelectableAdminUserRoles();
    if (normalizedRole === 'U') options.push({ ...USER_ROLE_DEFINITIONS.U });
    return options;
}

function getUserRoleBadgeClass(value) {
    const classes = {
        A: 'bg-danger',
        S: 'bg-warning text-dark',
        HR: 'bg-info text-dark',
        C: 'bg-primary',
        U: 'bg-secondary',
        V: 'bg-secondary'
    };
    return classes[normalizeUserRole(value)] || 'bg-secondary';
}

module.exports = {
    USER_ROLE_CODES,
    normalizeUserRole,
    isAllowedUserRole,
    isAdminUserRole,
    getUserRoleLabel,
    getSelectableAdminUserRoles,
    getUserRoleOptionsForCurrentValue,
    getUserRoleBadgeClass
};
