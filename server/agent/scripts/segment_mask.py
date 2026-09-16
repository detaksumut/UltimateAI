"""
segment_mask.py
Deterministic Background/Foreground Segmentation Script for JIN Image Inpainting.

Input:
  sys.argv[1]: path to input image (JPEG or PNG)
  sys.argv[2]: path to output mask image (PNG)
  sys.argv[3]: (optional) target mode: 'sky_background' (default) or 'foreground'

Output:
  8-bit grayscale PNG:
  - 0 (Black) = Protected Foreground Object (airplane, car, person, etc.)
  - 255 (White) = Inpaint Zone (Sky / Background to be repainted)
"""

import sys
import os
import math
import numpy as np
import torch
import torchvision.transforms as T
from PIL import Image, ImageFilter
import torchvision.models.segmentation as seg

def generate_mask(input_path, output_path):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    # 1. Load image and ensure RGB 512x512
    img = Image.open(input_path).convert('RGB')
    orig_w, orig_h = img.size
    img_512 = img.resize((512, 512), Image.Resampling.BILINEAR)

    # 2. Run DeepLabV3 MobileNetV3 Large
    model = seg.deeplabv3_mobilenet_v3_large(weights=seg.DeepLabV3_MobileNet_V3_Large_Weights.DEFAULT).eval()
    
    transform = T.Compose([
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    input_tensor = transform(img_512).unsqueeze(0)
    
    with torch.no_grad():
        output = model(input_tensor)['out'][0]
        preds = output.argmax(0).byte().cpu().numpy()

    # DeepLabV3 Pascal VOC classes: 0 is background, 1..20 are foreground objects
    foreground_mask = (preds > 0)
    foreground_pixels = np.sum(foreground_mask)
    total_pixels = 512 * 512

    # 3. Fallback heuristic if no VOC object was detected (e.g. landscape / mountain / building)
    # If foreground is less than 2% or more than 95% of the image, use adaptive luminance/gradient
    if foreground_pixels < (total_pixels * 0.02) or foreground_pixels > (total_pixels * 0.95):
        gray = np.array(img_512.convert('L'), dtype=np.float32)
        # Upper portion is typically sky if bright and low-variance
        h, w = gray.shape
        upper_half = gray[:int(h * 0.55), :]
        thresh = np.percentile(upper_half, 50)
        # Sky candidates: pixels brighter than median in upper region
        sky_candidate = (gray > thresh)
        # Foreground is the rest
        foreground_mask = ~sky_candidate
        # Protect lower 35% of image unconditionally
        foreground_mask[int(h * 0.65):, :] = True

    # 4. Create Inpainting Mask:
    # 0 = Protected Object (Black)
    # 255 = Inpaint Zone (White)
    inpaint_mask = np.where(foreground_mask, 0, 255).astype(np.uint8)

    # 5. Smooth and dilate slightly (feathering) to avoid harsh halo edges
    mask_pil = Image.fromarray(inpaint_mask, mode='L')
    # Slight blur for smooth transition at boundary
    mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(radius=2))

    # Resize back to original dimensions if needed
    if (orig_w, orig_h) != (512, 512):
        mask_pil = mask_pil.resize((orig_w, orig_h), Image.Resampling.BILINEAR)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    mask_pil.save(output_path, format='PNG')
    print(f"[SEGMENTATION_SUCCESS] mask={output_path} fg_ratio={(np.sum(foreground_mask) / total_pixels):.2f}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python segment_mask.py <input_image_path> <output_mask_path>")
        sys.exit(1)
    try:
        generate_mask(sys.argv[1], sys.argv[2])
    except Exception as e:
        print(f"[SEGMENTATION_ERROR] {e}", file=sys.stderr)
        sys.exit(1)
