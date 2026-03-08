const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.65;
const TARGET_SIZE = 150_000; // target ~150KB per image for localStorage friendliness

/**
 * Compress an image file using Canvas API.
 * Resizes to fit within MAX_DIMENSION on longest side and converts to JPEG.
 * If the result exceeds TARGET_SIZE, re-compresses at lower quality.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round(height * (MAX_DIMENSION / width));
            width = MAX_DIMENSION;
          } else {
            width = Math.round(width * (MAX_DIMENSION / height));
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        // Fill white background to prevent transparent areas becoming black in JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // First pass at default quality
        let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        // If still too large, progressively lower quality
        let quality = JPEG_QUALITY;
        while (dataUrl.length > TARGET_SIZE * 1.37 && quality > 0.3) {
          // 1.37 accounts for Base64 overhead (~37%)
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
