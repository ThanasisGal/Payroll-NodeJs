'use strict';
// Local administrator-owned files, never HTTP input. An uncertain claim is
// permanently consumed: a crash, abort or lost acknowledgement cannot rearm it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function fail(reason) {
    const code = 'EMPLOYEE_HISTORY_PILOT_' + reason;
    throw Object.assign(new Error('Η πιλοτική τακτοποίηση ή αναίρεση σταμάτησε επειδή δεν επιβεβαιώθηκε η άδεια ή η κατάσταση των στοιχείων. ' +
        'Δεν αποθηκεύτηκε καμία αλλαγή στη βάση δεδομένων από αυτή την ενέργεια.\n1. Μην εκδώσετε νέα έγκριση.\n2. Ζητήστε από τον διαχειριστή έλεγχο της άδειας και της καταγραφής ενεργειών.\nΚωδικός αναφοράς: ' + code + '.'),
    { code, statusCode: 423 });
}
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function privateDirectory(directory, appRoot) {
    const resolved = fs.realpathSync(directory);
    if (!path.isAbsolute(directory) || resolved !== path.resolve(directory)) fail('DIRECTORY');
    // Reject every Git worktree/repository, including an enclosing repository.
    for (let parent = resolved; ; parent = path.dirname(parent)) {
        if (fs.existsSync(path.join(parent, '.git'))) fail('DIRECTORY_IN_GIT');
        if (parent === path.dirname(parent)) break;
    }
    if (appRoot && (resolved === appRoot || resolved.startsWith(appRoot + path.sep))) fail('DIRECTORY_IN_APP');
    const stat = fs.lstatSync(resolved);
    if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('DIRECTORY_PERMISSIONS');
    return resolved;
}
function readPrivate(file, appRoot) {
    privateDirectory(path.dirname(file), appRoot);
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('FILE_PERMISSIONS');
        return fs.readFileSync(fd);
    } finally { fs.closeSync(fd); }
}
function writeExclusive(file, bytes, appRoot) {
    const directory = privateDirectory(path.dirname(file), appRoot);
    let fd;
    try {
        fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
    } catch (error) {
        // Never remove a partial claim: it is a durable fail-closed tombstone.
        if (error.code === 'EEXIST') fail('ALREADY_CLAIMED');
        throw error;
    } finally { if (fd !== undefined) fs.closeSync(fd); }
    const parent = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    return digest(bytes);
}
module.exports = { fail, digest, privateDirectory, readPrivate, writeExclusive };
