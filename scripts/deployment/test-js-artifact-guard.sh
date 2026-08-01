#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

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
    canonical_root=$(realpath -e -- "$requested_root") || fail "application root cannot be resolved"
    [[ "$canonical_root" == "$requested_root" ]] || fail "application root must be canonical"
    [[ -f "$canonical_root/app.js" ]] || fail "application marker app.js is missing"
    [[ -f "$canonical_root/package.json" ]] || fail "application marker package.json is missing"
    [[ -d "$canonical_root/server" ]] || fail "application marker server is missing"
    [[ -d "$canonical_root/public" ]] || fail "application marker public is missing"

    printf '%s\n' "$canonical_root"
}

collect_application_test_files() {
    local application_root="$1"
    find "$application_root" -xdev \
        -type d -name node_modules -prune -o \
        -type f -name '*.test.js' -print0
}

main() {
    local action="${1:-}"
    local requested_root="${2:-}"
    [[ $# -eq 2 ]] || fail "usage: cleanup|verify APPLICATION_ROOT"
    [[ "$action" == "cleanup" || "$action" == "verify" ]] \
        || fail "action must be cleanup or verify"

    local application_root
    application_root=$(validate_application_root "$requested_root")

    local -a test_files=()
    mapfile -d '' -t test_files < <(collect_application_test_files "$application_root")
    echo "Application test files found: ${#test_files[@]}"

    if [[ "$action" == "cleanup" ]]; then
        local test_file
        for test_file in "${test_files[@]}"; do
            [[ "$test_file" == "$application_root/"* ]] \
                || fail "resolved cleanup target escaped application root"
            [[ -f "$test_file" && ! -L "$test_file" ]] \
                || fail "cleanup target changed or is not a regular file"
            rm -f -- "$test_file"
        done

        test_files=()
        mapfile -d '' -t test_files < <(collect_application_test_files "$application_root")
        [[ ${#test_files[@]} -eq 0 ]] || fail "application test files remain after cleanup"
        echo "Application test-file cleanup complete: 0 remaining"
        return 0
    fi

    [[ ${#test_files[@]} -eq 0 ]] || fail "application test files remain"
    echo "Application test-file verification complete: 0 found"
}

main "$@"
