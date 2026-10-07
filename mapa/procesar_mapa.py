# Genera los recursos del mapa a partir de los datos HiRISE (NASA/JPL/UArizona)
#   - victoria_height.bin / .png : alturas 512x512 (Uint16), bordes suavizados a una altura constante
#   - victoria_color.jpg        : textura teñida, bordes fundidos al color del plano exterior
#   - victoria_info.json        : escala, alturas y color del borde
# Uso: python procesar_mapa.py
import json, os, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

DTM   = 'heightmap_DTEEC_021747_1780_022380_1780_U01.IMG'
ORTHO_A = 'ESP_021747_1780_RED_A_01_ORTHO.JP2'           # 0.25 m/px (si existe)
ORTHO_C = 'textura_ESP_021747_1780_RED_C_01_ORTHO.JP2'   # 1 m/px (misma rejilla que el DTM)
FILAS, COLS, OFF = 13332, 6757, 27028
CR, CC, N = 7119, 2218, 1024          # centro del crater y lado del recorte en pixeles del DTM
R0, C0 = CR - N//2, CC - N//2
TAM, TEX = 512, 2048                   # heightmap y textura de salida
BORDE = 0.10                           # fraccion del lado que se funde con el exterior

def rampa(n):
    # 0 en el borde -> 1 hacia dentro (smoothstep)
    i = np.arange(n) + 0.5
    d = np.minimum(i, n - i) / (BORDE * n)
    t = np.clip(d, 0, 1)
    r = t * t * (3 - 2 * t)
    return np.minimum.outer(r, r)

# ---- Alturas ----
d = np.memmap(DTM, dtype='<f4', mode='r', offset=OFF, shape=(FILAS, COLS))
h = np.array(d[R0:R0+N, C0:C0+N], dtype=np.float64)
h = h.reshape(TAM, N//TAM, TAM, N//TAM).mean(axis=(1, 3))
anillo = np.ones_like(h, bool); anillo[3:-3, 3:-3] = False
h_borde = np.median(h[anillo])
w = rampa(TAM)
h = h_borde + (h - h_borde) * w
lo, hi = h.min(), h.max()
n = (h - lo) / (hi - lo)
np.round(n * 65535).astype('<u2').tofile('victoria_height.bin')
Image.fromarray(np.round(n * 255).astype(np.uint8)).save('victoria_height.png')

# ---- Textura ----
if os.path.exists(ORTHO_A):
    im = Image.open(ORTHO_A)
    im.reduce = 1                      # decodifica a 0.5 m/px para ahorrar memoria
    im.load()
    f = im.size[0] / COLS              # pixeles de la ortoimagen por pixel del DTM
    g = im.crop((round(C0*f), round(R0*f), round((C0+N)*f), round((R0+N)*f)))
    fuente = ORTHO_A
else:
    g = Image.open(ORTHO_C).crop((C0, R0, C0+N, R0+N))
    fuente = ORTHO_C
g = np.asarray(g.resize((TEX, TEX), Image.LANCZOS)).astype(np.float64)
p1, p99 = np.percentile(g[g > 0], [1, 99])
g = np.clip((g - p1) / (p99 - p1), 0, 1)
Image.fromarray((g * 255).astype(np.uint8)).save('victoria_gris.jpg', quality=90)
oscuro, claro = np.array([60, 28, 16]), np.array([235, 175, 130])
rgb = oscuro + (claro - oscuro) * g[..., None]
wt = rampa(TEX)[..., None]
banda = (wt[..., 0] < 1) | (rampa(TEX) < 1)     # franja exterior del mapa (llano)
c_borde = np.median(rgb[banda], axis=0)          # color medio del llano
rgb = c_borde + (rgb - c_borde) * wt
Image.fromarray(np.round(rgb).astype(np.uint8)).save('victoria_color.jpg', quality=90)

hexcol = '#%02x%02x%02x' % tuple(int(round(v)) for v in c_borde)
info = {"size": TAM, "textura": TEX, "metros_por_pixel": 2.0237, "ancho_metros": round(TAM*2.0237, 1),
        "altura_min_m": round(lo, 2), "altura_max_m": round(hi, 2), "desnivel_m": round(hi-lo, 2),
        "altura_borde_normalizada": round((h_borde-lo)/(hi-lo), 4), "color_borde": hexcol,
        "bin": "Uint16 little-endian, fila a fila (norte arriba); altura = min + v/65535*desnivel",
        "fuente": DTM + " / " + fuente + " (NASA/JPL/UArizona)"}
json.dump(info, open('victoria_info.json', 'w'), indent=2, ensure_ascii=False)
print(json.dumps(info, indent=2, ensure_ascii=False))
