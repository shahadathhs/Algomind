class_name ApiClient
extends Node
## Reads public JSON from the API. Only the public catalog routes are ever requested; the game
## never calls an admin route and never sends credentials with these requests.
##
## `fetch_json(path)` is a coroutine and never throws. Its result is
## { ok: bool, status: int, json: Variant, error: String } where error is one of
## "" (success), "offline", "timeout", "http", "parse", or "disabled" (no API configured).

const SETTING := "algomind/network/api_base_url"
const ENV_OVERRIDE := "ALGOMIND_API_BASE_URL"
const TIMEOUT_SECONDS := 10.0
const MAX_BODY_BYTES := 1048576


## The configured API base URL without a trailing slash, or "" when the game is offline-only.
## Release builds accept only https. Debug builds may use plain http for a local API.
static func base_url() -> String:
	var url := ""
	if OS.is_debug_build():
		url = OS.get_environment(ENV_OVERRIDE).strip_edges()
	if url.is_empty():
		url = String(ProjectSettings.get_setting(SETTING, "")).strip_edges()
	return normalize_base_url(url, OS.is_debug_build())


static func normalize_base_url(url: String, allow_plain_http: bool) -> String:
	var clean := url.strip_edges().rstrip("/")
	if clean.begins_with("https://"):
		return clean
	if allow_plain_http and clean.begins_with("http://"):
		return clean
	return ""


func is_enabled() -> bool:
	return not base_url().is_empty()


func fetch_json(path: String) -> Dictionary:
	var base := base_url()
	if base.is_empty():
		return _result(false, 0, null, "disabled")
	var request := HTTPRequest.new()
	request.timeout = TIMEOUT_SECONDS
	request.body_size_limit = MAX_BODY_BYTES
	add_child(request)
	var headers := PackedStringArray(["Accept: application/json"])
	var started := request.request("%s/%s" % [base, path.trim_prefix("/")], headers)
	if started != OK:
		request.queue_free()
		return _result(false, 0, null, "offline")
	var outcome: Array = await request.request_completed
	request.queue_free()
	return interpret(int(outcome[0]), int(outcome[1]), outcome[3] as PackedByteArray)


## Turns an HTTPRequest completion into a result Dictionary (kept separate so it can be tested).
static func interpret(request_result: int, status: int, body: PackedByteArray) -> Dictionary:
	if request_result == HTTPRequest.RESULT_TIMEOUT:
		return _result(false, status, null, "timeout")
	if request_result != HTTPRequest.RESULT_SUCCESS:
		return _result(false, status, null, "offline")
	if status < 200 or status >= 300:
		return _result(false, status, null, "http")
	var parser := JSON.new()
	if parser.parse(body.get_string_from_utf8()) != OK or parser.data == null:
		return _result(false, status, null, "parse")
	return _result(true, status, parser.data, "")


static func _result(ok: bool, status: int, json: Variant, error: String) -> Dictionary:
	return {"ok": ok, "status": status, "json": json, "error": error}
