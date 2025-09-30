const twoSpaces = '\u00A0'.repeat(2);

document.addEventListener("DOMContentLoaded", async function () {
  const companyId = document.getElementById("companyId").value;
  const companyTeam = document.getElementById("companyTeam").value;

  const csrfToken = document
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute("content");

  const fetchOpts = {
    credentials: "same-origin", // στέλνει cookies στο ίδιο origin
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
  };

  async function fetchAllUsers(team) {
    const res = await fetch(`/api/allUsersByTeam/${encodeURIComponent(team)}`, fetchOpts);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  }

  async function fetchCompanyUsers(id) {
    const res = await fetch(`/api/companyUsers/${encodeURIComponent(id)}`, fetchOpts);
    if (!res.ok) throw new Error("Failed to fetch company users");
    return res.json();
  }

  try {
    const [allUsers, companyUsers] = await Promise.all([
      fetchAllUsers(companyTeam),
      fetchCompanyUsers(companyId),
    ]);

    const selectedUserIds = (companyUsers.users || []).map(u => u._id);
    const selectElement = document.getElementById("selectedUsers");

    allUsers.forEach((user) => {
      // ασφάλεια: ποτέ innerHTML εδώ — χρησιμοποιούμε το Option constructor (ok)
      const option = new Option(
        user.lastName + twoSpaces + user.firstName,
        user._id,
        false,
        selectedUserIds.includes(user._id)
      );
      selectElement.add(option);
    });
  } catch (error) {
    console.error("Error loading data:", error);
  }
});
