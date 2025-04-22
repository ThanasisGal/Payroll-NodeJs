document.addEventListener("DOMContentLoaded", async function () {
  const companyId = document.getElementById("companyId").value;
  const companyTeam = document.getElementById("companyTeam").value;

  async function fetchAllUsers(companyTeam) {
    const response = await fetch(`/api/allUsersByTeam/${companyTeam}`);
    if (!response.ok) throw new Error("Failed to fetch users");
    return await response.json();
  }

  async function fetchCompanyUsers(companyId) {
    const response = await fetch(`/api/companyUsers/${companyId}`);
    if (!response.ok) throw new Error("Failed to fetch company users");
    return await response.json();
  }

  try {
    const allUsers = await fetchAllUsers(companyTeam);
    const companyUsers = await fetchCompanyUsers(companyId);
    const selectedUserIds = companyUsers.users.map((user) => user._id);
    const selectElement = document.getElementById("selectedUsers");

    allUsers.forEach((user) => {
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
