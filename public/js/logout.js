const logoutButton = document.getElementById('logoutLink');

logoutButton.addEventListener('click', (event) => {
  // event.preventDefault(); // Ακυρώνει την προεπιλεγμένη συμπεριφορά του συνδέσμου

  const logoutModal = new bootstrap.Modal(document.getElementById('logoutModal'));
  // Εμφανίζει το modal
  logoutModal.show();
});
