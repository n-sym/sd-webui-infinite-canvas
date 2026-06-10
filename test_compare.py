import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

def distance_based_blur_fill(image: Image.Image, mask: Image.Image) -> Image.Image:
    img_arr = np.array(image)
    mask_arr = np.array(mask.convert("L"))
    binary_mask = (mask_arr > 127).astype(np.uint8)
    
    dist, indices = distance_transform_edt(binary_mask, return_indices=True)
    max_dist = np.max(dist)
    if max_dist == 0:
        return image
        
    extended_arr = img_arr[indices[0], indices[1], :]
    
    blur_levels = 8
    blurred_stack = [extended_arr]
    current_blur = extended_arr
    for _ in range(1, blur_levels):
        current_blur = cv2.GaussianBlur(current_blur, (21, 21), 0)
        blurred_stack.append(current_blur)
        
    norm_dist = (dist / max(100.0, max_dist)) * (blur_levels - 1)
    norm_dist = np.clip(norm_dist, 0, blur_levels - 1.001)
    
    idx_lower = np.floor(norm_dist).astype(np.int32)
    idx_upper = idx_lower + 1
    weight_upper = norm_dist - idx_lower
    weight_lower = 1.0 - weight_upper
    
    w_l = weight_lower[..., np.newaxis]
    w_u = weight_upper[..., np.newaxis]
    
    stack_arr = np.array(blurred_stack)
    H, W = binary_mask.shape
    y_grid, x_grid = np.mgrid[0:H, 0:W]
    
    lower_imgs = stack_arr[idx_lower, y_grid, x_grid, :]
    upper_imgs = stack_arr[idx_upper, y_grid, x_grid, :]
    
    blended = lower_imgs * w_l + upper_imgs * w_u
    blended = blended.astype(np.uint8)
    
    valid_mask = (1 - binary_mask)[..., np.newaxis]
    final_arr = img_arr * valid_mask + blended * binary_mask[..., np.newaxis]
    
    return Image.fromarray(final_arr)

def telea_fill(image: Image.Image, mask: Image.Image) -> Image.Image:
    img_arr = np.array(image)
    mask_arr = np.array(mask.convert("L"))
    binary_mask = (mask_arr > 127).astype(np.uint8) * 255
    inpainted = cv2.inpaint(img_arr, binary_mask, 3, cv2.INPAINT_TELEA)
    return Image.fromarray(inpainted)

img = np.zeros((256, 256, 3), dtype=np.uint8)
img[100:156, 100:156] = np.random.randint(0, 255, (56, 56, 3), dtype=np.uint8)
img_pil = Image.fromarray(img)
mask_arr = np.ones((256, 256), dtype=np.uint8) * 255
mask_arr[100:156, 100:156] = 0
mask_pil = Image.fromarray(mask_arr)

d_blur = distance_based_blur_fill(img_pil, mask_pil)
t_blur = telea_fill(img_pil, mask_pil)

d_blur.save("test_d_blur.png")
t_blur.save("test_t_blur.png")
