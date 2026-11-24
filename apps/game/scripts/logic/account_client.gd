class_name AccountClient
extends RefCounted
## Signing in, registering, signing out, deleting the account, and authenticated calls.
##
## The access token lives in memory only; the rotating refresh token is kept in Account. A call
## that finds the access token missing or expiring refreshes it first (and stores the new
## refresh token); a refresh the server rejects ends the session on this device. Every method
## returns { ok, message, ... } and never throws.

## Emitted when a refresh that other callers were waiting for has ended.
signal refresh_finished

## How early before it expires an access token is replaced, in seconds.
const EXPIRY_MARGIN := 30.0

var account: Account
## Callable(method: String, path: String, body: Variant, bearer: String) -> Dictionary (a result
## as ApiClient.send_json returns it). Replaced by a fake in tests.
var _send: Callable
var _access_token := ""
var _refreshing := false
var _access_expires_at := 0.0
## Counted up whenever the session is forgotten on this device. An answer the server gives to a
## refresh that was asked for before that belongs to the session the player left, so it is not
## stored: it would sign the device back in with a token the server has revoked.
var _forgotten := 0


func _init(stored: Account, sender: Callable) -> void:
	account = stored
	_send = sender


func sign_in(email: String, password: String) -> Dictionary:
	return await _begin("auth/login", email, password)


func register(email: String, password: String) -> Dictionary:
	return await _begin("auth/register", email, password)


## Revokes the session on the server when it can, and always forgets it on this device.
func sign_out() -> void:
	if account.signed_in():
		await _send.call("POST", "auth/logout", {"refreshToken": account.refresh_token}, "")
	_forget()


## Deletes the account on the server (it needs the password), then forgets it here.
func delete_account(password: String) -> Dictionary:
	var result := await call_authed("DELETE", "me", {"password": password})
	if result["ok"]:
		_forget()
	return result


## One authenticated request. On 401 the token is refreshed once and the request retried.
## `error` is "signed_out" when there is no session, otherwise the transport error.
func call_authed(method: String, path: String, body: Variant = null) -> Dictionary:
	var token := await _fresh_access_token()
	if token.is_empty():
		return _no_token()
	var result: Dictionary = await _send.call(method, path, body, token)
	if not result["ok"] and int(result["status"]) == 401:
		_access_token = ""
		token = await _fresh_access_token()
		if token.is_empty():
			return _no_token(true)
		result = await _send.call(method, path, body, token)
	return _wrap(result)


## The failure of a call that has no access token. "signed_out" only when the session really
## ended on this device; a refresh that failed on the way leaves it, and the call is "offline".
## `session_ended` picks the sentence for a session the server just refused to refresh.
func _no_token(session_ended: bool = false) -> Dictionary:
	if account.signed_in():
		return _failed("offline", describe({"error": "offline", "status": 0, "json": null}))
	if session_ended:
		return _failed("signed_out", "YOUR SESSION ENDED. SIGN IN AGAIN")
	return _failed("signed_out", describe({"error": "signed_out", "status": 0, "json": null}))


## A short, plain sentence for a failed result: the server's reason or the connection problem.
static func describe(result: Dictionary) -> String:
	var body: Variant = result.get("json")
	var code := str(body.get("code", "")) if typeof(body) == TYPE_DICTIONARY else ""
	match code:
		"INVALID_CREDENTIALS":
			return "THE EMAIL OR PASSWORD IS INCORRECT"
		"EMAIL_TAKEN":
			return "AN ACCOUNT WITH THIS EMAIL ALREADY EXISTS"
		"WEAK_PASSWORD":
			return "USE A PASSWORD OF AT LEAST 12 CHARACTERS"
		"VALIDATION_FAILED":
			return "ENTER A VALID EMAIL AND A PASSWORD OF AT LEAST 12 CHARACTERS"
		"PASSWORD_INCORRECT":
			return "THE PASSWORD IS INCORRECT"
	if int(result.get("status", 0)) == 429:
		return "TOO MANY ATTEMPTS. WAIT A MOMENT AND TRY AGAIN"
	match str(result.get("error", "")):
		"disabled":
			return "ACCOUNTS NEED A CONNECTION TO THE SERVER"
		"offline", "timeout":
			return "NO CONNECTION. TRY AGAIN WHEN YOU ARE ONLINE"
		"signed_out":
			return "YOU ARE NOT SIGNED IN"
	return "SOMETHING WENT WRONG. TRY AGAIN"


func _begin(path: String, email: String, password: String) -> Dictionary:
	var result: Dictionary = await _send.call(
		"POST", path, {"email": email.strip_edges(), "password": password}, ""
	)
	if not result["ok"]:
		return _failed(str(result["error"]), describe(result))
	if not _accept_session(result["json"]):
		return _failed("parse", "SOMETHING WENT WRONG. TRY AGAIN")
	return {"ok": true, "message": ""}


## Stores the tokens of a login, registration, or refresh response. False if it is malformed.
func _accept_session(body: Variant) -> bool:
	if typeof(body) != TYPE_DICTIONARY:
		return false
	var access: Variant = body.get("accessToken")
	var refresh: Variant = body.get("refreshToken")
	var user: Variant = body.get("user")
	if typeof(access) != TYPE_STRING or typeof(refresh) != TYPE_STRING:
		return false
	_access_token = access
	_access_expires_at = Time.get_unix_time_from_system() + float(body.get("expiresIn", 0))
	var email := account.email
	if typeof(user) == TYPE_DICTIONARY and typeof(user.get("email")) == TYPE_STRING:
		email = user["email"]
	if account.signed_in() and account.email == email:
		account.refresh_token = refresh
		account.save()
	else:
		account.start(email, refresh)
	return true


## A usable access token, refreshing it when needed. Only one refresh runs at a time: a second
## caller that arrives meanwhile waits for it and uses its result. Two refreshes with the same
## refresh token would make the server see a reused (stolen) token and end the session.
func _fresh_access_token() -> String:
	if not account.signed_in():
		return ""
	if _is_fresh():
		return _access_token
	if _refreshing:
		await refresh_finished
		return _access_token if _is_fresh() else ""
	_refreshing = true
	var token := await _refresh()
	_refreshing = false
	refresh_finished.emit()
	return token


func _is_fresh() -> bool:
	return (
		not _access_token.is_empty()
		and Time.get_unix_time_from_system() < _access_expires_at - EXPIRY_MARGIN
	)


## Exchanges the refresh token for a new pair. "" when it fails; a rejection ends the session.
func _refresh() -> String:
	var asked_before := _forgotten
	var result: Dictionary = await _send.call(
		"POST", "auth/refresh", {"refreshToken": account.refresh_token}, ""
	)
	if asked_before != _forgotten:
		return ""  # signed out (or deleted) meanwhile: this answer is not for this device
	if result["ok"] and _accept_session(result["json"]):
		return _access_token
	if int(result["status"]) == 401:
		_forget()  # the server no longer knows this session
	return ""


func _forget() -> void:
	_access_token = ""
	_access_expires_at = 0.0
	_forgotten += 1
	account.clear()


func _wrap(result: Dictionary) -> Dictionary:
	if result["ok"]:
		return {"ok": true, "message": "", "json": result["json"], "status": result["status"]}
	var failed := _failed(str(result["error"]), describe(result))
	failed["status"] = result["status"]
	failed["json"] = result["json"]
	return failed


func _failed(error: String, message: String) -> Dictionary:
	return {"ok": false, "error": error, "message": message}
