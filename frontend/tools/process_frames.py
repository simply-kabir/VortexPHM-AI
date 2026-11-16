"""Usage: python process_frames.py <dir with ezgif-frame-001.jpg ...> <out dir, e.g. ../public/engine-seq>
Removes the static corner watermark (inpainting), trims static head/tail frames, resizes, writes WebP sets.
Requires: pip install opencv-python-headless pillow numpy"""
import glob, os, sys
import cv2, numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(os.path.join(src, "*.jpg")))
assert len(files) >= 100, "expected the numbered frame sequence"
for k in ("d", "m"): os.makedirs(os.path.join(out, k), exist_ok=True)

# watermark = bright blob that is present in every frame (temporal minimum) inside this region of the 1920x1080 frame
x0, y0, x1, y1 = 1640, 800, 1840, 1000
stack = np.stack([cv2.cvtColor(cv2.imread(f)[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY) for f in files[::5]]).astype(np.float32)
bg = cv2.GaussianBlur(np.median(stack, 0), (0, 0), 20)
mask = cv2.dilate(((stack.min(0) - bg) > 16).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

def clean(img):
    img[y0:y1, x0:x1] = cv2.inpaint(img[y0:y1, x0:x1].copy(), mask * 255, 7, cv2.INPAINT_TELEA)
    return img

START, END = 8, 285                                   # static head/tail trimmed
pick = lambda n: [int(round(v)) for v in np.linspace(START, END, n)]
for key, (idxs, size, q) in {"d": (pick(120), (1280, 720), 70), "m": (pick(80), (854, 480), 66)}.items():
    for k, i in enumerate(idxs, start=1):
        img = clean(cv2.imread(files[i - 1]))
        Image.fromarray(cv2.cvtColor(cv2.resize(img, size, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)).save(
            os.path.join(out, key, f"f{k:03d}.webp"), "WEBP", quality=q, method=6)
poster = clean(cv2.imread(files[START - 1]))
Image.fromarray(cv2.cvtColor(cv2.resize(poster, (1280, 720), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)).save(
    os.path.join(out, "poster.webp"), "WEBP", quality=80, method=6)
print("done; update count in src/lib/sequence.ts if you change the frame numbers")
