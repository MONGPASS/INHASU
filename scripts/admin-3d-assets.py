"""Export the licensed admin icon selections from locally downloaded originals.

Mechanical export only: fixed rectangle crops, existing PSD-layer transparency,
an omitted AI page-backdrop shape, proportional resizing, and WebP encoding.
Original licensed source files are never copied into the public directory.

Usage: python scripts/admin-3d-assets.py --source-dir /path/to/private/downloads
Requires Pillow, psd-tools, and PyMuPDF. For an isolated installation, pass
--python-deps work/admin-3d-assets/python-deps.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
CANVAS = 192
ARTWORK = 180
# Rectangles were inspected on the 1100 x 607 office-set preview. They include
# each whole icon, pen, stand, handle, rays, and original shadows.
OFFICE_RECTS = {
    "reservation": (84, 65, 290, 275),
    "achievement": (344, 63, 534, 274),
    "dashboard": (590, 63, 811, 275),
    "target": (855, 63, 1045, 275),
    "customer": (80, 343, 270, 542),
    "message": (329, 343, 526, 545),
    "idea": (567, 332, 818, 550),
    "calendar": (854, 343, 1035, 542),
}
TRAVEL_GROUPS = {"travelers": "1", "flight": "2", "travel": "3", "route": "4"}


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path.home() / "Downloads")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "public/assets/admin-3d")
    parser.add_argument("--python-deps", type=Path, default=ROOT / "work/admin-3d-assets/python-deps")
    return parser.parse_args()


def main():
    args = arguments()
    if args.python_deps.is_dir():
        sys.path.insert(0, str(args.python_deps))
    from PIL import Image
    from psd_tools import PSDImage
    import pymupdf

    args.output_dir.mkdir(parents=True, exist_ok=True)
    results = []

    def save(key, image, *, alpha):
        image = image.convert("RGBA" if alpha else "RGB")
        if alpha:
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty artwork: {key}")
            image = image.crop(bounds)
        image.thumbnail((ARTWORK, ARTWORK), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA" if alpha else "RGB", (CANVAS, CANVAS), (0, 0, 0, 0) if alpha else "white")
        position = ((CANVAS - image.width) // 2, (CANVAS - image.height) // 2)
        if alpha:
            canvas.alpha_composite(image, position)
        else:
            canvas.paste(image, position)
        destination = args.output_dir / f"{key}.webp"
        canvas.save(destination, "WEBP", quality=88, method=6, exact=True)
        with Image.open(destination) as check:
            assert check.size == (CANVAS, CANVAS)
            assert (check.mode == "RGBA") == alpha
        results.append((key, destination.stat().st_size, alpha))

    office = Image.open(args.source_dir / "td02480000831.jpg")
    if office.size != (8100, 4469):
        raise ValueError(f"Unexpected office original size: {office.size}")
    for key, rectangle in OFFICE_RECTS.items():
        box = tuple(round(value * office.size[index % 2] / (1100 if index % 2 == 0 else 607)) for index, value in enumerate(rectangle))
        save(key, office.crop(box), alpha=False)

    travel = PSDImage.open(args.source_dir / "ta0336a0305.psd")
    if travel.size != (10000, 2488):
        raise ValueError(f"Unexpected travel original size: {travel.size}")
    for key, name in TRAVEL_GROUPS.items():
        layer = next(layer for layer in travel if layer.name == name and layer.kind == "group")
        save(key, layer.composite(), alpha=True)

    vehicle = PSDImage.open(args.source_dir / "ti436a47512.psd")
    if vehicle.size != (7441, 2280):
        raise ValueError(f"Unexpected vehicle original size: {vehicle.size}")
    # Match the inspected car layer by its fixed rectangle, independent of the
    # source PSD's legacy-encoded group names. Other illustrations are excluded.
    vehicle_layer = next(layer for group in vehicle if group.kind == "group" for layer in group if layer.bbox == (329, 780, 1937, 1655))
    save("vehicle", vehicle_layer.composite(), alpha=True)

    hotel_pdf = pymupdf.open(args.source_dir / "ti013a33602.ai")
    page = hotel_pdf[0]
    stream_id = page.get_contents()[0]
    stream = hotel_pdf.xref_stream(stream_id)
    backdrop = b"42.396 799.973 518.917 -518.917 re\nf\n"
    if stream.count(backdrop) != 1:
        raise ValueError("Hotel AI page-backdrop shape no longer matches the inspected original")
    # Omit only the original solid page-backdrop rectangle, as when exporting
    # with a background layer hidden. This does not remove pixels or alter the
    # hotel/passport illustration. The private AI file remains untouched.
    hotel_pdf.update_stream(stream_id, stream.replace(backdrop, backdrop[:-2] + b"n\n"))
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(4, 4), clip=pymupdf.Rect(82, 166, 197, 298), alpha=True)
    save("hotel", Image.open(BytesIO(pixmap.tobytes("png"))), alpha=True)
    hotel_pdf.close()

    payment_pdf = pymupdf.open(args.source_dir / "ti367a44202 (4).ai")
    page = payment_pdf[0]
    stream_id = page.get_contents()[0]
    stream = payment_pdf.xref_stream(stream_id)
    backdrop = b"0 0 1127.19 1007.957 re\nf\n"
    if stream.count(backdrop) != 1:
        raise ValueError("Payment AI page-backdrop shape no longer matches the inspected original")
    payment_pdf.update_stream(stream_id, stream.replace(backdrop, backdrop[:-2] + b"n\n"))
    # Upper-middle wallet, banknotes, and won coin; no neighboring objects.
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(463, 253, 739, 509), alpha=True)
    save("payment", Image.open(BytesIO(pixmap.tobytes("png"))), alpha=True)
    payment_pdf.close()

    for key, size, alpha in results:
        print(f"{key:12} {size:6} bytes  {'alpha' if alpha else 'white background'}")
    print(f"TOTAL {len(results)} icons, {sum(size for _, size, _ in results):,} bytes")


if __name__ == "__main__":
    main()
