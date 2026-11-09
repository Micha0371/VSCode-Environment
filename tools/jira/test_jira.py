import argparse
import base64
from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib import error, request

import jira

SECRETS = {"site": "https://pantry-test.atlassian.net", "email": "fixture@example.test",
           "token": "fixture-secret-with-special+characters"}
CLOUD = "11111111-2222-3333-4444-555555555555"


class FakeHTTP:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def call(self, *args):
        self.calls.append(args)
        return self.responses.pop(0)


def client(responses):
    transport = FakeHTTP(responses)
    api = jira.Jira(SECRETS, http=transport, allow_writes=True)
    api.base = "https://pantry-test.atlassian.net/rest/api/3"
    return api, transport


def args(command, **kwargs):
    return argparse.Namespace(command=command, **kwargs)


IDENTITY = {"key": "PF-1", "fields": {"project": {"key": "PF"}}}


class IntegrationTests(unittest.TestCase):
    def test_credentials_refuse_unapproved_target_before_access(self):
        with self.assertRaises(jira.Failure):
            jira.credential("OTHER/SECRET")

    def test_sites_reject_credential_exfiltration_and_insecure_urls(self):
        for url in ["http://x.atlassian.net", "https://x.atlassian.net.evil.test",
                    "https://user@x.atlassian.net", "https://x.atlassian.net:444",
                    "https://x.atlassian.net/path", "https://x.atlassian.net?next=evil",
                    "https://api.atlassian.com", "https://x.atlassian.net\n"]:
            with self.subTest(url=url), self.assertRaises(jira.Failure):
                jira.Jira({**SECRETS, "site": url})
        self.assertEqual(jira.site_url(SECRETS["site"] + "/"), SECRETS["site"])

    def test_redirects_never_forward_authentication(self):
        self.assertIsNone(jira.NoRedirect().redirect_request(
            request.Request(SECRETS["site"], headers={"Authorization": "secret"}),
            None, 302, "Found", {}, "https://evil.test"))

    def test_scoped_auth_keeps_discovery_unauthenticated(self):
        http = FakeHTTP([(200, {"cloudId": CLOUD}), (200, {"emailAddress": SECRETS["email"]})])
        api = jira.Jira(SECRETS, http=http)
        api.connect()
        self.assertEqual(api.mode, "scoped")
        self.assertEqual(len(http.calls[0]), 2)
        self.assertTrue(http.calls[1][1].startswith("https://api.atlassian.com/ex/jira/" + CLOUD))

    def test_auto_fallback_is_only_to_the_verified_site(self):
        http = FakeHTTP([(200, {"cloudId": CLOUD}), (401, {}), (200, {})])
        api = jira.Jira(SECRETS, http=http)
        api.connect()
        self.assertEqual(api.mode, "classic")
        self.assertEqual(http.calls[-1][1], SECRETS["site"] + "/rest/api/3/myself")
        for mode, status in [("scoped", 401), ("auto", 429), ("auto", 500)]:
            http = FakeHTTP([(200, {"cloudId": CLOUD}), (status, {})])
            with self.assertRaises(jira.Failure):
                jira.Jira(SECRETS, mode=mode, http=http).connect()
            self.assertEqual(len(http.calls), 2)

    def test_malformed_tenant_never_receives_credentials(self):
        http = FakeHTTP([(200, {"cloudId": "../../evil"})])
        with self.assertRaises(jira.Failure):
            jira.Jira(SECRETS, http=http).connect()
        self.assertEqual(len(http.calls), 1)

    def test_response_and_error_redaction(self):
        api, _ = client([])
        value = api.safe({"description": SECRETS["token"], "auth": api.auth,
                          "encoded": base64.b64encode((SECRETS["email"] + ":" + SECRETS["token"]).encode()).decode(),
                          "email": SECRETS["email"], "normal": "PF-1"})
        self.assertNotIn(SECRETS["token"], value)
        self.assertNotIn(SECRETS["email"], value)
        self.assertEqual(json.loads(value)["normal"], "PF-1")

    def test_http_errors_discard_sensitive_bodies(self):
        api = jira.HTTP()
        failure = error.HTTPError(SECRETS["site"], 401, SECRETS["token"], {}, io.BytesIO(SECRETS["token"].encode()))
        with patch.object(api.opener, "open", side_effect=failure):
            self.assertEqual(api.call("GET", SECRETS["site"], "secret"), (401, {}))

    def test_check_returns_only_selected_project_metadata(self):
        api, http = client([(200, {"key": "PF", "name": "PantryFlow", "secret": "hidden",
                                          "issueTypes": [{"id": "10", "name": "Task"}]})])
        result = jira.execute(args("check"), api, {"project": "PF"})
        self.assertEqual(result["name"], "PantryFlow")
        self.assertNotIn("secret", result)
        self.assertEqual(http.calls[0][1], api.base + "/project/PF")

    def test_list_is_project_scoped_and_injection_safe_with_pagination(self):
        api, http = client([(200, {"issues": [{"key": "PF-1", "fields": {"summary": "A"}}],
                                          "nextPageToken": "next", "isLast": False})])
        result = jira.execute(args("list", status='To Do" OR project = "OTHER', limit=5, page="page"), api, {"project": "PF"})
        body = http.calls[0][3]
        self.assertEqual(body["jql"], r'project = "PF" AND status = "To Do\" OR project = \"OTHER" ORDER BY updated DESC')
        self.assertEqual(body["nextPageToken"], "page")
        self.assertEqual(result["nextPage"], "next")
        api, _ = client([(200, {"issues": [{"key": "OTHER-1"}]})])
        with self.assertRaises(jira.Failure):
            jira.execute(args("list", status=None, limit=5, page=None), api, {"project": "PF"})

    def test_cross_project_and_moved_issue_cannot_be_updated(self):
        api, http = client([])
        with self.assertRaises(jira.Failure):
            jira.execute(args("update", key="OTHER-1", input="unused", apply=True), api, {"project": "PF"})
        self.assertEqual(http.calls, [])
        api, http = client([(200, {"key": "OTHER-1", "fields": {"project": {"key": "OTHER"}}})])
        with self.assertRaises(jira.Failure):
            jira.execute(args("update", key="PF-1", input="unused", apply=True), api, {"project": "PF"})
        self.assertEqual([c[0] for c in http.calls], ["GET"])

    def test_create_update_preview_and_apply_exact_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "issue.json"
            file.write_text(json.dumps({"summary": " Task ", "description": "First\nSecond",
                                        "issueTypeId": "10", "labels": ["pantryflow"]}), encoding="utf-8")
            api, http = client([])
            result = jira.execute(args("create", input=str(file), apply=False), api, {"project": "PF"})
            self.assertTrue(result["preview"])
            self.assertEqual(http.calls, [])
            self.assertEqual(result["fields"]["project"], {"key": "PF"})
            self.assertEqual(result["fields"]["description"]["type"], "doc")
            api, http = client([(201, {"key": "PF-2"})])
            self.assertEqual(jira.execute(args("create", input=str(file), apply=True), api, {"project": "PF"})["created"], "PF-2")
            self.assertEqual(http.calls[0][0], "POST")
            file.write_text('{"summary":"Changed"}', encoding="utf-8")
            api, http = client([(200, IDENTITY), (204, {})])
            self.assertEqual(jira.execute(args("update", key="PF-1", input=str(file), apply=True), api, {"project": "PF"})["updated"], "PF-1")
            self.assertEqual(http.calls[-1][3], {"fields": {"summary": "Changed"}})
            file.write_text('{"project":"OTHER","summary":"Blocked"}', encoding="utf-8")
            with self.assertRaises(jira.Failure):
                jira.input_fields(file)

    def test_transitions_require_an_available_unambiguous_transition(self):
        transitions = {"transitions": [{"id": "31", "name": "Done"}]}
        api, http = client([(200, IDENTITY), (200, transitions)])
        result = jira.execute(args("transition", key="PF-1", to="Done", apply=False), api, {"project": "PF"})
        self.assertTrue(result["preview"])
        self.assertEqual([c[0] for c in http.calls], ["GET", "GET"])
        api, http = client([(200, IDENTITY), (200, transitions), (204, {})])
        jira.execute(args("transition", key="PF-1", to="31", apply=True), api, {"project": "PF"})
        self.assertEqual(http.calls[-1][3], {"transition": {"id": "31"}})
        api, http = client([(200, IDENTITY), (200, transitions)])
        with self.assertRaises(jira.Failure):
            jira.execute(args("transition", key="PF-1", to="unavailable", apply=True), api, {"project": "PF"})

    def test_main_never_prints_tracebacks_or_unexpected_secret_exceptions(self):
        out, err = io.StringIO(), io.StringIO()
        with patch.object(jira.sys, "argv", ["jira.py", "check"]), patch.object(jira, "credential", side_effect=RuntimeError(SECRETS["token"])), redirect_stdout(out), redirect_stderr(err):
            self.assertEqual(jira.main(), 1)
        self.assertNotIn(SECRETS["token"], err.getvalue())
        self.assertNotIn("Traceback", err.getvalue())
        self.assertEqual(out.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
