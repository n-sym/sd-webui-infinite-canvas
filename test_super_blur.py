import cv2
import numpy as np
from PIL import Image

def distance_based_blur_fill(image: Image.Image, mask: Image.Image) -> Image.Image:
    img_arr = np.array(image)
    mask_arr = np.array(mask.convert("L"))
    binary_mask = (mask_arr > 0).astype(np.uint8) * 255
    
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary_mask = cv2.dilate(binary_mask, kernel)
    
    inpainted = cv2.inpaint(img_arr, binary_mask, 3, cv2.INPAINT_TELEA)
    
    blurred = cv2.GaussianBlur(inpainted, (63, 63), 0)
    
    valid_mask = (1 - (binary_mask / 255.0))[..., np.newaxis]
    final_arr = inpainted * valid_mask + blurred * (binary_mask / 255.0)[..., np.newaxis]
    final_arr = final_arr.astype(np.uint8)
    
    return Image.fromarray(final_arr)

img = np.zeros((256, 256, 3), dtype=np.uint8)
img[100:156, 100:156] = np.random.randint(0, 255, (56, 56, 3), dtype=np.uint8)
img_pil = Image.fromarray(img)
mask_arr = np.ones((256, 256), dtype=np.uint8) * 255
mask_arr[100:156, 100:156] = 0
mask_pil = Image.fromarray(mask_arr)

result = distance_based_blur_fill(img_pil, mask_pil)
result.save("test_super_blur.png")
