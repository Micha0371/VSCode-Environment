from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import jira
from test_jira import SECRETS, FakeHTTP, IDENTITY, args, client


def write(directory, value, name="comment.json"):
    file = Path(directory) / name
    file.write_text(value if isinstance(value, str) else json.dumps(value), encoding="utf-8")
    return str(file)


class CommentTests(unittest.TestCase):
    def test_comment_preview_sends_no_mutation_and_shows_exact_body(self):
        with tempfile.TemporaryDirectory() as directory:
            file = write(directory, {"body": "Progress (2026-11-12):\n\n- Step 3a merged – PR #29"})
            api, http = client([(200, IDENTITY)])
            result = jira.execute(args("comment", key="PF-1", input=file, apply=False), api, {"project": "PF"})
        self.assertEqual(result["preview"], True)
        self.assertEqual(result["operation"], "comment")
        self.assertEqual(result["key"], "PF-1")
        paragraphs = result["body"]["content"]
        self.assertEqual(result["body"]["type"], "doc")
        self.assertEqual([p["content"][0]["text"] if p["content"] else "" for p in paragraphs],
                         ["Progress (2026-11-12):", "", "- Step 3a merged – PR #29"])
        self.assertEqual([c[0] for c in http.calls], ["GET"])

    def test_comment_apply_posts_once_to_the_verified_issue(self):
        with tempfile.TemporaryDirectory() as directory:
            file = write(directory, {"body": "Done"})
            api, http = client([(200, IDENTITY), (201, {"id": "10042"})])
            result = jira.execute(args("comment", key="PF-1", input=file, apply=True), api, {"project": "PF"})
        self.assertEqual(result, {"commented": "PF-1", "commentId": "10042",
                                  "url": SECRETS["site"] + "/browse/PF-1?focusedCommentId=10042"})
        method, url, _auth, body = http.calls[-1]
        self.assertEqual((method, url), ("POST", api.base + "/issue/PF-1/comment"))
        self.assertEqual(body, {"body": {"type": "doc", "version": 1, "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Done"}]}]}})
        self.assertEqual(len([c for c in http.calls if c[0] == "POST"]), 1)

    def test_comment_without_a_confirmed_id_is_an_unknown_write_outcome(self):
        with tempfile.TemporaryDirectory() as directory:
            file = write(directory, {"body": "Done"})
            for response in ({}, {"id": "../x"}, {"id": 5}, {"id": SECRETS["token"]}):
                api, http = client([(200, IDENTITY), (201, response)])
                with self.subTest(response=response), self.assertRaises(jira.WriteOutcomeUnknown):
                    jira.execute(args("comment", key="PF-1", input=file, apply=True), api, {"project": "PF"})
                self.assertEqual(len([c for c in http.calls if c[0] == "POST"]), 1)

    def test_comment_rejects_other_projects_moved_issues_and_invalid_input(self):
        with tempfile.TemporaryDirectory() as directory:
            file = write(directory, {"body": "Done"})
            api, http = client([])
            with self.assertRaises(jira.Failure):
                jira.execute(args("comment", key="OTHER-1", input=file, apply=True), api, {"project": "PF"})
            self.assertEqual(http.calls, [])
            api, http = client([(200, {"key": "OTHER-1", "fields": {"project": {"key": "OTHER"}}})])
            with self.assertRaises(jira.Failure):
                jira.execute(args("comment", key="PF-1", input=file, apply=True), api, {"project": "PF"})
            self.assertEqual([c[0] for c in http.calls], ["GET"])
            for invalid in ({}, {"body": ""}, {"body": "   \n "}, {"body": 5}, {"body": "x" * 30001},
                            {"body": "ok", "visibility": {"type": "role", "value": "Administrators"}}, ["ok"]):
                with self.subTest(invalid=invalid), self.assertRaises(jira.Failure):
                    jira.comment_input(write(directory, invalid))

    def test_comment_requires_explicit_apply_at_the_transport_layer(self):
        for enabled in (False, None, 1, "true"):
            http = FakeHTTP([])
            api = jira.Jira(SECRETS, http=http, allow_writes=enabled)
            api.base = SECRETS["site"] + "/rest/api/3"
            with self.subTest(enabled=enabled), self.assertRaises(jira.Failure):
                api.call("POST", "/issue/PF-1/comment", {"body": {}})
            self.assertEqual(http.calls, [])
        for flag in ("--a", "--app", "--apply=true"):
            with self.subTest(flag=flag), self.assertRaises(jira.Failure):
                jira.parser().parse_args(["comment", "PF-1", "--input", "c.json", flag])
        self.assertFalse(jira.parser().parse_args(["comment", "PF-1", "--input", "c.json"]).apply)

    def test_comments_lists_recent_bodies_as_text_without_author_details(self):
        page = {"total": 2, "comments": [
            {"id": "11", "created": "2026-11-12T01:00:00.000+0100", "author": {"emailAddress": SECRETS["email"]},
             "body": {"type": "doc", "version": 1, "content": [
                 {"type": "paragraph", "content": [{"type": "text", "text": "Line one"}]},
                 {"type": "paragraph", "content": []},
                 {"type": "paragraph", "content": [{"type": "text", "text": "Line "}, {"type": "text", "text": "two"}]}]}},
            {"id": "10", "created": "2026-11-11T01:00:00.000+0100", "body": None}]}
        api, http = client([(200, IDENTITY), (200, page)])
        result = jira.execute(args("comments", key="PF-1", limit=5), api, {"project": "PF"})
        self.assertEqual(http.calls[-1][1], api.base + "/issue/PF-1/comment?orderBy=-created&maxResults=5")
        self.assertEqual(result, {"key": "PF-1", "total": 2, "comments": [
            {"id": "11", "created": "2026-11-12T01:00:00.000+0100", "body": "Line one\n\nLine two"},
            {"id": "10", "created": "2026-11-11T01:00:00.000+0100", "body": ""}]})
        self.assertNotIn(SECRETS["email"], json.dumps(result))
        self.assertTrue(all(c[0] == "GET" for c in http.calls))


class InputAndOutputTests(unittest.TestCase):
    def test_input_file_problems_have_distinct_fixed_messages(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = str(Path(directory) / "missing.json")
            large = write(directory, {"summary": "x" * 100_001}, "large.json")
            for loader in (jira.input_fields, jira.comment_input):
                with self.subTest(loader=loader.__name__):
                    with self.assertRaisesRegex(jira.Failure, "^Input file not found or not readable$"):
                        loader(missing)
                    with self.assertRaisesRegex(jira.Failure, "^Input file exceeds 100 KB$"):
                        loader(large)
                    with self.assertRaisesRegex(jira.Failure, "^Input must be a UTF-8 JSON object$"):
                        loader(write(directory, "{not json", "broken.json"))
                    Path(directory, "latin.json").write_bytes(b'{"summary": "caf\xe9"}')
                    with self.assertRaisesRegex(jira.Failure, "^Input must be a UTF-8 JSON object$"):
                        loader(str(Path(directory, "latin.json")))

    def test_output_is_ascii_json_that_round_trips_and_stays_redacted(self):
        result = {"summary": "Migrations 00001–00003 · Grüße", "secret": SECRETS["token"] + "é"}
        output, errors = io.StringIO(), io.StringIO()
        secrets = {**SECRETS, "token": SECRETS["token"] + "é"}
        with patch.object(jira.sys, "argv", ["jira.py", "check"]), \
                patch.object(jira, "config", return_value={"project": "PF"}), \
                patch.object(jira, "credential", side_effect=lambda target: secrets[next(k for k, v in jira.TARGETS.items() if v == target)]), \
                patch.object(jira.Jira, "connect"), patch.object(jira, "execute", return_value=result), \
                redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(jira.main(), 0)
        text = output.getvalue()
        self.assertTrue(text.isascii(), "output must survive any console code page")
        decoded = json.loads(text)
        self.assertEqual(decoded["summary"], "Migrations 00001–00003 · Grüße")
        self.assertEqual(decoded["secret"], "[REDACTED]")
        self.assertNotIn(SECRETS["token"], text)


if __name__ == "__main__":
    unittest.main()
