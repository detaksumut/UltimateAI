import Jimp from 'jimp';

async function makeTransparent() {
  const inputPath = 'C:\\Users\\BI News\\.gemini\\antigravity-ide\\brain\\6c1d4e1b-74d6-40f3-93c0-de7389a0d3d3\\.user_uploaded\\media_1787816977673.jpg';
  const outputPath = 'd:\\Users\\ultimateai\\public\\genie-bg.png';
  const outputPath2 = 'd:\\Users\\ultimateai\\public\\jin-hologram.png';

  const image = await Jimp.read(inputPath);

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];

    // Calculate maximum brightness / saturation of the neon color
    // The background checkerboard has very low saturation and low luminance (dark gray/black)
    // The neon lines have distinct blue/purple components (b > r && b > 40, or r > 40 with b > 50)
    
    // Check if pixel is part of dark background checkerboard
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const diff = maxVal - minVal;

    // Luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum < 22 && diff < 15) {
      // Completely dark background -> 100% transparent
      this.bitmap.data[idx + 3] = 0;
    } else if (diff < 12 && lum < 38) {
      // Dark grey checkerboard square -> transparent
      this.bitmap.data[idx + 3] = 0;
    } else {
      // It's a neon line or glow!
      // Calculate alpha proportionally so the glow transitions smoothly
      const alpha = Math.min(255, Math.round(Math.max(diff * 2.2, lum * 1.6)));
      this.bitmap.data[idx + 3] = alpha;
      
      // Boost the neon color vibrance slightly
      this.bitmap.data[idx + 0] = Math.min(255, Math.round(r * 1.25));
      this.bitmap.data[idx + 1] = Math.min(255, Math.round(g * 1.25));
      this.bitmap.data[idx + 2] = Math.min(255, Math.round(b * 1.35));
    }
  });

  await image.writeAsync(outputPath);
  await image.writeAsync(outputPath2);
  console.log('SUCCESS: Converted to pure transparent PNG at', outputPath);
}

makeTransparent().catch(console.error);
