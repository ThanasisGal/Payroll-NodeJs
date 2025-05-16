// server/utils/formatNumber.js
export default function formatNumber(number, totalLength) {
  return number.toString().padStart(totalLength, '0');
}
