/**
 * Image preprocessing utilities for wine label analysis
 */

/**
 * Optimized image resize for wine label OCR and vision analysis
 * Max 1600px on longest side, JPEG quality 0.8
 */
export async function resizeImage(
  imageData: string,
  maxDimension: number = 1600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      let width = img.width;
      let height = img.height;

      // Calculate new dimensions (max 1600px on longest side)
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with quality 0.8
      const resizedData = canvas.toDataURL('image/jpeg', 0.8);
      resolve(resizedData);
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

/**
 * Apply EXIF rotation to image
 * Note: Modern browsers handle EXIF rotation automatically for most cases
 */
export async function fixOrientation(imageData: string): Promise<string> {
  // For now, we'll rely on browser's automatic EXIF handling
  // If needed, we can add exif-js library for manual rotation
  return imageData;
}

/**
 * Preprocess image: fix orientation, resize to 1600px, compress to JPEG 0.8
 */
export async function preprocessImage(imageData: string): Promise<string> {
  const oriented = await fixOrientation(imageData);
  const resized = await resizeImage(oriented, 1600);
  return resized;
}
