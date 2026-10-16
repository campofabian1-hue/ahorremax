// Crop a user-supplied image to the fixed dream-photo frame without stretching it.
export function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight, positionX = 50, positionY = 50) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(value => Number.isFinite(value) && value > 0)) throw new Error('No se pudo leer el tamaño de la foto.');
  const x = Math.min(100, Math.max(0, Number(positionX) || 0)) / 100;
  const y = Math.min(100, Math.max(0, Number(positionY) || 0)) / 100;
  const ratio = targetWidth / targetHeight;
  if (sourceWidth / sourceHeight > ratio) {
    const width = sourceHeight * ratio;
    return { sx: (sourceWidth - width) * x, sy: 0, sw: width, sh: sourceHeight };
  }
  const height = sourceWidth / ratio;
  return { sx: 0, sy: (sourceHeight - height) * y, sw: sourceWidth, sh: height };
}

export async function optimizeDreamPhoto(image, positionX = 50, positionY = 50) {
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 576;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este dispositivo no pudo preparar la foto.');
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, positionX, positionY);
  context.fillStyle = '#eee8f5';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.84, 0.72, 0.58, 0.44]) {
    const result = canvas.toDataURL('image/jpeg', quality);
    if (result.length <= 450000) return result;
  }
  throw new Error('La foto sigue siendo demasiado grande. Prueba con otra imagen.');
}
