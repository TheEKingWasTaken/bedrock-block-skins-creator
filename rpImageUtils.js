// rpImageUtils.js
// Shared image/skin generation helpers for resource-pack processing.

export async function isBlobSemiTransparent(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 0 && alpha < 255) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export function generateUniformCubeSkinFromBlockTextureBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        const baseSize = 16;
        const temp16 = document.createElement('canvas');
        temp16.width = baseSize;
        temp16.height = baseSize;
        const tctx = temp16.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.clearRect(0, 0, baseSize, baseSize);
        tctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, baseSize, baseSize);

        const baseImg = new Image();
        baseImg.onload = () => {
          const outCanvas = document.createElement('canvas');
          outCanvas.width = 128;
          outCanvas.height = 128;
          const outCtx = outCanvas.getContext('2d');
          outCtx.imageSmoothingEnabled = false;
          outCtx.clearRect(0, 0, 128, 128);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 16;
          tempCanvas.height = 16;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.imageSmoothingEnabled = false;

          // Bottom: (16, 0)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.drawImage(baseImg, 0, 0, 16, 16);
          outCtx.drawImage(tempCanvas, 16, 0);

          // Top: rotate 180° + flip horizontally, (32, 0)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.translate(8, 8);
          tempCtx.rotate(Math.PI);
          tempCtx.scale(-1, 1);
          tempCtx.drawImage(baseImg, -8, -8, 16, 16);
          tempCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.drawImage(tempCanvas, 32, 0);

          // Left: rotate 180°, (0, 16)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.translate(8, 8);
          tempCtx.rotate(Math.PI);
          tempCtx.drawImage(baseImg, -8, -8, 16, 16);
          tempCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.drawImage(tempCanvas, 0, 16);

          // Front: rotate 180°, (16, 16)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.translate(8, 8);
          tempCtx.rotate(Math.PI);
          tempCtx.drawImage(baseImg, -8, -8, 16, 16);
          tempCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.drawImage(tempCanvas, 16, 16);

          // Right: rotate 180°, (32, 16)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.translate(8, 8);
          tempCtx.rotate(Math.PI);
          tempCtx.drawImage(baseImg, -8, -8, 16, 16);
          tempCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.drawImage(tempCanvas, 32, 16);

          // Back: rotate 180°, (48, 16)
          tempCtx.clearRect(0, 0, 16, 16);
          tempCtx.translate(8, 8);
          tempCtx.rotate(Math.PI);
          tempCtx.drawImage(baseImg, -8, -8, 16, 16);
          tempCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.drawImage(tempCanvas, 48, 16);

          outCanvas.toBlob((outBlob) => {
            if (!outBlob) {
              reject(new Error('Failed to generate skin blob'));
              return;
            }
            resolve(outBlob);
          }, 'image/png');
        };
        baseImg.onerror = reject;
        baseImg.src = temp16.toDataURL('image/png');
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function loadBlobAs16Image(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const baseSize = 16;
      const canvas = document.createElement('canvas');
      canvas.width = baseSize;
      canvas.height = baseSize;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, baseSize, baseSize);
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, baseSize, baseSize);

      const outImg = new Image();
      outImg.onload = () => resolve(outImg);
      outImg.onerror = reject;
      outImg.src = canvas.toDataURL('image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export async function generateCubeSkinFromFaceBlobs(faceBlobs) {
  const [topImg, bottomImg, leftImg, frontImg, rightImg, backImg] = await Promise.all([
    loadBlobAs16Image(faceBlobs.top),
    loadBlobAs16Image(faceBlobs.bottom),
    loadBlobAs16Image(faceBlobs.left),
    loadBlobAs16Image(faceBlobs.front),
    loadBlobAs16Image(faceBlobs.right),
    loadBlobAs16Image(faceBlobs.back)
  ]);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = 128;
  outCanvas.height = 128;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  outCtx.clearRect(0, 0, 128, 128);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 16;
  tempCanvas.height = 16;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.imageSmoothingEnabled = false;

  // Bottom: (16, 0)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.drawImage(bottomImg, 0, 0, 16, 16);
  outCtx.drawImage(tempCanvas, 16, 0);

  // Top: rotate 180° + flip horizontally, (32, 0)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.scale(-1, 1);
  tempCtx.drawImage(topImg, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.drawImage(tempCanvas, 32, 0);

  // Left: rotate 180°, (0, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(leftImg, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.drawImage(tempCanvas, 0, 16);

  // Front: rotate 180°, (16, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(frontImg, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.drawImage(tempCanvas, 16, 16);

  // Right: rotate 180°, (32, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(rightImg, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.drawImage(tempCanvas, 32, 16);

  // Back: rotate 180°, (48, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(backImg, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  outCtx.drawImage(tempCanvas, 48, 16);

  return new Promise((resolve, reject) => {
    outCanvas.toBlob((outBlob) => {
      if (!outBlob) {
        reject(new Error('Failed to generate skin blob'));
        return;
      }
      resolve(outBlob);
    }, 'image/png');
  });
}