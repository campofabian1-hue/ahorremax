const groups = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function parsePesoInput(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return NaN;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : NaN;
}

export function formatPesoInput(value) {
  const amount = parsePesoInput(value);
  return Number.isNaN(amount) ? '' : `$ ${groups.format(amount)}`;
}

export function formatPesoField(input) {
  const start = input.selectionStart ?? input.value.length;
  const digitsBeforeCursor = input.value.slice(0, start).replace(/[^0-9]/g, '').length;
  input.value = formatPesoInput(input.value);
  if (document.activeElement === input) {
    let position = input.value.length;
    if (digitsBeforeCursor === 0) position = input.value.startsWith('$ ') ? 2 : 0;
    else {
      let seen = 0;
      for (let i = 0; i < input.value.length; i++) {
        if (/[0-9]/.test(input.value[i])) seen++;
        if (seen === digitsBeforeCursor) { position = i + 1; break; }
      }
    }
    input.setSelectionRange(position, position);
  }
}
