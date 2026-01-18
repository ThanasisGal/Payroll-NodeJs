function convertNumberLocaleToFloat(numberString, decimals) {
  return parseFloat(numberString.replace(',', '.')).toFixed(decimals);
}
