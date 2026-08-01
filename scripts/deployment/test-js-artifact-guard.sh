#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

readonly PRODUCTION_APPLICATION_ROOT='/home/ubuntu/Payroll-NodeJs'

fail() {
    echo "TEST JS DEPLOYMENT GUARD FAILED: $1" >&2
    exit 1
}

validate_application_root() {
    local requested_root="$1"
    [[ -n "$requested_root" ]] || fail "application root is empty"
    [[ "$requested_root" == /* ]] || fail "application root must be absolute"
    [[ "$requested_root" != "/" ]] || fail "application root is unsafe"
    [[ "$requested_root" != "${HOME:-}" ]] || fail "application root is unsafe"
    [[ ! -L "$requested_root" ]] || fail "application root must not be a symlink"
    [[ -d "$requested_root" ]] || fail "application root does not exist"

    local canonical_root
    canonical_root=$(realpath -e -- "$requested_root" 2>/dev/null) \
        || fail "application root cannot be resolved"
    [[ "$canonical_root" == "$requested_root" ]] || fail "application root must be canonical"
    [[ -f "$canonical_root/app.js" ]] || fail "application marker app.js is missing"
    [[ -f "$canonical_root/package.json" ]] || fail "application marker package.json is missing"
    [[ -d "$canonical_root/server" ]] || fail "application marker server is missing"
    [[ -d "$canonical_root/public" ]] || fail "application marker public is missing"

    printf '%s\n' "$canonical_root"
}

collect_application_test_files() {
    local application_root="$1"
    local output_file="$2"
    find "$application_root" -xdev \
        -type d -name node_modules -prune -o \
        -type f -name '*.test.js' -print0 > "$output_file" 2>/dev/null
}

read_application_test_files() {
    local application_root="$1"
    local destination_name="$2"
    local temporary_file cleanup_trap
    local -n destination="$destination_name"

    temporary_file=$(mktemp) || fail "temporary file creation failed"
    printf -v cleanup_trap 'rm -f -- %q 2>/dev/null' "$temporary_file"
    trap "$cleanup_trap" RETURN EXIT

    if ! collect_application_test_files "$application_root" "$temporary_file"; then
        fail "application test-file scan failed"
    fi
    if ! mapfile -d '' -t destination < "$temporary_file"; then
        fail "application test-file list could not be read"
    fi

    rm -f -- "$temporary_file" 2>/dev/null || fail "temporary file cleanup failed"
    trap - RETURN EXIT
}

verify_application_test_files() {
    local application_root="$1"
    local -a test_files=()
    read_application_test_files "$application_root" test_files
    echo "Application test files found: ${#test_files[@]}"
    [[ ${#test_files[@]} -eq 0 ]] || fail "application test files remain"
    echo "Application test-file verification complete: 0 found"
}

cleanup_application_test_files() {
    local application_root="$1"
    local -a test_files=()
    read_application_test_files "$application_root" test_files
    echo "Application test files found: ${#test_files[@]}"

    local test_file
    for test_file in "${test_files[@]}"; do
        [[ "$test_file" == "$application_root/"* ]] \
            || fail "resolved cleanup target escaped application root"
        [[ -f "$test_file" && ! -L "$test_file" ]] \
            || fail "cleanup target changed or is not a regular file"
        rm -f -- "$test_file" 2>/dev/null || fail "application test file could not be removed"
    done

    test_files=()
    read_application_test_files "$application_root" test_files
    [[ ${#test_files[@]} -eq 0 ]] || fail "application test files remain after cleanup"
    echo "Application test-file cleanup complete: 0 remaining"
}

run_guard_action() {
    local action="$1"
    local application_root="$2"
    [[ "$action" == "cleanup" || "$action" == "verify" ]] \
        || fail "action must be cleanup or verify"

    if [[ "$action" == "cleanup" ]]; then
        cleanup_application_test_files "$application_root"
    else
        verify_application_test_files "$application_root"
    fi
}

main() {
    local action="${1:-}"
    local requested_root="${2:-}"
    [[ $# -eq 2 ]] || fail "usage: cleanup|verify APPLICATION_ROOT"

    local application_root
    application_root=$(validate_application_root "$requested_root")
    [[ "$application_root" == "$PRODUCTION_APPLICATION_ROOT" ]] \
        || fail "application root is not the production application root"

    run_guard_action "$action" "$application_root"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
