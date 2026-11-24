extends GutTest
## The downloaded catalog is saved only once every level it names is on the device, so a download
## that is cut short never hides the levels the player already has (a fake fetcher, no network).

const DIR := "user://test_catalog_download"

var _store: ContentStore


func before_each() -> void:
	_store = ContentStore.new(DIR)
	_store.clear()


func after_each() -> void:
	_store.clear()


func _ids() -> Array:
	var ids: Array = []
	for entry: Dictionary in ContentSync.build_campaign(_store).entries:
		ids.append(entry["id"])
	return ids


func test_a_first_download_that_is_cut_short_stores_no_catalog() -> void:
	var routes := {
		"campaign": ContentFixtures.catalog({"one": 1, "two": 1}),
		"levels/one": ContentFixtures.served("one"),
	}
	var result: Dictionary = await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	assert_eq(result["status"], "offline", "it does not say the levels are up to date")
	assert_eq((result["errors"] as Array).size(), 1)
	assert_eq(_store.cached_version("one"), 1, "what arrived stays on the device")
	assert_null(_store.load_catalog(), "the catalog waits for every level it names")
	assert_eq(_ids(), [] as Array, "no partial campaign is built")


func test_the_next_refresh_fetches_only_what_was_missing_and_then_completes_the_campaign() -> void:
	var routes := {
		"campaign": ContentFixtures.catalog({"one": 1, "two": 1}),
		"levels/one": ContentFixtures.served("one"),
	}
	await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	var calls: Array = []
	routes["levels/two"] = ContentFixtures.served("two")
	var result: Dictionary = await ContentSync.refresh(
		ContentFixtures.fetcher(routes, calls), _store
	)
	assert_eq(calls, ["campaign", "levels/two"] as Array, "one is not downloaded twice")
	assert_eq(result["status"], "updated")
	assert_eq(result["errors"], [])
	assert_eq(_ids(), ["one", "two"] as Array)


func test_a_level_the_game_refuses_also_keeps_the_catalog_waiting() -> void:
	var routes := {
		"campaign": ContentFixtures.catalog({"one": 1, "two": 1}),
		"levels/one": ContentFixtures.served("one"),
		"levels/two": ContentFixtures.served("two"),
	}
	routes["levels/two"]["content"]["board"]["width"] = 99
	var result: Dictionary = await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	assert_eq(result["status"], "invalid", "the level arrived, but the game cannot use it")
	assert_null(_store.load_catalog())
	assert_eq(_store.cached_version("one"), 1, "the other level is kept for the next refresh")


func test_a_failed_refresh_on_an_up_to_date_device_changes_nothing() -> void:
	var routes := {
		"campaign": ContentFixtures.catalog({"one": 1, "two": 1}),
		"levels/one": ContentFixtures.served("one"),
		"levels/two": ContentFixtures.served("two"),
	}
	await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	var before: Variant = _store.load_catalog()
	# A new level is published, but it cannot be downloaded just now.
	routes["campaign"] = ContentFixtures.catalog({"one": 1, "two": 1, "three": 1})
	var result: Dictionary = await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	assert_eq(result["status"], "offline")
	assert_eq(_store.load_catalog(), before, "the catalog in use stays the one that is complete")
	assert_eq(_ids(), ["one", "two"] as Array)


func test_an_older_copy_of_a_level_counts_and_lets_the_new_catalog_in() -> void:
	# The device has the whole campaign; one level now comes in a new version that cannot be
	# downloaded. Nothing is missing, so the player keeps every level (the older copy included).
	var routes := {
		"campaign": ContentFixtures.catalog({"one": 1, "two": 1}),
		"levels/one": ContentFixtures.served("one"),
		"levels/two": ContentFixtures.served("two"),
	}
	await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	routes["campaign"] = ContentFixtures.catalog({"one": 2, "two": 1, "three": 1})
	routes["levels/three"] = ContentFixtures.served("three")
	routes.erase("levels/one")  # its new version cannot be downloaded just now
	var result: Dictionary = await ContentSync.refresh(ContentFixtures.fetcher(routes, []), _store)
	assert_eq((result["errors"] as Array).size(), 1, "the new version of one did not arrive")
	assert_eq(result["status"], "updated", "the campaign did change: the new level is in")
	assert_eq(_store.cached_version("one"), 1, "its older copy stays")
	assert_eq(_ids(), ["one", "two", "three"] as Array, "the new level is there all the same")
