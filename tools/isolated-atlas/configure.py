#!/usr/bin/env python3
"""Store only the isolated Atlas URI locally, without terminal echo or .env."""
import getpass
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from urllib.parse import parse_qsl, quote, unquote, urlsplit
import warnings

USERNAME = "payroll_dev_test"
DATABASE = "payroll_test_isolated"
AUTHENTICATION_DATABASE = "admin"
# Configure the confirmed hostname locally; never publish a deployment-specific cluster.
DEFAULT_ATLAS_HOSTNAME = None


ERRORS = {
    "EMPTY": ("Δεν εισαγάγατε κωδικό πρόσβασης.", "Επαναλάβετε και εισαγάγετε μόνο τον κωδικό του δοκιμαστικού λογαριασμού, χωρίς πλήρη σύνδεση."),
    "HOST": ("Δεν έχει οριστεί έγκυρο, επιβεβαιωμένο όνομα διακομιστή για το δοκιμαστικό Atlas.",
             "Περάστε μόνο το επιβεβαιωμένο hostname του Atlas με την επιλογή --atlas-host ή ορίστε το ως atlasHostname στην ασφαλή δοκιμαστική ρύθμιση runtime.json. Μην εισαγάγετε πλήρη σύνδεση."),
    "URI": ("Η σύνδεση δεν έχει έγκυρη μορφή MongoDB Atlas με ασφαλή εντοπισμό διακομιστή.",
            "Χρησιμοποιήστε mongodb+srv, διεύθυνση Atlas χωρίς θύρα και σωστή κωδικοποίηση ειδικών χαρακτήρων. Αφαιρέστε κενά, εισαγωγικά και αλλαγές γραμμής."),
    "USER": ("Ο λογαριασμός της σύνδεσης δεν είναι ο επιτρεπόμενος δοκιμαστικός λογαριασμός.",
             "Χρησιμοποιήστε αποκλειστικά payroll_dev_test."),
    "DATABASE": ("Η βάση της σύνδεσης λείπει ή δεν είναι η απομονωμένη δοκιμαστική βάση.",
                 "Ορίστε αποκλειστικά payroll_test_isolated στη διαδρομή της σύνδεσης."),
    "AUTH_SOURCE": ("Η βάση ελέγχου ταυτότητας δεν επιτρέπεται για τη δοκιμαστική σύνδεση.",
                    "Χρησιμοποιήστε αποκλειστικά admin ως βάση ελέγχου ταυτότητας."),
    "OPTIONS": ("Η σύνδεση περιέχει άγνωστη, επαναλαμβανόμενη ή μη ασφαλή παράμετρο.",
                "Επιτρέπονται μόνο authSource, retryWrites, w, appName, tls και ssl, μία φορά η καθεμία. Τα tls και ssl επιτρέπονται μόνο με τιμή true."),
    "EXISTS": ("Υπάρχει ήδη τοπικό αρχείο σύνδεσης και δεν επιτρέπεται η αντικατάστασή του.",
               "Ελέγξτε το credentials.json τοπικά χωρίς να κοινοποιήσετε το περιεχόμενό του."),
    "PERMISSIONS": ("Δεν επιτρέπεται η ασφαλής αποθήκευση στον τοπικό φάκελο ρυθμίσεων.",
                    "Ελέγξτε την ιδιοκτησία, τα δικαιώματα εγγραφής και ότι οι φάκελοι ρυθμίσεων δεν είναι συμβολικοί σύνδεσμοι. Μην χρησιμοποιήσετε sudo."),
    "TERMINAL": ("Δεν είναι διαθέσιμη ασφαλής κρυφή εισαγωγή από διαδραστικό τοπικό τερματικό.",
                 "Εκτελέστε το πρόγραμμα σε τοπικό τερματικό χωρίς ανακατεύθυνση εισόδου. Επιτρέπεται μόνο η επιλογή --atlas-host με το όνομα διακομιστή, χωρίς διαπιστευτήρια."),
    "CANCELLED": ("Η εισαγωγή της σύνδεσης διακόπηκε πριν από την αποθήκευση.",
                  "Επαναλάβετε όταν είστε έτοιμοι να εισαγάγετε τη δοκιμαστική σύνδεση."),
    "IO": ("Η αποθήκευση σταμάτησε λόγω προβλήματος στο τοπικό σύστημα αρχείων.",
           "Ελέγξτε τον διαθέσιμο χώρο και ότι ο τοπικός φάκελος ρυθμίσεων είναι προσβάσιμος."),
    "INTERNAL": ("Η αποθήκευση σταμάτησε λόγω απρόβλεπτου σφάλματος του προγράμματος.",
                 "Επαναλάβετε και, αν επιμένει, ενημερώστε την τεχνική υποστήριξη μόνο για τον κωδικό αναφοράς."),
}


class ConfigurationError(Exception):
    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)


def validate_hostname(hostname):
    if (not isinstance(hostname, str) or len(hostname) > 253
            or not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+mongodb\.net", hostname.lower())):
        raise ConfigurationError("HOST")
    return hostname.lower()


def resolve_hostname(root, supplied=None):
    directory = root / ".cache" / "isolated-atlas"
    if directory.is_symlink() or directory.parent.is_symlink():
        raise ConfigurationError("PERMISSIONS")
    if os.path.lexists(directory / "credentials.json"):
        raise ConfigurationError("EXISTS")
    if supplied is not None:
        # --atlas-host is an explicit operator-provided hostname, never a URI or secret.
        return validate_hostname(supplied)
    try:
        fd = os.open(directory / "runtime.json", os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return validate_hostname(DEFAULT_ATLAS_HOSTNAME)
    with os.fdopen(fd, "r") as stream:
        metadata = os.fstat(stream.fileno())
        if (not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid()
                or metadata.st_mode & 0o077 or metadata.st_size > 65536):
            raise ConfigurationError("PERMISSIONS")
        try:
            settings = json.load(stream)
        except (ValueError, UnicodeError):
            raise ConfigurationError("HOST") from None
    if (not isinstance(settings, dict) or settings.get("database") != DATABASE
            or settings.get("user") != USERNAME):
        raise ConfigurationError("HOST")
    return validate_hostname(settings.get("atlasHostname", DEFAULT_ATLAS_HOSTNAME))


def build_uri(password, hostname):
    hostname = validate_hostname(hostname)
    if not password:
        raise ConfigurationError("EMPTY")
    uri = (f"mongodb+srv://{quote(USERNAME, safe='')}:{quote(password, safe='')}@{hostname}/"
           f"{quote(DATABASE, safe='')}?authSource={quote(AUTHENTICATION_DATABASE, safe='')}&tls=true")
    validate_uri(uri)
    return uri


def validate_uri(uri):
    if not uri or not uri.strip():
        raise ConfigurationError("EMPTY")
    if (any(character.isspace() or ord(character) < 32 or ord(character) == 127 for character in uri)
            or re.search(r"%(?![0-9a-fA-F]{2})", uri)):
        raise ConfigurationError("URI")
    try:
        parsed = urlsplit(uri)
        hostname, port = parsed.hostname, parsed.port
        username = unquote(parsed.username or "", errors="strict")
    except (ValueError, UnicodeError):
        raise ConfigurationError("URI") from None
    if (parsed.scheme != "mongodb+srv" or not hostname
            or not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+mongodb\.net", hostname)
            or port is not None or not parsed.password or parsed.fragment
            or parsed.netloc.count("@") != 1
            or re.search(r"[$:/?\[\]@]", parsed.username or "")
            or re.search(r"[$:/?\[\]@]", parsed.password)):
        raise ConfigurationError("URI")
    if username != USERNAME:
        raise ConfigurationError("USER")
    if parsed.path != f"/{DATABASE}":
        raise ConfigurationError("DATABASE")
    try:
        # Python 3.10 raises for an empty query with strict_parsing=True.
        options = (parse_qsl(parsed.query, strict_parsing=True, keep_blank_values=True, errors="strict")
                   if parsed.query else [])
    except (ValueError, UnicodeError):
        raise ConfigurationError("OPTIONS") from None
    allowed = {"authSource", "retryWrites", "w", "appName", "tls", "ssl"}
    seen = set()
    for key, value in options:
        if key not in allowed or key in seen:
            raise ConfigurationError("OPTIONS")
        seen.add(key)
        if key == "authSource" and value != AUTHENTICATION_DATABASE:
            raise ConfigurationError("AUTH_SOURCE")
        if key in ("tls", "ssl") and value != "true":
            raise ConfigurationError("OPTIONS")


def store_credentials(uri, directory):
    validate_uri(uri)
    if directory.is_symlink() or directory.parent.is_symlink():
        raise ConfigurationError("PERMISSIONS")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.stat().st_uid != os.getuid():
        raise ConfigurationError("PERMISSIONS")
    os.chmod(directory, 0o700)
    target = directory / "credentials.json"
    # Publish a complete private file atomically; never overwrite an existing file or link.
    fd, temporary = tempfile.mkstemp(prefix=".credentials-", dir=directory)
    try:
        with os.fdopen(fd, "w") as stream:
            os.fchmod(stream.fileno(), 0o600)
            json.dump({"mongodbUrl": uri}, stream)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.link(temporary, target, follow_symlinks=False)
    finally:
        try:
            os.unlink(temporary)
        except OSError:
            # A failed cleanup must not misreport a successfully published file as unsaved.
            pass


def main(root=None, hostname=None):
    if not sys.stdin.isatty():
        raise ConfigurationError("TERMINAL")
    root = root if root is not None else Path(__file__).resolve().parents[2]
    hostname = resolve_hostname(root, hostname)
    with warnings.catch_warnings():
        # getpass must never fall back to an input method that echoes credentials.
        warnings.simplefilter("error", getpass.GetPassWarning)
        password = getpass.getpass("Μόνο ο κωδικός του payroll_dev_test (κρυφή εισαγωγή): ")
    uri = build_uri(password, hostname)
    store_credentials(uri, root / ".cache" / "isolated-atlas")
    print("Αποθηκεύτηκε μόνο η τοπική δοκιμαστική ρύθμιση με δικαιώματα 0600. Η εφαρμογή δεν εκκινήθηκε.")


def run(root=None):
    try:
        arguments = sys.argv[1:]
        if arguments and (len(arguments) != 2 or arguments[0] != "--atlas-host"):
            raise ConfigurationError("TERMINAL")
        main(root, hostname=arguments[1] if arguments else None)
        return 0
    except ConfigurationError as error:
        reason = error.reason
    except FileExistsError:
        reason = "EXISTS"
    except PermissionError:
        reason = "PERMISSIONS"
    except getpass.GetPassWarning:
        reason = "TERMINAL"
    except (KeyboardInterrupt, EOFError):
        reason = "CANCELLED"
    except OSError:
        reason = "IO"
    except Exception:
        reason = "INTERNAL"
    # Only fixed messages are rendered: exceptions and supplied values may contain secrets.
    explanation, action = ERRORS[reason]
    print(f"Ζητήσατε αποθήκευση της δοκιμαστικής σύνδεσης. {explanation} "
          "Η ενέργεια σταμάτησε. Δεν αποθηκεύτηκε νέα σύνδεση και δεν αντικαταστάθηκε υπάρχον αρχείο.\n"
          f"1. {action}\n2. Επαναλάβετε χωρίς να κοινοποιήσετε τη σύνδεση ή τον κωδικό πρόσβασης.\n"
          f"Κωδικός αναφοράς: ATLAS-ISOLATED-CONFIG-{reason}.", file=sys.stderr)
    return 1


def self_test():
    """Offline tests kept in this file to keep the requested single-file scope."""
    import contextlib
    import io
    import unittest
    from unittest.mock import patch

    class ConfigurationTests(unittest.TestCase):
        password = "FAKE_SECRET_MARKER"
        hostname = "fake.mongodb.net"
        uri = "mongodb+srv://payroll_dev_test:FAKE_SECRET_MARKER@fake.mongodb.net/payroll_test_isolated"

        def invoke(self, root, password=None, failure=None, hostname="fake.mongodb.net"):
            output, errors = io.StringIO(), io.StringIO()
            arguments = ["configure.py"] + (["--atlas-host", hostname] if hostname is not None else [])
            with patch.object(sys, "argv", arguments), patch.object(sys.stdin, "isatty", return_value=True), \
                    patch.object(getpass, "getpass", return_value=password, side_effect=failure), \
                    contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                result = run(root)
            text = output.getvalue() + errors.getvalue()
            self.assertNotIn("FAKE_SECRET_MARKER", text)
            self.assertNotIn("mongodb+srv://", text)
            self.assertNotIn("fake.mongodb.net", text)
            return result, text

        def test_validation_errors_are_distinct_and_never_echo_input(self):
            cases = [
                ("", "EMPTY"), ("  ", "EMPTY"), ("invalid", "URI"),
                (self.uri.replace("fake.mongodb.net", "localhost"), "URI"),
                (self.uri.replace("fake.mongodb.net", "fake.mongodb.net:bad"), "URI"),
                (self.uri.replace("fake.mongodb.net", "[invalid"), "URI"),
                (self.uri.replace(":FAKE_SECRET_MARKER", ":"), "URI"),
                (self.uri.replace("FAKE_SECRET_MARKER", "bad%ZZ"), "URI"),
                (self.uri + "\n", "URI"),
                (self.uri.replace("payroll_dev_test", "payroll_app_prod"), "USER"),
                (self.uri.replace("payroll_dev_test", "payroll_migration_user"), "USER"),
                (self.uri.replace("/payroll_test_isolated", "/payrollDB"), "DATABASE"),
                (self.uri.replace("/payroll_test_isolated", "/"), "DATABASE"),
                (self.uri + "?authSource=payrollDB", "AUTH_SOURCE"),
                (self.uri + "?authSource=", "AUTH_SOURCE"),
                (self.uri + "?unknown=FAKE_SECRET_MARKER", "OPTIONS"),
                (self.uri + "?tls=false", "OPTIONS"),
                (self.uri + "?ssl=TRUE", "OPTIONS"),
                (self.uri + "?authSource=admin&authSource=admin", "OPTIONS"),
                (self.uri + "?retryWrites", "OPTIONS"),
            ]
            for uri, reason in cases:
                with self.subTest(reason=reason), self.assertRaises(ConfigurationError) as caught:
                    validate_uri(uri)
                self.assertEqual(caught.exception.reason, reason)

        def test_valid_input_is_private_and_existing_file_is_unchanged(self):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                uri = build_uri(self.password, self.hostname)
                result, _ = self.invoke(root, self.password)
                self.assertEqual(result, 0)
                target = root / ".cache/isolated-atlas/credentials.json"
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                self.assertEqual(target.parent.stat().st_mode & 0o777, 0o700)
                original = target.read_bytes()
                self.assertEqual(json.loads(original)["mongodbUrl"], uri)
                result, text = self.invoke(root, self.password)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-EXISTS.", text)
                self.assertEqual(target.read_bytes(), original)
                self.assertEqual(list(target.parent.iterdir()), [target])

        def test_allowed_authentication_sources_and_encoded_password(self):
            for suffix in ("", "?authSource=admin"):
                validate_uri(self.uri.replace("FAKE_SECRET_MARKER", "fake%40password%3Avalue") + suffix)
            with self.assertRaises(ConfigurationError) as caught:
                validate_uri(self.uri + "?authSource=payroll_test_isolated")
            self.assertEqual(caught.exception.reason, "AUTH_SOURCE")

        def test_password_is_encoded_once_without_trimming_and_target_is_fixed(self):
            for password in ("fake@:/?#[]$%&+=", " fake secret ", "ψεύτικο-μυστικό", "fake%40literal"):
                uri = build_uri(password, self.hostname)
                parsed = urlsplit(uri)
                self.assertEqual(unquote(parsed.password), password)
                self.assertEqual(parsed.username, USERNAME)
                self.assertEqual(parsed.hostname, self.hostname)
                self.assertEqual(parsed.path, "/payroll_test_isolated")
                self.assertEqual(dict(parse_qsl(parsed.query))["authSource"], "admin")

        def test_empty_password_is_not_saved(self):
            with tempfile.TemporaryDirectory() as temporary:
                result, text = self.invoke(Path(temporary), "")
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-EMPTY.", text)
                self.assertFalse((Path(temporary) / ".cache").exists())

        def test_host_can_only_be_an_atlas_hostname_without_credentials_or_path(self):
            for hostname in ("", "localhost", "fake.mongodb.net:27017", "fake.mongodb.net/payrollDB",
                             "FAKE_SECRET_MARKER@fake.mongodb.net", self.uri, "fake.mongodb.net.evil.test"):
                with tempfile.TemporaryDirectory() as temporary:
                    result, text = self.invoke(Path(temporary), self.password, hostname=hostname)
                    self.assertEqual(result, 1)
                    self.assertIn("CONFIG-HOST.", text)
            self.assertEqual(validate_hostname("FAKE.mongodb.net"), self.hostname)

        def test_missing_default_host_does_not_request_password(self):
            with tempfile.TemporaryDirectory() as temporary, patch.object(getpass, "getpass") as prompt, \
                    patch.object(sys.stdin, "isatty", return_value=True), \
                    patch.object(sys.modules[__name__], "DEFAULT_ATLAS_HOSTNAME", None):
                with self.assertRaises(ConfigurationError) as caught:
                    main(Path(temporary))
                self.assertEqual(caught.exception.reason, "HOST")
                prompt.assert_not_called()

        def test_confirmed_default_works_without_hostname_argument_or_runtime_key(self):
            with tempfile.TemporaryDirectory() as temporary, \
                    patch.object(sys.modules[__name__], "DEFAULT_ATLAS_HOSTNAME", self.hostname):
                root = Path(temporary)
                self.assertEqual(resolve_hostname(root), self.hostname)
                directory = root / ".cache/isolated-atlas"
                directory.mkdir(parents=True, mode=0o700)
                runtime = directory / "runtime.json"
                runtime.write_text(json.dumps({"database": DATABASE, "user": USERNAME}))
                runtime.chmod(0o600)
                self.assertEqual(resolve_hostname(root), self.hostname)
                result, _ = self.invoke(root, self.password, hostname=None)
                self.assertEqual(result, 0)
                saved = json.loads((directory / "credentials.json").read_text())
                self.assertEqual(urlsplit(saved["mongodbUrl"]).hostname, self.hostname)

        def test_safe_runtime_hostname_is_used_and_unsafe_settings_are_rejected(self):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                directory = root / ".cache/isolated-atlas"
                directory.mkdir(parents=True, mode=0o700)
                runtime = directory / "runtime.json"
                settings = {"database": DATABASE, "user": USERNAME, "atlasHostname": self.hostname}
                runtime.write_text(json.dumps(settings))
                runtime.chmod(0o600)
                self.assertEqual(resolve_hostname(root), self.hostname)
                runtime.chmod(0o644)
                with self.assertRaises(ConfigurationError) as caught:
                    resolve_hostname(root)
                self.assertEqual(caught.exception.reason, "PERMISSIONS")
                runtime.chmod(0o600)
                settings["database"] = "payrollDB"
                runtime.write_text(json.dumps(settings))
                with self.assertRaises(ConfigurationError) as caught:
                    resolve_hostname(root)
                self.assertEqual(caught.exception.reason, "HOST")
                settings["database"] = DATABASE
                runtime.write_text(json.dumps(settings))
                result, _ = self.invoke(root, self.password, hostname=None)
                self.assertEqual(result, 0)

        def test_permission_failure_does_not_echo_exception(self):
            with tempfile.TemporaryDirectory() as temporary, \
                    patch.object(os, "chmod", side_effect=PermissionError("FAKE_SECRET_MARKER")):
                result, text = self.invoke(Path(temporary), self.password)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-PERMISSIONS.", text)

        def test_failed_write_publishes_no_credentials_file(self):
            with tempfile.TemporaryDirectory() as temporary, \
                    patch.object(json, "dump", side_effect=OSError("FAKE_SECRET_MARKER")):
                root = Path(temporary)
                result, text = self.invoke(root, self.password)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-IO.", text)
                self.assertEqual(list((root / ".cache/isolated-atlas").iterdir()), [])

        def test_symbolic_link_directory_is_rejected(self):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                destination = root / "destination"
                destination.mkdir()
                (root / ".cache").symlink_to(destination, target_is_directory=True)
                result, text = self.invoke(root, self.password)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-PERMISSIONS.", text)
                self.assertEqual(list(destination.iterdir()), [])

        def test_existing_symbolic_link_file_is_never_followed(self):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                directory = root / ".cache/isolated-atlas"
                directory.mkdir(parents=True)
                original = root / "synthetic-original"
                original.write_text("FAKE_SECRET_MARKER")
                target = directory / "credentials.json"
                target.symlink_to(original)
                result, text = self.invoke(root, self.password)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-EXISTS.", text)
                self.assertTrue(target.is_symlink())
                self.assertEqual(original.read_text(), "FAKE_SECRET_MARKER")

        def test_noninteractive_input_is_rejected_before_reading(self):
            errors = io.StringIO()
            with tempfile.TemporaryDirectory() as temporary, \
                    patch.object(sys, "argv", ["configure.py"]), \
                    patch.object(sys.stdin, "isatty", return_value=False), \
                    patch.object(getpass, "getpass") as prompt, contextlib.redirect_stderr(errors):
                self.assertEqual(run(Path(temporary)), 1)
                prompt.assert_not_called()
                self.assertEqual(list(Path(temporary).iterdir()), [])
            self.assertIn("CONFIG-TERMINAL.", errors.getvalue())

        def test_hidden_input_cannot_fall_back_to_visible_input(self):
            def no_echo_available(_prompt):
                warnings.warn("FAKE_SECRET_MARKER", getpass.GetPassWarning)
            with tempfile.TemporaryDirectory() as temporary:
                result, text = self.invoke(Path(temporary), failure=no_echo_available)
                self.assertEqual(result, 1)
                self.assertIn("CONFIG-TERMINAL.", text)

        def test_cancelled_and_unexpected_errors_are_redacted(self):
            for failure, reason in ((KeyboardInterrupt(), "CANCELLED"),
                                    (EOFError("FAKE_SECRET_MARKER"), "CANCELLED"),
                                    (RuntimeError("FAKE_SECRET_MARKER"), "INTERNAL")):
                with tempfile.TemporaryDirectory() as temporary:
                    result, text = self.invoke(Path(temporary), failure=failure)
                    self.assertEqual(result, 1)
                    self.assertIn(f"CONFIG-{reason}.", text)

    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ConfigurationTests))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(self_test() if sys.argv[1:] == ["--self-test"] else run())
