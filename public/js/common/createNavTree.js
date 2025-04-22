document.addEventListener("DOMContentLoaded", function () {
  NavTree.createBySelector("#nav-tree", {
    searchable: true,
    showEmptyGroups: true,

    groupOpenIconClass: "bi",
    groupOpenIcon: "bi-caret-down",

    groupCloseIconClass: "bi",
    groupCloseIcon: "bi-caret-right",

    linkIconClass: "bi",
    linkIcon: "bi-link",

    searchPlaceholderText: "Αναζήτηση",

    iconPlace: "end",
  });
});
