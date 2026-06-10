import cv2
import numpy as np

img = np.zeros((512, 512, 3), dtype=np.uint8)
img[200:300, 200:300] = [0, 0, 255] # Red square
img[200:300, 300:400] = [255, 0, 0] # Blue square

mask = np.ones((512, 512), dtype=np.uint8) * 255
mask[200:300, 200:400] = 0

inpainted = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
cv2.imwrite('test_telea.png', inpainted)
