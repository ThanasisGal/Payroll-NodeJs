// document.addEventListener("DOMContentLoaded", () => {
//   // async function handleFormSubmit(event) {
//   //   event.preventDefault(); // Προλαβαίνει την προεπιλεγμένη συμπεριφορά της υποβολής φόρμας
//   //   const formData = {};
//   //   const filePromises = [];
//   //   const sections = document.querySelectorAll(".card-body");

//   //   sections.forEach((section) => {
//   //     const inputs = section.querySelectorAll("input, select, textarea");
//   //     inputs.forEach((input) => {
//   //       if (input.tagName === "INPUT") {
//   //         if (input.type === "checkbox") {
//   //           formData[input.name] = input.checked;
//   //         } else if (input.type === "file") {
//   //           if (input.files.length > 0) {
//   //             // Υπάρχει νέο αρχείο, το διαβάζει και το προσθέτει στο formData
//   //             const filePromise = new Promise((resolve, reject) => {
//   //               const reader = new FileReader();
//   //               reader.onload = function (e) {
//   //                 formData[input.name] = e.target.result; // Το νέο αρχείο σε Base64
//   //                 resolve();
//   //               };
//   //               reader.onerror = reject;
//   //               reader.readAsDataURL(input.files[0]);
//   //             });
//   //             filePromises.push(filePromise);
//   //           } else if (formData['currentImage']) { // <input type="hidden" name="currentImage" id="currentImage"..... στη φόρμα ejs
//   //             // Δεν υπάρχει νέο αρχείο αλλά το κρυφό πεδίο περιέχει την τρέχουσα τιμή της εικόνας
//   //             // Δεν απαιτείται ενέργεια εδώ, καθώς η τρέχουσα εικόνα έχει ήδη προστεθεί στο formData μέσω του κρυφού πεδίου
//   //           }
//   //         } else {
//   //           formData[input.name] = input.value;
//   //         }
//   //       } else if (input.tagName === "TEXTAREA") {
//   //         formData[input.name] = input.value;
//   //       } else if (input.tagName === "SELECT") {
//   //         if (input.multiple) {
//   //           const selectedOptions = Array.from(input.selectedOptions).map(
//   //             (option) => option.value
//   //           );
//   //           formData[input.name] =
//   //             selectedOptions.length > 0 ? selectedOptions : [];
//   //         } else {
//   //           formData[input.name] =
//   //             input.selectedIndex === -1
//   //               ? null
//   //               : input.options[input.selectedIndex].value;
//   //         }
//   //       }
//   //     });
//   //   });

//   //   console.log(formData);

//   //   try {
//   //     const companyId = document.getElementById("companyId").value;
      
//   //     await Promise.all(filePromises);
//   //     const response = await fetch("/api/companies/update/" + companyId, {
//   //       method: "POST",
//   //       headers: {
//   //         "Content-Type": "application/json",
//   //       },
//   //       credentials: 'include',
//   //       body: JSON.stringify(formData),
//   //     });

//   //     if (!response.ok) {
//   //       throw new Error(`HTTP error! status: ${response.status}`);
//   //     }

//   //     const data = await response.json();
//   //     // Χειρισμός της επιτυχούς απόκρισης
//   //     if (data.success) {
//   //       Swal.fire({
//   //         icon: "success",
//   //         title: "Επιτυχής ενημέρωση των αρχείων:",
//   //         timer: 1500,
//   //         confirmButtonText: "Κλείσιμο",
//   //         customClass: {
//   //           title: 'custom-title',
//   //           popup: "custom-swal-popup",
//   //           confirmButton: "class-success custom-confirm-button custom-swal-button",
//   //         },
//   //       }).then(() => {
//   //         window.location.href = data.redirectUrl;
//   //       });
//   //     }
//   //   } catch (error) {
//   //     console.error("Σφάλμα:", error);
//   //   }
//   // }

//     async function handleFormSubmit(event) {
//         event.preventDefault();
//         event.stopPropagation();

//         const formData = {};
//         const filePromises = [];

//         document.querySelectorAll(".card-body").forEach((section) => {
//             section.querySelectorAll("input, select, textarea").forEach((input) => {
//                 if (input.tagName === "INPUT") {
//                     if (input.type === "checkbox") {
//                         formData[input.name] = input.checked;
//                     } else if (input.type === "file") {
//                         if (input.files.length > 0) {
//                             filePromises.push(new Promise((resolve, reject) => {
//                                 const reader = new FileReader();
//                                 reader.onload = (e) => { formData[input.name] = e.target.result; resolve(); };
//                                 reader.onerror = reject;
//                                 reader.readAsDataURL(input.files[0]);
//                             }));
//                         }
//                     } else {
//                         formData[input.name] = input.value;
//                     }
//                 } else if (input.tagName === "TEXTAREA") {
//                     formData[input.name] = input.value;
//                 } else if (input.tagName === "SELECT") {
//                     if (input.multiple) {
//                         formData[input.name] = Array.from(input.selectedOptions).map(o => o.value);
//                     } else {
//                         formData[input.name] =
//                         input.selectedIndex === -1 ? null : input.options[input.selectedIndex].value;
//                     }
//                 }
//             });
//         });

//         try {
//             const companyId = document.getElementById("companyId").value;
//             const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

//             await Promise.all(filePromises);

//             const response = await fetch(`/api/companies/update/${companyId}`, {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                     "CSRF-Token": csrfToken,          // ✅ για csurf
//                 },
//                 credentials: "include",             // ✅ στείλε session cookies
//                 // redirect: "follow",              // default (μην το αλλάζεις σε manual)
//                 body: JSON.stringify(formData),
//             });

//             // 1) αν ο browser ακολούθησε redirect
//             if (response.redirected && response.url) {
//                 window.location.href = response.url;
//                 return;
//             }

//             // 2) αν είναι 3xx (σε ορισμένα περιβάλλοντα μπορεί να μείνει ως έχει)
//             if (response.status >= 300 && response.status < 400) {
//                 const loc = response.headers.get("Location") || response.headers.get("location");
//                 if (loc) {
//                     const abs = loc.startsWith("http") ? loc : new URL(loc, window.location.origin).toString();
//                     window.location.href = abs;
//                     return;
//                 }
//                 throw new Error(`Redirect ${response.status} χωρίς Location header`);
//             }

//             // 3) 403 από CSRF
//             if (response.status === 403) {
//                 throw new Error("CSRF blocked (403) — η συνεδρία έληξε ή λείπει token.");
//             }

//             // 4) 204 No Content → δικό μας redirect
//             if (response.status === 204) {
//                 Swal.fire({ icon: "success", title: "Επιτυχής ενημέρωση", timer: 1200, showConfirmButton: false })
//                     .then(() => window.location.href = `/companies/genikastoixeia/edit/${companyId}`);
//                 return;
//             }

//             // 5) JSON απάντηση
//             const ct = response.headers.get("content-type") || "";
//             if (ct.includes("application/json")) {
//                 const data = await response.json();
//                 if (!response.ok || !data?.success) {
//                     throw new Error(`HTTP ${response.status} / success=${data?.success}`);
//                 }
//                 Swal.fire({ icon: "success", title: "Επιτυχής ενημέρωση", timer: 1200, showConfirmButton: false })
//                     .then(() => window.location.href = data.redirectUrl || `/companies/genikastoixeia/edit/${companyId}`);
//                 return;
//             }

//             // 6) Άλλος content-type αλλά ok
//             if (response.ok) {
//                 Swal.fire({ icon: "success", title: "Επιτυχής ενημέρωση", timer: 1200, showConfirmButton: false })
//                     .then(() => window.location.href = `/companies/genikastoixeia/edit/${companyId}`);
//                 return;
//             }

//             // 7) Σφάλμα HTTP
//                 throw new Error(`HTTP error ${response.status}`);

//         } catch (err) {
//             console.error("Σφάλμα:", err);
//             Swal.fire({
//                 icon: "error",
//                 title: "Αποτυχία αποθήκευσης",
//                 text: String(err?.message || err),
//             });
//         }
//     };
// });
