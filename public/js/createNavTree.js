document.addEventListener("DOMContentLoaded", function () {
	NavTree.createBySelector("#nav-tree", {
		searchable: true,
		showEmptyGroups: true,

		groupOpenIconClass: "bi",
		groupOpenIcon: "bi-chevron-down",

		groupCloseIconClass: "bi",
		groupCloseIcon: "bi-chevron-right",

		linkIconClass: "bi",
		linkIcon: "bi-link",

		searchPlaceholderText: "Αναζήτηση",

		iconPlace: "end",
	});
});
