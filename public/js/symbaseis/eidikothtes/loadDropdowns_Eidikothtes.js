// document.addEventListener("DOMContentLoaded", function () {
//   const symbaseisDropdown = document.getElementById("symbash");
//   const kathgoriesSymbaseonDropdown = document.getElementById("kathgoria_symbashs");

//   const loadSymbaseis = async () => {
//     symbaseisDropdown.innerHTML = '<option value="" selected></option>';
//     document.getElementById("add-btn").href = "#";
//     document.getElementById("selectedSymbash").value = null;
//     try {
//       const response = await fetch("/api/symbaseis");
//       const data = await response.json();

//       let textToConvert
//       data.forEach((symbash) => {
//         textToConvert = removeGreekAccentsAndToUpper(symbash.perigrafh);
//         const option = new Option(symbash.kodikos.padEnd(10, '\u00A0') + textToConvert, symbash.kodikos);
//         symbaseisDropdown.appendChild(option);
//       });
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   var kodikosSymbashs, kodikosKathgorias;

//   // Change event listener for 'symbaseis' dropdown
//   symbaseisDropdown.addEventListener("change", async () => {
//     const selectedSymbash = symbaseisDropdown.value;
//     kodikosSymbashs = selectedSymbash;
//     kathgoriesSymbaseonDropdown.innerHTML = '<option value="" selected></option>';
//     kathgoriesSymbaseonDropdown.disabled = true;

//     if (selectedSymbash) {
//       try {
//         const response = await fetch( `/api/kathgoriesSymbaseon/${selectedSymbash}` );
//         const data = await response.json();

//         data.forEach((kathgoriaSymbashs) => {
//           const option = new Option(kathgoriaSymbashs.kodikos.padEnd(10,'\u00A0') + kathgoriaSymbashs.perigrafh, kathgoriaSymbashs.kodikos);
//           kathgoriesSymbaseonDropdown.appendChild(option);
//         });

//         kathgoriesSymbaseonDropdown.disabled = false;
//       } catch (error) {
//         console.error(error);
//       }
//     }
//   });

//   kathgoriesSymbaseonDropdown.addEventListener("change", async () => {
//     const myTableBody = document.querySelector("#myTable tbody");
//     myTableBody.innerHTML = ''; // Καθαρισμός προηγούμενων κατηγοριών

//     const selectedKathgoriaId = kathgoriesSymbaseonDropdown.value;
//     document.getElementById("selectedSymbash").value = kodikosSymbashs;
//     document.getElementById("selected_Symbash").value = kodikosSymbashs;
//     document.getElementById("selectedKathgoria").value = selectedKathgoriaId;
//     document.getElementById("selected_Kathgoria").value = selectedKathgoriaId;
//     document.getElementById("add-btn").href = `/symbaseis/eidikothtes/add/${kodikosSymbashs}${ selectedKathgoriaId}`;

//     if (selectedKathgoriaId) {
//       try {
//         const response = await fetch(`/api/symbaseis/eidikothtes/${kodikosSymbashs}${selectedKathgoriaId}`, {
//           headers: {
//             'Accept': 'application/json',
//           }
//         });
//         if (!response.ok) throw new Error("Σφάλμα κατά τη φόρτωση των ειδικοτήτων συμβάσεων");

//         const eidikothtes = await response.json();
      
//         if (eidikothtes.length === 0) {
//           myTableBody.innerHTML = '<tr><td colspan="2" class="records-not-found">Δεν βρέθηκαν εγγραφές.</td></tr>';
//         } else {
//           if (eidikothtes && Array.isArray(eidikothtes.eidikothtesSymbaseon)) { // Ελέγχει αν το eidikothtes.eidikothtesSymbaseon είναι πίνακας
//             eidikothtes.eidikothtesSymbaseon.forEach(eidikothta => {
//               const row = `<tr class="input-content-regular" data-id="${eidikothta._id}">
//                             <td class="col-1">${eidikothta.kodikos}</td>
//                             <td class="col-11">${eidikothta.perigrafh}</td>
//                           </tr>`;
//               myTableBody.innerHTML += row;
//             });
//           } else {
//             console.error('Τα δεδομένα δεν είναι στην αναμενόμενη μορφή');
//           }
//         }
//       } catch (error) {
//         console.error(error);
//         myTableBody.innerHTML = '<tr><td colspan="2" class="records-not-found">Σφάλμα κατά τη φόρτωση.</td></tr>';
//       }
//     };
//   });

//   loadSymbaseis();
// });

// function removeGreekAccentsAndToUpper(text) {
//   const mapping = {
//       'ά': 'Α', 'έ': 'Ε', 'ή': 'Η', 'ί': 'Ι', 'ό': 'Ο', 'ύ': 'Υ', 'ώ': 'Ω',
//       'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
//       'ϊ': 'Ι', 'ΐ': 'Ι', 'ϋ': 'Υ', 'ΰ': 'Υ', 'Ϊ': 'Ι', 'Ϋ': 'Υ'
//   };

//   return text.split('').map(function(char) {
//       return mapping[char] || char;
//   }).join('').toUpperCase();
// }
