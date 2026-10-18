extends GutTest
## Runs every shared fixture of packages/level-contract against the GDScript validator and
## simulator. The fixtures are copied here by `make game-fixtures`. Solver fixtures are not
## run: the game takes par from the server and has no solver.


func _validate(mode: String, level: Variant) -> Dictionary:
	if mode == "authoring":
		return LevelValidator.validate_authoring_level(level)
	return LevelValidator.validate_level(level)


func _expected_pairs(expected_issues: Array) -> Array[String]:
	var out: Array[String] = []
	for issue: Dictionary in expected_issues:
		out.append("%s|%s" % [issue["path"], issue["code"]])
	out.sort()
	return out


func test_fixtures_are_present() -> void:
	assert_gt(ContractSupport.fixture_names("levels/valid").size(), 0, "valid fixtures")
	assert_gt(ContractSupport.fixture_names("levels/invalid").size(), 0, "invalid fixtures")
	assert_gt(ContractSupport.fixture_names("runs").size(), 0, "run fixtures")


func test_valid_levels_have_no_issues() -> void:
	var failures: Array[String] = []
	for file_name in ContractSupport.fixture_names("levels/valid"):
		var data: Dictionary = ContractSupport.load_fixture("levels/valid", file_name)
		var result := _validate(data["mode"], data["level"])
		if not result["ok"] or not result["issues"].is_empty():
			failures.append("%s: %s" % [file_name, ContractSupport.pairs(result["issues"])])
	assert_eq(failures, [], "valid fixtures that were rejected")


func test_invalid_levels_report_exactly_the_expected_issues() -> void:
	var failures: Array[String] = []
	for file_name in ContractSupport.fixture_names("levels/invalid"):
		var data: Dictionary = ContractSupport.load_fixture("levels/invalid", file_name)
		var result := _validate(data["mode"], data["level"])
		var got := ContractSupport.pairs(result["issues"])
		var want := _expected_pairs(data["expectedIssues"])
		if result["ok"] or got != want:
			failures.append("%s: got %s, want %s" % [file_name, got, want])
		for i in range(1, got.size()):
			if got[i] == got[i - 1]:
				failures.append("%s: repeated pair %s" % [file_name, got[i]])
	assert_eq(failures, [], "invalid fixtures with wrong issues")


func test_runs_match_program_issues_and_expected_result() -> void:
	var failures: Array[String] = []
	for file_name in ContractSupport.fixture_names("runs"):
		var data: Dictionary = ContractSupport.load_fixture("runs", file_name)
		var level: Dictionary = data["level"]
		var program: Array = data["program"]

		var level_check := LevelValidator.validate_level(level)
		if not level_check["ok"]:
			failures.append("%s: level does not validate" % file_name)

		var program_check := LevelValidator.validate_program(level, program)
		var got := ContractSupport.pairs(program_check["issues"])
		var want := _expected_pairs(data["programIssues"])
		if got != want:
			failures.append("%s: programIssues got %s, want %s" % [file_name, got, want])

		var result := LevelSimulator.simulate(level, program)
		var expected: Dictionary = data["expected"]
		if not ContractSupport.same(result, expected):
			failures.append(
				"%s: result differs\n got  %s\n want %s" % [file_name, result, expected]
			)
		if result["steps"] != result["trace"].size():
			failures.append("%s: steps != trace length" % file_name)
	assert_eq(failures, [], "run fixtures that differ")


func test_run_results_use_integers_for_positions() -> void:
	for file_name in ContractSupport.fixture_names("runs"):
		var data: Dictionary = ContractSupport.load_fixture("runs", file_name)
		var result := LevelSimulator.simulate(data["level"], data["program"])
		for cell: Variant in [result["finalState"]["position"], result["blockedCell"]]:
			if cell != null:
				assert_eq(typeof(cell[0]), TYPE_INT, "%s x" % file_name)
				assert_eq(typeof(cell[1]), TYPE_INT, "%s y" % file_name)
