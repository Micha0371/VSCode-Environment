"""Local Jira Cloud CLI. Credentials never cross the process boundary."""
import argparse
import base64
import ctypes
from ctypes import wintypes
import json
from pathlib import Path
import re
import sys
from urllib import error, parse, request

HOME = Path(__file__).resolve().parent
CONFIG = HOME / "config.local.json"
TARGETS = {"email": "OWN/PANTRYJIRA_EMAIL", "token": "OWN/PANTRYJIRA_API",
           "site": "OWN/PANTRYJIRA_BASEURL"}


class Failure(Exception):
    """Only fixed, safe messages belong in this exception."""


class WriteOutcomeUnknown(Failure):
    def __init__(self):
        super().__init__("Write outcome is unknown; inspect Jira before retrying. No automatic retry was made")


class RateLimited(Failure):
    def __init__(self, retry_after=None):
        super().__init__("Jira rate limit reached (HTTP 429); retry later")
        self.retry_after = retry_after


class SafeParser(argparse.ArgumentParser):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **{**kwargs, "allow_abbrev": False})

    def error(self, message):
        # argparse's default errors echo user values before credentials/redaction exist.
        raise Failure("Invalid command-line arguments; use --help")


def credential(target):
    if target not in TARGETS.values():
        raise Failure("Credential target is not allowed")
    if sys.platform != "win32":
        raise Failure("Live credentials require Windows; fixture tests are cross-platform")

    class Credential(ctypes.Structure):
        _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                    ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                    ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                    ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                    ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
                    ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                    ("UserName", wintypes.LPWSTR)]

    api = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    pointer = ctypes.POINTER(Credential)()
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                             ctypes.POINTER(ctypes.POINTER(Credential))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    api.CredFree.restype = None
    if not api.CredReadW(target, 1, 0, ctypes.byref(pointer)):
        raise Failure("Required generic credential is unavailable: " + target)
    try:
        raw = ctypes.string_at(pointer.contents.CredentialBlob,
                               pointer.contents.CredentialBlobSize)
        value = raw.decode("utf-16-le").rstrip("\0")
        if not value or any(c in value for c in "\r\n\0"):
            raise Failure("Credential contains an empty or invalid value: " + target)
        return value
    except UnicodeError:
        raise Failure("Generic credential must contain a Windows text value: " + target) from None
    finally:
        api.CredFree(pointer)


def site_url(value):
    if not re.fullmatch(r"https://[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.atlassian\.net/?", value):
        raise Failure("BASEURL must be only https://YOUR-SITE.atlassian.net, without a path or query")
    return value.rstrip("/").lower()


def project_key(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]{1,29}", value):
        raise Failure("Invalid Jira project key")
    return value


def issue_key(value, project):
    if not re.fullmatch(re.escape(project) + r"-[1-9][0-9]*", value):
        raise Failure("Issue key must belong to the configured project")
    return value


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HTTP:
    def __init__(self):
        # Do not inherit proxies or forward credentials through redirects.
        self.opener = request.build_opener(request.ProxyHandler({}), NoRedirect())

    def call(self, method, url, auth=None, body=None):
        headers = {"Accept": "application/json", "User-Agent": "PantryFlow-Jira/1"}
        if auth:
            headers["Authorization"] = auth
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        try:
            with self.opener.open(request.Request(url, data=data, headers=headers, method=method), timeout=25) as response:
                payload = response.read(2_000_001)
                if len(payload) > 2_000_000:
                    raise Failure("Jira response exceeded the size limit")
                return response.status, json.loads(payload) if payload else {}
        except error.HTTPError as exc:
            status = exc.code
            retry = exc.headers.get("Retry-After", "") if exc.headers else ""
            exc.close()
            if status == 429:
                # Only emit a bounded integer, never the raw header or error body.
                seconds = int(retry) if re.fullmatch(r"\d{1,5}", retry, flags=re.ASCII) else None
                raise RateLimited(seconds) from None
            # Never echo a server error body, request headers or arbitrary exception.
            return status, {}
        except (error.URLError, TimeoutError, OSError, ValueError):
            raise Failure("Jira request failed; check network, TLS and configuration") from None


def require_success(status):
    if not 200 <= status < 300:
        messages = {401: "Authentication rejected; check token, email and authentication mode",
                    403: "Access denied; check Jira permissions and token scopes",
                    404: "Jira resource unavailable or inaccessible",
                    429: "Jira rate limit reached; retry later"}
        raise Failure(messages.get(status, "Jira request rejected") + " (HTTP " + str(status) + ")")


class Jira:
    def __init__(self, secrets, mode="auto", http=None, allow_writes=False):
        self.site = site_url(secrets["site"])
        email, token = secrets["email"], secrets["token"]
        if not re.fullmatch(r"[^\s:@]+@[^\s@]+\.[^\s@]+", email) or not token or any(c in token for c in "\r\n\0"):
            raise Failure("Invalid email or API credential")
        self.auth = "Basic " + base64.b64encode((email + ":" + token).encode()).decode()
        self.sensitive = [token, parse.quote(token, safe=""), self.auth,
                          self.auth.removeprefix("Basic "), email]
        self.http = http or HTTP()
        self.mode = mode
        self.base = None
        self.allow_writes = allow_writes is True

    def connect(self):
        # Tenant discovery is unauthenticated and only uses the validated site.
        if self.mode != "classic":
            status, tenant = self.http.call("GET", self.site + "/_edge/tenant_info")
            require_success(status)
            cloud = tenant.get("cloudId")
            if not isinstance(cloud, str) or not re.fullmatch(r"[0-9a-fA-F-]{36}", cloud):
                raise Failure("Jira tenant discovery returned an invalid cloud ID")
            self.base = "https://api.atlassian.com/ex/jira/" + cloud + "/rest/api/3"
            status, _ = self.http.call("GET", self.base + "/myself", self.auth)
            if 200 <= status < 300:
                self.mode = "scoped"
                return
            if self.mode != "auto" or status not in (401, 403):
                require_success(status)
        self.base = self.site + "/rest/api/3"
        status, _ = self.http.call("GET", self.base + "/myself", self.auth)
        require_success(status)
        self.mode = "classic"

    def call(self, method, route, body=None):
        if not self.base or not route.startswith("/") or "://" in route:
            raise Failure("Invalid internal Jira route")
        mutation = method != "GET" and not (method == "POST" and route == "/search/jql")
        if mutation and not self.allow_writes:
            raise Failure("Writes require explicit --apply authorization")
        try:
            status, result = self.http.call(method, self.base + route, self.auth, body)
        except RateLimited:
            raise
        except Exception:
            if mutation:
                raise WriteOutcomeUnknown() from None
            raise
        if mutation and status >= 500:
            raise WriteOutcomeUnknown()
        require_success(status)
        return result

    def safe(self, result):
        encoded = json.dumps(result, ensure_ascii=False)
        for value in sorted(set(self.sensitive), key=len, reverse=True):
            encoded = encoded.replace(json.dumps(value, ensure_ascii=False)[1:-1], "[REDACTED]")
        return encoded


def config():
    if not CONFIG.exists():
        return {"auth_mode": "auto"}
    try:
        value = json.loads(CONFIG.read_text(encoding="utf-8"))
        if not isinstance(value, dict) or set(value) - {"project", "auth_mode"}:
            raise ValueError()
        if value.get("auth_mode", "auto") not in ("auto", "classic", "scoped"):
            raise ValueError()
        if "project" in value:
            project_key(value["project"])
        return value
    except (ValueError, OSError):
        raise Failure("Invalid config.local.json; use only project and auth_mode") from None


def jql_string(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def issue_view(item, site):
    fields = item.get("fields", {})
    key = item.get("key", "")
    return {"key": key, "url": site + "/browse/" + parse.quote(key, safe=""),
            "summary": fields.get("summary"), "description": fields.get("description"),
            "status": (fields.get("status") or {}).get("name"),
            "issueType": (fields.get("issuetype") or {}).get("name"),
            "issueTypeId": (fields.get("issuetype") or {}).get("id"),
            "parent": {"key": fields["parent"].get("key")} if fields.get("parent") else None,
            "priority": {"id": fields["priority"].get("id"), "name": fields["priority"].get("name")} if fields.get("priority") else None,
            "labels": fields.get("labels", []), "updated": fields.get("updated")}


def numeric_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{1,20}", value, flags=re.ASCII):
        raise Failure("Metadata IDs must be numeric strings")
    return value


def metadata_pages(jira, route, field):
    results = []
    start = 0
    for _ in range(100):
        page = jira.call("GET", route + "?maxResults=50&startAt=" + str(start))
        entries = page.get(field)
        if not isinstance(entries, list):
            raise Failure("Invalid creation metadata response")
        results.extend(entries)
        total = page.get("total")
        if page.get("isLast") is True or (isinstance(total, int) and len(results) >= total):
            return results
        if not entries or not isinstance(total, int):
            raise Failure("Incomplete creation metadata; refusing to guess")
        start += len(entries)
    raise Failure("Creation metadata exceeded pagination limit")


def creation_metadata(jira, project, type_id=None):
    types = metadata_pages(jira, "/issue/createmeta/" + project + "/issuetypes", "issueTypes")
    selected = [{"id": t["id"], "name": t["name"], "subtask": t.get("subtask", False)} for t in types]
    if type_id is None:
        return {"project": project, "issueTypes": selected}
    numeric_id(type_id)
    if type_id not in {t["id"] for t in types}:
        raise Failure("Issue type is not creatable in the configured project")
    detail = jira.call("GET", "/issuetype/" + type_id)
    if detail.get("id") != type_id or type(detail.get("hierarchyLevel")) is not int:
        raise Failure("Issue hierarchy level is unavailable; refusing to guess")
    fields = metadata_pages(jira, "/issue/createmeta/" + project + "/issuetypes/" + type_id, "fields")
    output = []
    for field in fields:
        identifier = field.get("fieldId", field.get("key"))
        entry = {"id": identifier, "name": field.get("name"), "required": field.get("required", False),
                 "hasDefaultValue": field.get("hasDefaultValue", False)}
        if identifier == "priority":
            entry["allowedValues"] = [{"id": v["id"], "name": v["name"]} for v in field.get("allowedValues", [])]
        output.append(entry)
    return {"project": project, "issueTypes": selected,
            "selectedType": {"id": type_id, "name": detail.get("name"), "hierarchyLevel": detail["hierarchyLevel"]},
            "fields": output}


def validate_creation_relationships(jira, project, fields):
    # Missing optional input fields must not bypass a type's required parent.
    # Run the same read-only preflight for previews and applied creations.
    metadata = creation_metadata(jira, project, fields["issuetype"]["id"])
    available = {f["id"]: f for f in metadata["fields"]}
    for name in ("parent", "priority"):
        if name in fields and name not in available:
            raise Failure("Requested relationship or priority is not supported by the creation metadata")
    if "priority" in fields and fields["priority"]["id"] not in {
            v["id"] for v in available["priority"].get("allowedValues", [])}:
        raise Failure("Priority is not available for the selected project and issue type")
    level = metadata["selectedType"]["hierarchyLevel"]
    if "parent" not in fields:
        if level < 0:
            raise Failure("Subtask creation requires a parent")
        return
    parent_key = issue_key(fields["parent"]["key"], project)
    parent = jira.call("GET", "/issue/" + parent_key + "?fields=project,issuetype")
    parent_fields = parent.get("fields", {})
    if parent.get("key") != parent_key or parent_fields.get("project", {}).get("key") != project:
        raise Failure("Parent moved or belongs to another project")
    parent_type = numeric_id(parent_fields.get("issuetype", {}).get("id"))
    detail = jira.call("GET", "/issuetype/" + parent_type)
    if detail.get("id") != parent_type or type(detail.get("hierarchyLevel")) is not int:
        raise Failure("Parent hierarchy level is unavailable; refusing to guess")
    # Limit v1 hierarchy support to the approved Epic -> standard issue -> subtask shape.
    if (level, detail["hierarchyLevel"]) not in ((0, 1), (-1, 0)):
        raise Failure("Parent must be an Epic for a standard issue, or a standard issue for a subtask")


def input_fields(filename, create=False):
    try:
        file = Path(filename)
        if file.stat().st_size > 100_000:
            raise ValueError()
        value = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise Failure("Input must be a UTF-8 JSON file smaller than 100 KB") from None
    allowed = {"summary", "description", "labels"} | ({"issueTypeId", "parentKey", "priorityId"} if create else set())
    if not isinstance(value, dict) or not value or set(value) - allowed:
        raise Failure("Unsupported input fields; see tools/jira/README.md")
    result = {}
    if create and not {"summary", "issueTypeId"} <= set(value):
        raise Failure("Creation requires summary and issueTypeId")
    if "summary" in value:
        if not isinstance(value["summary"], str) or not value["summary"].strip() or len(value["summary"]) > 255:
            raise Failure("Summary must contain 1–255 characters")
        result["summary"] = value["summary"].strip()
    if "description" in value:
        if not isinstance(value["description"], str) or len(value["description"]) > 30000:
            raise Failure("Description must be plain text of at most 30000 characters")
        result["description"] = {"type": "doc", "version": 1, "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": line}] if line else []}
            for line in value["description"].split("\n")]}
    if "labels" in value:
        if not isinstance(value["labels"], list) or len(value["labels"]) > 20 or any(
                not isinstance(label, str) or not re.fullmatch(r"[\w-]{1,100}", label) for label in value["labels"]):
            raise Failure("Labels must be up to 20 simple names without spaces")
        result["labels"] = value["labels"]
    if create:
        if not isinstance(value["issueTypeId"], str) or not re.fullmatch(r"\d+", value["issueTypeId"], flags=re.ASCII):
            raise Failure("issueTypeId must be a numeric string from check")
        result["issuetype"] = {"id": value["issueTypeId"]}
        if "parentKey" in value:
            if not isinstance(value["parentKey"], str) or not re.fullmatch(r"[A-Z][A-Z0-9_]{1,29}-[1-9]\d*", value["parentKey"], flags=re.ASCII):
                raise Failure("Invalid parent issue key")
            result["parent"] = {"key": value["parentKey"]}
        if "priorityId" in value:
            result["priority"] = {"id": numeric_id(value["priorityId"])}
    return result


def execute(args, jira, settings):
    project = settings.get("project")
    if args.command == "check":
        if not project:
            result = jira.call("GET", "/project/search?maxResults=50")
            return {"connected": True, "authMode": jira.mode, "projectConfigured": False,
                    "projects": [{"key": p["key"], "name": p["name"]} for p in result.get("values", [])],
                    "moreProjects": not result.get("isLast", True)}
        info = jira.call("GET", "/project/" + project)
        if info.get("key") != project:
            raise Failure("Jira project identity did not match configuration")
        return {"connected": True, "authMode": jira.mode, "project": project, "name": info.get("name"),
                "issueTypes": [{"id": t["id"], "name": t["name"]} for t in info.get("issueTypes", [])]}
    if not project:
        raise Failure("Configure a project first: jira.py configure --project KEY")
    project_key(project)
    if args.command == "metadata":
        return creation_metadata(jira, project, args.issue_type)
    if args.command == "list":
        query = "project = " + jql_string(project)
        if args.status:
            query += " AND status = " + jql_string(args.status)
        query += " ORDER BY updated DESC"
        body = {"jql": query, "maxResults": args.limit,
                "fields": ["summary", "status", "issuetype", "labels", "updated", "parent", "priority"]}
        if args.page:
            body["nextPageToken"] = args.page
        result = jira.call("POST", "/search/jql", body)
        for item in result.get("issues", []):
            issue_key(item.get("key", ""), project)
        return {"issues": [issue_view(i, jira.site) for i in result.get("issues", [])],
                "nextPage": result.get("nextPageToken"), "isLast": result.get("isLast", True)}
    if args.command == "create":
        fields = input_fields(args.input, create=True)
        fields["project"] = {"key": project}
        validate_creation_relationships(jira, project, fields)
        if not args.apply:
            return {"preview": True, "operation": "create", "fields": fields}
        result = jira.call("POST", "/issue", {"fields": fields})
        try:
            key = issue_key(result.get("key", ""), project)
        except (Failure, AttributeError, TypeError):
            raise WriteOutcomeUnknown() from None
        return {"created": key, "url": jira.site + "/browse/" + key}
    key = issue_key(args.key, project)
    route = "/issue/" + key
    identity = jira.call("GET", route + "?fields=project")
    if identity.get("key") != key or identity.get("fields", {}).get("project", {}).get("key") != project:
        raise Failure("Issue moved or project identity did not match; refusing operation")
    if args.command == "get":
        result = jira.call("GET", route + "?fields=summary,description,status,issuetype,labels,updated,parent,priority")
        if result.get("key") != key:
            raise Failure("Jira issue identity did not match request")
        return issue_view(result, jira.site)
    if args.command == "update":
        fields = input_fields(args.input)
        if not args.apply:
            return {"preview": True, "operation": "update", "key": key, "fields": fields}
        jira.call("PUT", route, {"fields": fields})
        return {"updated": key, "url": jira.site + "/browse/" + key}
    transitions = jira.call("GET", route + "/transitions").get("transitions", [])
    choices = [{"id": t["id"], "name": t["name"]} for t in transitions]
    if args.command == "transitions":
        return {"key": key, "transitions": choices}
    matches = [t for t in choices if args.to in (t["id"], t["name"])]
    if len(matches) != 1:
        raise Failure("Transition must match exactly one available ID or name; use transitions KEY")
    if not args.apply:
        return {"preview": True, "operation": "transition", "key": key, "transition": matches[0]}
    jira.call("POST", route + "/transitions", {"transition": {"id": matches[0]["id"]}})
    return {"transitioned": key, "transition": matches[0]}


def parser():
    p = SafeParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    meta = sub.add_parser("metadata")
    meta.add_argument("--issue-type", type=numeric_id)
    cfg = sub.add_parser("configure")
    cfg.add_argument("--project", required=True, type=project_key)
    cfg.add_argument("--auth-mode", choices=["auto", "classic", "scoped"], default="auto")
    listing = sub.add_parser("list")
    listing.add_argument("--status")
    listing.add_argument("--limit", type=int, choices=range(1, 51), default=20)
    listing.add_argument("--page")
    for name in ["get", "create", "update", "transitions", "transition"]:
        command = sub.add_parser(name)
        if name != "create":
            command.add_argument("key")
        if name in ("create", "update"):
            command.add_argument("--input", required=True)
        if name == "transition":
            command.add_argument("--to", required=True)
        if name in ("create", "update", "transition"):
            command.add_argument("--apply", action="store_true", help="Perform the previewed mutation")
    return p


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    jira = None
    try:
        args = parser().parse_args()
        if args.command == "configure":
            CONFIG.write_text(json.dumps({"project": args.project, "auth_mode": args.auth_mode}, indent=2) + "\n", encoding="utf-8")
            print(json.dumps({"configured": True, "project": args.project}))
            return 0
        settings = config()
        jira = Jira({name: credential(target) for name, target in TARGETS.items()}, settings.get("auth_mode", "auto"),
                    allow_writes=getattr(args, "apply", False) is True)
        jira.connect()
        print(jira.safe(execute(args, jira, settings)))
        return 0
    except RateLimited as exc:
        result = {"error": str(exc), "code": "rate_limited", "retryAfterSeconds": exc.retry_after}
    except WriteOutcomeUnknown as exc:
        result = {"error": str(exc), "code": "write_outcome_unknown"}
    except Failure as exc:
        result = {"error": str(exc)}
    except Exception:
        # No tracebacks: third-party/network errors can contain headers or secrets.
        result = {"error": "Unexpected Jira integration failure; no diagnostic secrets were emitted"}
    print(jira.safe(result) if jira else json.dumps(result), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
