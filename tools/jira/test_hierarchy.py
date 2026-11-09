import json
from pathlib import Path
import tempfile
import unittest

import jira
from test_jira import args, client


TYPES = [{"id": "10", "name": "Epic"}, {"id": "20", "name": "Task"},
         {"id": "30", "name": "Subtask", "subtask": True}]


def metadata(type_id="20", level=0, priority=True):
    fields = [{"fieldId": "parent", "name": "Parent", "required": level == -1}]
    if priority:
        fields.append({"fieldId": "priority", "name": "Priority",
                       "allowedValues": [{"id": "2", "name": "High"}, {"id": "3", "name": "Medium"}]})
    return [(200, {"issueTypes": TYPES, "total": 3}),
            (200, {"id": type_id, "name": "Fixture type", "hierarchyLevel": level}),
            (200, {"fields": fields, "total": len(fields)})]


def parent(type_id="10", level=1, key="PF-1", project="PF"):
    return [(200, {"key": key, "fields": {"project": {"key": project}, "issuetype": {"id": type_id}}}),
            (200, {"id": type_id, "hierarchyLevel": level})]


class HierarchyTests(unittest.TestCase):
    def test_identifier_validation_still_rejects_non_ascii_digits(self):
        for value in ("١٢", "１２", "1٢", "1２"):
            with self.subTest(value=value), self.assertRaises(jira.Failure):
                jira.numeric_id(value)
        self.assertEqual(jira.numeric_id("123"), "123")
        with tempfile.TemporaryDirectory() as directory:
            for invalid in ({"issueTypeId": "١٠"}, {"issueTypeId": "１０"},
                            {"parentKey": "PF-1٢"}, {"parentKey": "PF-1２"}):
                file = self.write_input(directory, **invalid)
                with self.subTest(invalid=invalid), self.assertRaises(jira.Failure):
                    jira.input_fields(file, create=True)

    def test_subtask_without_parent_or_priority_fails_before_preview_or_write(self):
        with tempfile.TemporaryDirectory() as directory:
            file = self.write_input(directory, issueTypeId="30")
            for apply in (False, True):
                api, http = client(metadata("30", -1, priority=False))
                with self.subTest(apply=apply), self.assertRaisesRegex(jira.Failure, "requires a parent"):
                    jira.execute(args("create", input=file, apply=apply), api, {"project": "PF"})
                self.assertTrue(all(c[0] == "GET" for c in http.calls))

    def test_unparented_task_still_previews_and_creates_without_new_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            file = self.write_input(directory)
            for apply in (False, True):
                responses = metadata() + ([(201, {"key": "PF-2"})] if apply else [])
                api, http = client(responses)
                result = jira.execute(args("create", input=file, apply=apply), api, {"project": "PF"})
                self.assertEqual(len([c for c in http.calls if c[0] == "POST"]), int(apply))
                self.assertEqual(result.get("created") if apply else result["preview"], "PF-2" if apply else True)

    def test_missing_creation_metadata_permission_stops_before_write(self):
        with tempfile.TemporaryDirectory() as directory:
            file = self.write_input(directory)
            api, http = client([(403, {})])
            with self.assertRaisesRegex(jira.Failure, "Access denied"):
                jira.execute(args("create", input=file, apply=True), api, {"project": "PF"})
            self.assertTrue(all(c[0] == "GET" for c in http.calls))

    def write_input(self, directory, **extras):
        path = Path(directory) / "issue.json"
        path.write_text(json.dumps({"summary": "Fixture", "issueTypeId": "20", **extras}), encoding="utf-8")
        return str(path)

    def test_fields_are_create_only_and_reject_malformed_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            file = self.write_input(directory, parentKey="PF-1", priorityId="2")
            fields = jira.input_fields(file, create=True)
            self.assertEqual(fields["parent"], {"key": "PF-1"})
            self.assertEqual(fields["priority"], {"id": "2"})
            with self.assertRaises(jira.Failure):
                jira.input_fields(file, create=False)
            for invalid in [{"parentKey": "PF-1/../../OTHER-1"}, {"priorityId": 2},
                            {"priorityId": "2?other=1"}, {"parent": {"key": "PF-1"}}]:
                with self.subTest(invalid=invalid), self.assertRaises(jira.Failure):
                    jira.input_fields(self.write_input(directory, **invalid), create=True)

    def test_metadata_is_read_only_and_selects_safe_fields(self):
        responses = metadata()
        responses[-1][1]["fields"][1]["allowedValues"][0]["secret"] = "never-output"
        api, http = client(responses)
        result = jira.execute(args("metadata", issue_type="20"), api, {"project": "PF"})
        self.assertEqual(result["selectedType"]["hierarchyLevel"], 0)
        self.assertNotIn("never-output", json.dumps(result))
        self.assertTrue(all(c[0] == "GET" for c in http.calls))
        api, _ = client([(200, {"issueTypes": TYPES, "total": 3})])
        with self.assertRaises(jira.Failure):
            jira.creation_metadata(api, "PF", "99")

    def test_metadata_paginates_and_fails_on_incomplete_pages(self):
        api, http = client([(200, {"issueTypes": TYPES[:1], "total": 3}),
                            (200, {"issueTypes": TYPES[1:], "total": 3})])
        self.assertEqual(len(jira.creation_metadata(api, "PF")["issueTypes"]), 3)
        self.assertIn("startAt=1", http.calls[-1][1])
        api, _ = client([(200, {"issueTypes": [], "total": 3})])
        with self.assertRaises(jira.Failure):
            jira.creation_metadata(api, "PF")

    def test_epic_task_and_subtask_payloads_and_previews(self):
        with tempfile.TemporaryDirectory() as directory:
            for type_id, level, parent_key, parent_type, parent_level, priority in [
                    ("10", 1, None, None, None, "2"),
                    ("20", 0, "PF-1", "10", 1, "2"),
                    ("30", -1, "PF-1", "20", 0, None)]:
                extras = {"issueTypeId": type_id}
                if parent_key:
                    extras["parentKey"] = parent_key
                if priority:
                    extras["priorityId"] = priority
                file = self.write_input(directory, **extras)
                for apply in (False, True):
                    responses = metadata(type_id, level, priority=priority is not None)
                    if parent_key:
                        responses += parent(parent_type, parent_level)
                    if apply:
                        responses += [(201, {"key": "PF-2"})]
                    api, http = client(responses)
                    result = jira.execute(args("create", input=file, apply=apply), api, {"project": "PF"})
                    writes = [c for c in http.calls if c[0] != "GET"]
                    self.assertEqual(len(writes), int(apply))
                    fields = writes[0][3]["fields"] if apply else result["fields"]
                    self.assertEqual(fields.get("parent"), {"key": parent_key} if parent_key else None)
                    self.assertEqual(fields.get("priority"), {"id": priority} if priority else None)

    def test_invalid_priority_and_parent_hierarchies_never_write(self):
        cases = [
            ({"parent": {"key": "OTHER-1"}}, metadata(), None),
            ({"parent": {"key": "PF-1"}}, metadata(), parent("20", 0)),
            ({"parent": {"key": "PF-1"}}, metadata(), parent("30", -1)),
            ({"parent": {"key": "PF-1"}}, metadata(), parent(project="OTHER")),
            ({"parent": {"key": "PF-1"}}, metadata(), parent(key="PF-9")),
            ({"priority": {"id": "99"}}, metadata(), None),
            ({"priority": {"id": "2"}}, metadata(priority=False), None),
            ({"priority": {"id": "2"}, "issuetype": {"id": "30"}}, metadata("30", -1), None),
        ]
        for extras, responses, parents in cases:
            api, http = client(responses + (parents or []))
            fields = {"issuetype": {"id": "20"}, **extras}
            with self.subTest(fields=fields), self.assertRaises(jira.Failure):
                jira.validate_creation_relationships(api, "PF", fields)
            self.assertTrue(all(c[0] == "GET" for c in http.calls))

    def test_readback_selects_parent_and_priority_without_raw_user_fields(self):
        view = jira.issue_view({"key": "PF-2", "fields": {"parent": {"key": "PF-1", "secret": "hidden"},
                               "priority": {"id": "2", "name": "High", "secret": "hidden"}}}, "https://fixture.atlassian.net")
        self.assertEqual(view["parent"], {"key": "PF-1"})
        self.assertEqual(view["priority"], {"id": "2", "name": "High"})
        self.assertNotIn("hidden", json.dumps(view))
