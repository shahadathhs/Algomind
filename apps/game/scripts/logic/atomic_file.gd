class_name AtomicFile
extends RefCounted
## Writing a JSON file so a crash or a full disk never leaves a half-written or missing file: the
## text goes to `<path>.tmp` first, is read back to check it, and then replaces the real file.
## The destination is never deleted before it has been replaced. Optionally the previous good
## copy is kept as `<path>.bak`; `read_recovered` falls back on it when the file cannot be used.


## Writes `value` as JSON to `path`. Returns false when the write failed; the previous file is
## then still in place.
static func write_json(path: String, value: Variant, keep_backup: bool = false) -> bool:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var tmp := path + ".tmp"
	var file := FileAccess.open(tmp, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	file.flush()
	file.close()
	if read_json(tmp) == null:
		DirAccess.remove_absolute(tmp)
		return false
	if keep_backup and read_json(path) != null:
		DirAccess.copy_absolute(path, path + ".bak")
	if DirAccess.rename_absolute(tmp, path) == OK:
		return true
	# Some platforms refuse to rename over an existing file. Overwrite it in place instead of
	# deleting it first, so a failure here still leaves the old file.
	var copied := DirAccess.copy_absolute(tmp, path) == OK
	DirAccess.remove_absolute(tmp)
	return copied


## The parsed JSON in `path`, or null when it is missing or unreadable (no engine error logged).
static func read_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	var parser := JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return null
	return parser.data


## The data in `path`, or in the last good copy `<path>.bak` when `path` cannot be used. `accept`
## is Callable(parsed: Variant) -> Variant: the data to use for a parsed file, or null for a file
## this build cannot use (unreadable, or of another version). A main file that exists but cannot
## be used is first copied to `<path>.corrupt`, so it is kept although the next save replaces it.
## Returns { data, from_backup }; `data` is null when neither file could be used.
static func read_recovered(path: String, accept: Callable) -> Dictionary:
	var main: Variant = accept.call(read_json(path))
	if main != null:
		return {"data": main, "from_backup": false}
	if FileAccess.file_exists(path):
		DirAccess.copy_absolute(path, path + ".corrupt")
	var backup: Variant = accept.call(read_json(path + ".bak"))
	return {"data": backup, "from_backup": backup != null}
