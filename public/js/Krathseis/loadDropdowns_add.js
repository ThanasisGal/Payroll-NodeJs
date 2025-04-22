const fiveSpaces = "\u00A0".repeat(5);
const sevenSpaces = "\u00A0".repeat(7);
const nineSpaces = "\u00A0".repeat(9);
const tenSpaces = "\u00A0".repeat(10);

document.addEventListener("DOMContentLoaded", function () {
  const tameiaDropdown = document.getElementById("kodikos_tameioy_h");

  const loadTameia = async () => {
    tameiaDropdown.innerHTML = '<option value="" selected></option>';
    try {
      const response = await fetch("/api/tameia");
      const data = await response.json();
      data.forEach((tameia) => {
        const option = new Option(
          tameia.perigrafh,
          tameia.kodikos
        );
        tameiaDropdown.appendChild(option);
      });
    } catch (error) {
      console.error(error);
    }
  };
  
  loadTameia();

});
