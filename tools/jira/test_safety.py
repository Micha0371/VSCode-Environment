import io
import json
from pathlib import Path
import tempfile
from contextlib import redirect_stderr, redirect_stdout
import unittest
from unittest.mock import patch

import jira
from urllib import error
from test_jira import (SECRETS, FakeHTTP, IDENTITY, args, client, standard_creation_metadata,
                       setUpModule, tearDownModule)


class SafetyTests(unittest.TestCase):
    def test_abbreviated_apply_is_not_authorization(self):
        for command in (["create", "--input", "fixture.json"],
                        ["update", "PF-1", "--input", "fixture.json"],
                        ["transition", "PF-1", "--to", "Done"]):
            for flag in ("--a", "--app", "--apply=true"):
                with self.subTest(command=command[0], flag=flag), self.assertRaises(jira.Failure):
                    jira.parser().parse_args([*command, flag])
            self.assertFalse(jira.parser().parse_args(command).apply)
            self.assertTrue(jira.parser().parse_args([*command, "--apply"]).apply)

    def test_invalid_arguments_do_not_echo_secrets_or_read_credentials(self):
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(jira.sys, "argv", ["jira.py", "check", "--token", SECRETS["token"]]), \
                patch.object(jira, "credential") as read, redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(jira.main(), 1)
        read.assert_not_called()
        self.assertNotIn(SECRETS["token"], errors.getvalue())
        self.assertNotIn("Traceback", errors.getvalue())

    def test_transport_denies_mutations_without_explicit_boolean_authorization(self):
        for enabled in (False, None, 1, "true"):
            http = FakeHTTP([])
            api = jira.Jira(SECRETS, http=http, allow_writes=enabled)
            api.base = SECRETS["site"] + "/rest/api/3"
            for method, route in [("POST", "/issue"), ("PUT", "/issue/PF-1"),
                                  ("PATCH", "/issue/PF-1"),
                                  ("POST", "/issue/PF-1/transitions"), ("DELETE", "/issue/PF-1")]:
                with self.subTest(enabled=enabled, method=method), self.assertRaises(jira.Failure):
                    api.call(method, route, {})
            self.assertEqual(http.calls, [])
        http = FakeHTTP([(200, {"issues": []})])
        api = jira.Jira(SECRETS, http=http)
        api.base = SECRETS["site"] + "/rest/api/3"
        api.call("POST", "/search/jql", {})
        self.assertEqual(len(http.calls), 1, "Read-only POST search remains available")

    def test_all_command_previews_and_invalid_inputs_send_no_mutations(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "issue.local.json"
            for command in ("create", "update", "transition"):
                for invalid in (False, True):
                    payload = {"summary": "Fixture"}
                    if command == "create":
                        payload["issueTypeId"] = "10"
                    if invalid:
                        payload["project"] = "OTHER"
                    file.write_text(json.dumps(payload), encoding="utf-8")
                    responses = standard_creation_metadata() if command == "create" else [(200, IDENTITY), (200, {"transitions": [{"id": "31", "name": "Done"}]})]
                    api, http = client(responses)
                    call = args(command, key="PF-1", input=str(file), apply=False,
                                to="Unavailable" if invalid else "Done")
                    if invalid:
                        with self.assertRaises(jira.Failure):
                            jira.execute(call, api, {"project": "PF"})
                    else:
                        self.assertTrue(jira.execute(call, api, {"project": "PF"})["preview"])
                    self.assertTrue(all(c[0] == "GET" for c in http.calls))

    def test_permissions_conflicts_and_transition_races_never_retry(self):
        for status in (400, 401, 403, 404, 409, 429):
            api, http = client([(200, IDENTITY), (200, {"transitions": [{"id": "31", "name": "Done"}]}), (status, {})])
            with self.subTest(status=status), self.assertRaises(jira.Failure):
                jira.execute(args("transition", key="PF-1", to="31", apply=True), api, {"project": "PF"})
            self.assertEqual([c[0] for c in http.calls], ["GET", "GET", "POST"])

    def test_unknown_write_outcomes_are_not_reported_as_safe_to_retry(self):
        for status in (500, 502, 503):
            api, http = client([(status, {})])
            with self.subTest(status=status), self.assertRaises(jira.WriteOutcomeUnknown):
                api.call("POST", "/issue", {"fields": {}})
            self.assertEqual(len(http.calls), 1)
        api, http = client([])
        for failure in (jira.Failure("Network failed"), RuntimeError(SECRETS["token"])):
            with patch.object(http, "call", side_effect=failure) as call, self.assertRaises(jira.WriteOutcomeUnknown):
                api.call("PUT", "/issue/PF-1", {"fields": {}})
            self.assertEqual(call.call_count, 1)
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "issue.local.json"
            file.write_text('{"summary":"Fixture","issueTypeId":"10"}', encoding="utf-8")
            api, http = client(standard_creation_metadata() + [(201, {"unexpected": SECRETS["token"]})])
            with self.assertRaises(jira.WriteOutcomeUnknown):
                jira.execute(args("create", input=str(file), apply=True), api, {"project": "PF"})
            self.assertEqual(len([c for c in http.calls if c[0] == "POST"]), 1)

    def test_rate_limit_headers_are_sanitized_and_not_automatically_retried(self):
        for header, expected in [("45", 45), (SECRETS["token"], None), ("999999999", None), ("١٢", None), ("１２", None)]:
            api = jira.HTTP()
            failure = error.HTTPError(SECRETS["site"], 429, "rate limited", {"Retry-After": header},
                                      io.BytesIO(SECRETS["token"].encode()))
            with patch.object(api.opener, "open", side_effect=failure) as call:
                with self.assertRaises(jira.RateLimited) as caught:
                    api.call("POST", SECRETS["site"], "secret", {})
                self.assertEqual(caught.exception.retry_after, expected)
                self.assertNotIn(SECRETS["token"], str(caught.exception))
                self.assertEqual(call.call_count, 1)

    def test_main_failure_json_is_redacted_for_known_and_unknown_write_outcomes(self):
        for failure, expected_code in [(jira.RateLimited(45), "rate_limited"),
                                       (jira.WriteOutcomeUnknown(), "write_outcome_unknown"),
                                       (jira.Failure(SECRETS["token"]), None),
                                       (RuntimeError(SECRETS["token"]), None)]:
            output, errors = io.StringIO(), io.StringIO()
            with patch.object(jira.sys, "argv", ["jira.py", "check"]), \
                    patch.object(jira, "config", return_value={"project": "PF"}), \
                    patch.object(jira, "credential", side_effect=lambda target: SECRETS[next(k for k, v in jira.TARGETS.items() if v == target)]), \
                    patch.object(jira.Jira, "connect"), patch.object(jira, "execute", side_effect=failure), \
                    redirect_stdout(output), redirect_stderr(errors):
                self.assertEqual(jira.main(), 1)
            result = json.loads(errors.getvalue())
            self.assertEqual(result.get("code"), expected_code)
            self.assertNotIn(SECRETS["token"], errors.getvalue())
            self.assertNotIn("Traceback", errors.getvalue())
