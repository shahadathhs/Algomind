extends GutTest
## The shared safe-write helper: it replaces files, keeps a backup on request, and refuses to
## leave a bad file in place.

const PATH := "user://test_atomic.json"


func before_each() -> void:
	_remove()


func after_each() -> void:
	_remove()


func _remove() -> void:
	for suffix in ["", ".tmp", ".bak", ".corrupt"]:
		if FileAccess.file_exists(PATH + suffix):
			DirAccess.remove_absolute(PATH + suffix)


## The file when it is a saved state this build understands ({ ok: true }), else null.
func _accept(parsed: Variant) -> Variant:
	if typeof(parsed) == TYPE_DICTIONARY and parsed.get("ok", false) == true:
		return parsed
	return null


func test_a_value_round_trips() -> void:
	assert_true(AtomicFile.write_json(PATH, {"a": 1, "b": ["x"]}))
	var read: Variant = AtomicFile.read_json(PATH)
	assert_eq(read["b"], ["x"])
	assert_false(FileAccess.file_exists(PATH + ".tmp"), "no temporary file is left behind")


func test_writing_again_replaces_the_file() -> void:
	AtomicFile.write_json(PATH, {"v": 1})
	assert_true(AtomicFile.write_json(PATH, {"v": 2}))
	assert_eq(AtomicFile.read_json(PATH)["v"], 2.0)


func test_a_backup_keeps_the_previous_good_copy() -> void:
	AtomicFile.write_json(PATH, {"v": 1}, true)
	AtomicFile.write_json(PATH, {"v": 2}, true)
	assert_eq(AtomicFile.read_json(PATH + ".bak")["v"], 1.0)
	assert_eq(AtomicFile.read_json(PATH)["v"], 2.0)


func test_no_backup_is_made_unless_asked() -> void:
	AtomicFile.write_json(PATH, {"v": 1})
	AtomicFile.write_json(PATH, {"v": 2})
	assert_false(FileAccess.file_exists(PATH + ".bak"))


func test_reading_a_missing_or_damaged_file_gives_null_without_an_error() -> void:
	assert_null(AtomicFile.read_json(PATH))
	var file := FileAccess.open(PATH, FileAccess.WRITE)
	file.store_string("{broken")
	file.close()
	assert_null(AtomicFile.read_json(PATH))


func _write(file_path: String, text: String) -> void:
	var file := FileAccess.open(file_path, FileAccess.WRITE)
	file.store_string(text)
	file.close()


func test_a_usable_file_is_used_and_its_backup_is_left_alone() -> void:
	AtomicFile.write_json(PATH, {"ok": true, "v": 1}, true)
	AtomicFile.write_json(PATH, {"ok": true, "v": 2}, true)
	var found := AtomicFile.read_recovered(PATH, _accept)
	assert_false(found["from_backup"])
	assert_eq(found["data"]["v"], 2.0)
	assert_false(FileAccess.file_exists(PATH + ".corrupt"))


func test_an_unusable_file_is_kept_and_replaced_by_its_backup() -> void:
	AtomicFile.write_json(PATH, {"ok": true, "v": 1}, true)
	AtomicFile.write_json(PATH, {"ok": true, "v": 2}, true)
	_write(PATH, "{broken")
	var found := AtomicFile.read_recovered(PATH, _accept)
	assert_true(found["from_backup"])
	assert_eq(found["data"]["v"], 1.0, "the last good copy")
	assert_true(FileAccess.file_exists(PATH + ".corrupt"), "the damaged file is kept")
	assert_null(AtomicFile.read_json(PATH), "and the main file is left as it was")


func test_without_a_usable_file_there_is_no_data() -> void:
	var missing := AtomicFile.read_recovered(PATH, _accept)
	assert_null(missing["data"])
	assert_false(missing["from_backup"])
	assert_false(FileAccess.file_exists(PATH + ".corrupt"), "a missing file leaves nothing behind")
	# Readable, but not what `accept` wants, in both files.
	_write(PATH, JSON.stringify({"ok": false, "v": 1}))
	_write(PATH + ".bak", JSON.stringify({"ok": false, "v": 0}))
	var found := AtomicFile.read_recovered(PATH, _accept)
	assert_null(found["data"])
	assert_false(found["from_backup"])
	assert_true(FileAccess.file_exists(PATH + ".corrupt"), "the file is still kept")
