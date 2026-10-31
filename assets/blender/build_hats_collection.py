"""
Procedural 3D Asset Builder: 12 Stylized Low-Poly Hats Collection
Faithfully matching the reference image (media_1793463456543_81da60dd.png):
Row 1:
1. hat_01_cap_blue          - Blue Baseball Cap
2. hat_02_snapback_red      - Red Snapback Cap Backwards
3. hat_03_beanie_black      - Black Ribbed Beanie / Watch Cap
4. hat_04_bucket_safari     - Beige Safari Bucket Hat with Blue Ribbon
Row 2:
5. hat_05_snapback_black_red- Black Crown with Red Visor Snapback
6. hat_06_fedora_brown      - Brown Detective Fedora with Black Ribbon
7. hat_07_straw_luffy       - Golden Straw Hat with Red Ribbon
8. hat_08_visor_green       - Green Tennis Sun Visor
Row 3:
9. hat_09_winter_pompom     - Blue Winter Beanie with Chevron & Pompom
10. hat_10_sweatband_sports - White Athletic Headband with Red Stripe
11. hat_11_crown_gold       - Golden Royal Crown with Ruby & Sapphire Gems
12. hat_12_bandana_pirate   - Black Pirate Bandana with Red Knot & Tails
"""

import bpy
import math
import os
import shutil
from mathutils import Vector, Euler, Matrix

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
ROOT_DIR = os.path.dirname(PROJECT_ROOT)

MODELS_DIR = os.path.join(ROOT_DIR, "public", "models")
ASSETS_MODELS_DIR = os.path.join(ROOT_DIR, "assets", "models")
STORE_IMG_DIR = os.path.join(ROOT_DIR, "public", "branding", "store")
SHOWCASE_DIR = os.path.join(ROOT_DIR, "assets", "previews")

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(ASSETS_MODELS_DIR, exist_ok=True)
os.makedirs(STORE_IMG_DIR, exist_ok=True)
os.makedirs(SHOWCASE_DIR, exist_ok=True)

# -------------------------------------------------------------------------
# Material Helpers (Faceted Low-Poly with Principled BSDF)
# -------------------------------------------------------------------------
def make_mat(name, hex_code, roughness=0.55, metallic=0.0, specular=0.5):
    hex_clean = hex_code.lstrip('#')
    rgb = [int(hex_clean[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*linear, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular
    return mat

mat_blue_cap    = make_mat("Mat_CapBlue",     "#2563eb", roughness=0.6)
mat_blue_dark   = make_mat("Mat_CapBlueDark", "#1d4ed8", roughness=0.6)
mat_red_cap     = make_mat("Mat_CapRed",      "#dc2626", roughness=0.6)
mat_red_dark    = make_mat("Mat_CapRedDark",  "#b91c1c", roughness=0.6)
mat_black_matte = make_mat("Mat_BlackMatte",  "#1c1917", roughness=0.65)
mat_dark_char   = make_mat("Mat_DarkCharcoal","#27272a", roughness=0.65)
mat_beanie_cuff = make_mat("Mat_BeanieCuff",  "#18181b", roughness=0.7)
mat_cream_hat   = make_mat("Mat_CreamHat",    "#ece6d8", roughness=0.6)
mat_ocean_blue  = make_mat("Mat_OceanBlue",   "#1e40af", roughness=0.5)
mat_brown_felt  = make_mat("Mat_BrownFelt",   "#6d4c41", roughness=0.65)
mat_straw_gold  = make_mat("Mat_StrawGold",   "#eab308", roughness=0.7)
mat_green_visor = make_mat("Mat_GreenVisor",  "#16a34a", roughness=0.5)
mat_white_pure  = make_mat("Mat_WhitePure",   "#f8fafc", roughness=0.5)
mat_gold_crown  = make_mat("Mat_GoldCrown",   "#f59e0b", roughness=0.3, metallic=0.75, specular=0.8)
mat_ruby_gem    = make_mat("Mat_RubyGem",     "#e11d48", roughness=0.1, metallic=0.1, specular=1.0)
mat_sapphire    = make_mat("Mat_SapphireGem", "#2563eb", roughness=0.1, metallic=0.1, specular=1.0)

# Helper to create mesh object and ensure faceted flat shading
def create_mesh_obj(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

# -------------------------------------------------------------------------
# Hat 1: Blue Baseball Cap
# -------------------------------------------------------------------------
def build_hat_01_cap_blue():
    # Dome crown
    SEGS = 12
    R = 0.27
    verts, faces = [], []
    rings = [
        (0.001, 0.22), # Apex
        (0.12,  0.20),
        (0.22,  0.15),
        (0.27,  0.07),
        (0.27,  0.00),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            v1 = r * SEGS + s
            v2 = (r + 1) * SEGS + s
            v3 = (r + 1) * SEGS + s_next
            v4 = r * SEGS + s_next
            faces.append((v1, v2, v3, v4))
    crown = create_mesh_obj("Hat01_Crown", verts, faces, mat_blue_cap)

    # Curved forward visor (facing -Y)
    V_SEGS = 7
    v_verts, v_faces = [], []
    a_start = math.radians(-150)
    a_end   = math.radians(-30)
    for s in range(V_SEGS + 1):
        t = s / V_SEGS
        ang = a_start + (a_end - a_start) * t
        arch = math.sin(t * math.pi)
        r_inner = 0.27
        r_outer = 0.27 + 0.16 * (0.4 + 0.6 * arch)
        z_in = 0.01 + 0.02 * arch
        z_out = -0.06 - 0.04 * arch
        v_verts.append((r_inner * math.cos(ang), r_inner * math.sin(ang), z_in))
        v_verts.append((r_outer * math.cos(ang), r_outer * math.sin(ang), z_out))
    for s in range(V_SEGS):
        i1 = 2 * s
        i2 = 2 * (s + 1)
        v_faces.append((i1, i1 + 1, i2 + 1, i2))
    visor = create_mesh_obj("Hat01_Visor", v_verts, v_faces, mat_blue_cap)

    # Top button
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.025, vertices=8, location=(0, 0, 0.225))
    btn = bpy.context.active_object
    btn.name = "Hat01_Button"
    btn.data.materials.append(mat_blue_dark)
    for p in btn.data.polygons: p.use_smooth = False

    return [crown, visor, btn]

# -------------------------------------------------------------------------
# Hat 2: Red Snapback Cap Backwards
# -------------------------------------------------------------------------
def build_hat_02_snapback_red():
    # Dome crown with backward visor (+Y) and front cutout (-Y)
    SEGS = 12
    verts, faces = [], []
    rings = [
        (0.001, 0.22),
        (0.12,  0.20),
        (0.22,  0.15),
        (0.27,  0.07),
        (0.27,  0.00),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            v1 = r * SEGS + s
            v2 = (r + 1) * SEGS + s
            v3 = (r + 1) * SEGS + s_next
            v4 = r * SEGS + s_next
            faces.append((v1, v2, v3, v4))
    crown = create_mesh_obj("Hat02_Crown", verts, faces, mat_red_cap)

    # Backward Visor (facing +Y)
    V_SEGS = 7
    v_verts, v_faces = [], []
    a_start = math.radians(30)
    a_end   = math.radians(150)
    for s in range(V_SEGS + 1):
        t = s / V_SEGS
        ang = a_start + (a_end - a_start) * t
        arch = math.sin(t * math.pi)
        r_inner = 0.27
        r_outer = 0.27 + 0.15 * (0.6 + 0.4 * arch)
        z_in = 0.01 + 0.01 * arch
        z_out = -0.04 - 0.02 * arch
        v_verts.append((r_inner * math.cos(ang), r_inner * math.sin(ang), z_in))
        v_verts.append((r_outer * math.cos(ang), r_outer * math.sin(ang), z_out))
    for s in range(V_SEGS):
        i1 = 2 * s
        i2 = 2 * (s + 1)
        v_faces.append((i1, i1 + 1, i2 + 1, i2))
    visor = create_mesh_obj("Hat02_Visor", v_verts, v_faces, mat_red_cap)

    # Front cutout strap (black plastic snap strap facing -Y)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.272, 0.025))
    strap = bpy.context.active_object
    strap.scale = (0.16, 0.018, 0.04)
    strap.name = "Hat02_Strap"
    strap.data.materials.append(mat_black_matte)
    for p in strap.data.polygons: p.use_smooth = False

    # Button
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.025, vertices=8, location=(0, 0, 0.225))
    btn = bpy.context.active_object
    btn.name = "Hat02_Button"
    btn.data.materials.append(mat_red_dark)
    for p in btn.data.polygons: p.use_smooth = False

    return [crown, visor, strap, btn]

# -------------------------------------------------------------------------
# Hat 3: Black Ribbed Beanie / Watch Cap
# -------------------------------------------------------------------------
def build_hat_03_beanie_black():
    # Slightly slouchy crown
    SEGS = 12
    verts, faces = [], []
    rings = [
        (0.001, 0.26),
        (0.10,  0.25),
        (0.18,  0.22),
        (0.24,  0.15),
        (0.265, 0.08),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat03_Crown", verts, faces, mat_dark_char)

    # Thick folded ribbed rim cuff
    C_SEGS = 16
    c_verts, c_faces = [], []
    c_rings = [
        (0.285, 0.085),
        (0.295, 0.04),
        (0.28, -0.01),
    ]
    for rad, z in c_rings:
        for s in range(C_SEGS):
            ang = 2 * math.pi * s / C_SEGS
            rib = 1.0 + 0.03 * (s % 2) # subtle ribbed facets
            c_verts.append((rad * rib * math.cos(ang), rad * rib * math.sin(ang), z))
    for r in range(len(c_rings) - 1):
        for s in range(C_SEGS):
            s_next = (s + 1) % C_SEGS
            c_faces.append((r*C_SEGS + s, (r+1)*C_SEGS + s, (r+1)*C_SEGS + s_next, r*C_SEGS + s_next))
    cuff = create_mesh_obj("Hat03_Cuff", c_verts, c_faces, mat_beanie_cuff)

    return [crown, cuff]

# -------------------------------------------------------------------------
# Hat 4: Safari Bucket Hat with Blue Ribbon
# -------------------------------------------------------------------------
def build_hat_04_bucket_safari():
    SEGS = 14
    # Crown (flat top with slight slope)
    verts, faces = [], []
    rings = [
        (0.001, 0.20),
        (0.14,  0.20),
        (0.18,  0.19),
        (0.22,  0.12),
        (0.26,  0.05),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat04_Crown", verts, faces, mat_cream_hat)

    # Blue Ribbon band
    b_verts, b_faces = [], []
    b_rings = [(0.262, 0.052), (0.272, 0.02)]
    for rad, z in b_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            b_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        b_faces.append((s, SEGS + s, SEGS + s_next, s_next))
    ribbon = create_mesh_obj("Hat04_Ribbon", b_verts, b_faces, mat_ocean_blue)

    # Sloping downward Brim all around
    brim_verts, brim_faces = [], []
    brim_rings = [
        (0.27,  0.02),
        (0.35, -0.04),
        (0.42, -0.09),
    ]
    for rad, z in brim_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            brim_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(brim_rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            brim_faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    brim = create_mesh_obj("Hat04_Brim", brim_verts, brim_faces, mat_cream_hat)

    return [crown, ribbon, brim]

# -------------------------------------------------------------------------
# Hat 5: Black & Red Two-Tone Snapback
# -------------------------------------------------------------------------
def build_hat_05_snapback_black_red():
    # Black crown
    SEGS = 12
    verts, faces = [], []
    rings = [
        (0.001, 0.22),
        (0.12,  0.20),
        (0.22,  0.15),
        (0.27,  0.07),
        (0.27,  0.00),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat05_Crown", verts, faces, mat_black_matte)

    # Red flat-brim visor (facing -Y)
    V_SEGS = 6
    v_verts, v_faces = [], []
    a_start = math.radians(-145)
    a_end   = math.radians(-35)
    for s in range(V_SEGS + 1):
        t = s / V_SEGS
        ang = a_start + (a_end - a_start) * t
        r_inner = 0.27
        r_outer = 0.27 + 0.17 * math.sin(t * math.pi)**0.3 # flat squared visor
        z_in = 0.015
        z_out = -0.04
        v_verts.append((r_inner * math.cos(ang), r_inner * math.sin(ang), z_in))
        v_verts.append((r_outer * math.cos(ang), r_outer * math.sin(ang), z_out))
    for s in range(V_SEGS):
        i1 = 2 * s
        i2 = 2 * (s + 1)
        v_faces.append((i1, i1 + 1, i2 + 1, i2))
    visor = create_mesh_obj("Hat05_Visor", v_verts, v_faces, mat_red_cap)

    # Red top button
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.025, vertices=8, location=(0, 0, 0.225))
    btn = bpy.context.active_object
    btn.name = "Hat05_Button"
    btn.data.materials.append(mat_red_cap)
    for p in btn.data.polygons: p.use_smooth = False

    return [crown, visor, btn]

# -------------------------------------------------------------------------
# Hat 6: Brown Detective Fedora
# -------------------------------------------------------------------------
def build_hat_06_fedora_brown():
    SEGS = 14
    verts, faces = [], []
    # Teardrop indented crown
    rings = [
        (0.001, 0.19),
        (0.12,  0.18),
        (0.18,  0.19),
        (0.24,  0.13),
        (0.26,  0.04),
    ]
    for r_idx, (rad, pz) in enumerate(rings):
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            # Center crease & front pinch
            crease = 0.0
            if r_idx <= 2:
                crease = -0.035 * (1.0 - math.cos(2 * ang))
            x = rad * math.cos(ang)
            y = rad * math.sin(ang) * 1.1 # slightly elongated front-to-back
            z = pz + crease
            verts.append((x, y, z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat06_Crown", verts, faces, mat_brown_felt)

    # Black Ribbon band
    b_verts, b_faces = [], []
    b_rings = [(0.263, 0.042), (0.272, 0.01)]
    for rad, z in b_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            b_verts.append((rad * math.cos(ang), rad * 1.1 * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        b_faces.append((s, SEGS + s, SEGS + s_next, s_next))
    ribbon = create_mesh_obj("Hat06_Ribbon", b_verts, b_faces, mat_black_matte)

    # Curled Fedora brim
    brim_verts, brim_faces = [], []
    brim_rings = [
        (0.27,  0.01),
        (0.35,  0.005),
        (0.42,  0.02), # slight upturn at edge
    ]
    for rad, pz in brim_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            tilt = 0.02 * math.cos(ang) # dipped in front, curled at sides/back
            brim_verts.append((rad * math.cos(ang), rad * 1.12 * math.sin(ang), pz + tilt))
    for r in range(len(brim_rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            brim_faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    brim = create_mesh_obj("Hat06_Brim", brim_verts, brim_faces, mat_brown_felt)

    return [crown, ribbon, brim]

# -------------------------------------------------------------------------
# Hat 7: Golden Straw Hat with Red Ribbon
# -------------------------------------------------------------------------
def build_hat_07_straw_luffy():
    SEGS = 16
    # Smooth hemispherical dome
    verts, faces = [], []
    rings = [
        (0.001, 0.22),
        (0.12,  0.21),
        (0.19,  0.18),
        (0.24,  0.12),
        (0.26,  0.04),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat07_Crown", verts, faces, mat_straw_gold)

    # Red ribbon band
    b_verts, b_faces = [], []
    b_rings = [(0.262, 0.042), (0.272, 0.005)]
    for rad, z in b_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            b_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        b_faces.append((s, SEGS + s, SEGS + s_next, s_next))
    ribbon = create_mesh_obj("Hat07_Ribbon", b_verts, b_faces, mat_red_cap)

    # Wide flat circular straw brim
    brim_verts, brim_faces = [], []
    brim_rings = [
        (0.27,  0.005),
        (0.36, -0.005),
        (0.46, -0.02),
    ]
    for rad, z in brim_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            brim_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(brim_rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            brim_faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    brim = create_mesh_obj("Hat07_Brim", brim_verts, brim_faces, mat_straw_gold)

    return [crown, ribbon, brim]

# -------------------------------------------------------------------------
# Hat 8: Green Tennis Sun Visor
# -------------------------------------------------------------------------
def build_hat_08_visor_green():
    SEGS = 16
    # Open-top headband ring
    verts, faces = [], []
    rings = [
        (0.28, 0.06),
        (0.275, 0.00)
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        faces.append((s, SEGS + s, SEGS + s_next, s_next))
    band = create_mesh_obj("Hat08_Band", verts, faces, mat_green_visor)

    # Front white panel accent
    WP_SEGS = 6
    w_verts, w_faces = [], []
    a_start = math.radians(-130)
    a_end   = math.radians(-50)
    for s in range(WP_SEGS + 1):
        t = s / WP_SEGS
        ang = a_start + (a_end - a_start) * t
        rad = 0.283
        w_verts.append((rad * math.cos(ang), rad * math.sin(ang), 0.055))
        w_verts.append((rad * math.cos(ang), rad * math.sin(ang), 0.005))
    for s in range(WP_SEGS):
        i1 = 2 * s
        i2 = 2 * (s + 1)
        w_faces.append((i1, i1 + 1, i2 + 1, i2))
    front_white = create_mesh_obj("Hat08_WhitePanel", w_verts, w_faces, mat_white_pure)

    # Curved forward visor
    V_SEGS = 7
    v_verts, v_faces = [], []
    a_start = math.radians(-150)
    a_end   = math.radians(-30)
    for s in range(V_SEGS + 1):
        t = s / V_SEGS
        ang = a_start + (a_end - a_start) * t
        arch = math.sin(t * math.pi)
        r_inner = 0.275
        r_outer = 0.275 + 0.17 * (0.4 + 0.6 * arch)
        z_in = 0.01 + 0.015 * arch
        z_out = -0.06 - 0.04 * arch
        v_verts.append((r_inner * math.cos(ang), r_inner * math.sin(ang), z_in))
        v_verts.append((r_outer * math.cos(ang), r_outer * math.sin(ang), z_out))
    for s in range(V_SEGS):
        i1 = 2 * s
        i2 = 2 * (s + 1)
        v_faces.append((i1, i1 + 1, i2 + 1, i2))
    visor = create_mesh_obj("Hat08_Visor", v_verts, v_faces, mat_green_visor)

    return [band, front_white, visor]

# -------------------------------------------------------------------------
# Hat 9: Blue Winter Beanie with Chevron & Pompom
# -------------------------------------------------------------------------
def build_hat_09_winter_pompom():
    SEGS = 16
    # Beanie Crown
    verts, faces = [], []
    rings = [
        (0.001, 0.28),
        (0.12,  0.27),
        (0.19,  0.22),
        (0.24,  0.15),
        (0.265, 0.08),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    crown = create_mesh_obj("Hat09_Crown", verts, faces, mat_blue_cap)

    # Zigzag chevron stripe in the middle
    z_verts, z_faces = [], []
    for s in range(SEGS):
        ang = 2 * math.pi * s / SEGS
        zigzag = 0.025 * ((s % 2) * 2 - 1)
        rad = 0.252
        z_verts.append((rad * math.cos(ang), rad * math.sin(ang), 0.17 + zigzag))
        z_verts.append((rad * math.cos(ang), rad * math.sin(ang), 0.13 + zigzag))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        i1 = 2 * s
        i2 = 2 * s_next
        z_faces.append((i1, i1 + 1, i2 + 1, i2))
    chevron = create_mesh_obj("Hat09_Chevron", z_verts, z_faces, mat_white_pure)

    # Blue Folded Cuff rim
    c_verts, c_faces = [], []
    c_rings = [(0.28, 0.08), (0.285, 0.03), (0.27, -0.02)]
    for rad, z in c_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            c_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(c_rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            c_faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    cuff = create_mesh_obj("Hat09_Cuff", c_verts, c_faces, mat_blue_dark)

    # White Pompom ball
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.075, location=(0, 0, 0.33))
    pompom = bpy.context.active_object
    pompom.name = "Hat09_Pompom"
    pompom.data.materials.append(mat_white_pure)
    for p in pompom.data.polygons: p.use_smooth = False

    return [crown, chevron, cuff, pompom]

# -------------------------------------------------------------------------
# Hat 10: White Athletic Headband with Red Stripe
# -------------------------------------------------------------------------
def build_hat_10_sweatband_sports():
    SEGS = 16
    # White base ring
    verts, faces = [], []
    rings = [
        (0.285, 0.05),
        (0.290, 0.00),
        (0.285, -0.05),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    band = create_mesh_obj("Hat10_Band", verts, faces, mat_white_pure)

    # Red center horizontal stripe
    r_verts, r_faces = [], []
    r_rings = [
        (0.292,  0.02),
        (0.292, -0.02),
    ]
    for rad, z in r_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            r_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        r_faces.append((s, SEGS + s, SEGS + s_next, s_next))
    stripe = create_mesh_obj("Hat10_RedStripe", r_verts, r_faces, mat_red_cap)

    return [band, stripe]

# -------------------------------------------------------------------------
# Hat 11: Golden Royal Crown with Gems
# -------------------------------------------------------------------------
def build_hat_11_crown_gold():
    POINTS = 5
    SEGS = POINTS * 2 # 10 vertices around perimeter (5 peaks, 5 valleys)
    verts, faces = [], []
    
    # Base ring (z = 0.0)
    for s in range(SEGS):
        ang = 2 * math.pi * s / SEGS
        verts.append((0.27 * math.cos(ang), 0.27 * math.sin(ang), 0.0))
        
    # Top rim with peaks (z varies)
    for s in range(SEGS):
        ang = 2 * math.pi * s / SEGS
        is_peak = (s % 2 == 0)
        # Peak height: tallest in front center (s = 0), stepped at sides
        if is_peak:
            peak_idx = s // 2
            z_peak = 0.17 if peak_idx == 0 else 0.14
        else:
            z_peak = 0.06
        verts.append((0.29 * math.cos(ang), 0.29 * math.sin(ang), z_peak))
        
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        faces.append((s, SEGS + s, SEGS + s_next, s_next))
        
    crown = create_mesh_obj("Hat11_CrownGold", verts, faces, mat_gold_crown)

    # Gemstone rhombuses on peaks
    # Center Ruby (Peak 0: ang = 0, facing -Y in front)
    # Note: in our coordinate system, -Y is forward (ang = -pi/2), let's orient peaks appropriately!
    # Let's add gems to front peaks
    gem_objs = []
    gem_configs = [
        (math.radians(-90), 0.10, mat_ruby_gem, 0.038),   # Center Ruby
        (math.radians(-54), 0.085, mat_sapphire, 0.030),  # Right Sapphire
        (math.radians(-126), 0.085, mat_sapphire, 0.030), # Left Sapphire
    ]
    for ang, z, mat, sz in gem_configs:
        r = 0.292
        gx = r * math.cos(ang)
        gy = r * math.sin(ang)
        
        # Octahedron diamond/rhombus created procedurally
        g_verts = [
            (0, 0, sz * 1.3),
            (0, 0, -sz * 1.3),
            (sz * 0.7, 0, 0),
            (-sz * 0.7, 0, 0),
            (0, sz * 0.5, 0),
            (0, -sz * 0.5, 0),
        ]
        g_faces = [
            (0, 2, 4), (0, 4, 3), (0, 3, 5), (0, 5, 2),
            (1, 4, 2), (1, 3, 4), (1, 5, 3), (1, 2, 5),
        ]
        g_mesh = bpy.data.meshes.new("Gem_Mesh")
        g_mesh.from_pydata(g_verts, [], g_faces)
        g_mesh.update()
        for p in g_mesh.polygons: p.use_smooth = False
        gem = bpy.data.objects.new("Hat11_Gem", g_mesh)
        gem.location = (gx, gy, z)
        gem.rotation_euler = Euler((0, 0, ang + math.pi/2), 'XYZ')
        gem.data.materials.append(mat)
        bpy.context.collection.objects.link(gem)
        gem_objs.append(gem)

    return [crown] + gem_objs

# -------------------------------------------------------------------------
# Hat 12: Pirate Bandana / Skull Cap
# -------------------------------------------------------------------------
def build_hat_12_bandana_pirate():
    SEGS = 14
    # Black skull cap
    verts, faces = [], []
    rings = [
        (0.001, 0.22),
        (0.12,  0.21),
        (0.20,  0.17),
        (0.26,  0.09),
        (0.27,  0.02),
    ]
    for rad, z in rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for r in range(len(rings) - 1):
        for s in range(SEGS):
            s_next = (s + 1) % SEGS
            faces.append((r*SEGS + s, (r+1)*SEGS + s, (r+1)*SEGS + s_next, r*SEGS + s_next))
    cap = create_mesh_obj("Hat12_Cap", verts, faces, mat_black_matte)

    # Red headband wrapped around rim
    b_verts, b_faces = [], []
    b_rings = [(0.285, 0.04), (0.280, -0.025)]
    for rad, z in b_rings:
        for s in range(SEGS):
            ang = 2 * math.pi * s / SEGS
            b_verts.append((rad * math.cos(ang), rad * math.sin(ang), z))
    for s in range(SEGS):
        s_next = (s + 1) % SEGS
        b_faces.append((s, SEGS + s, SEGS + s_next, s_next))
    headband = create_mesh_obj("Hat12_Headband", b_verts, b_faces, mat_red_cap)

    # Red knot & dangling tails on the rear-right side (e.g. ang ~ 40 deg)
    knot_ang = math.radians(45)
    kx = 0.29 * math.cos(knot_ang)
    ky = 0.29 * math.sin(knot_ang)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.042, location=(kx, ky, 0.01))
    knot = bpy.context.active_object
    knot.name = "Hat12_Knot"
    knot.data.materials.append(mat_red_cap)
    for p in knot.data.polygons: p.use_smooth = False

    # Two dangling cloth ribbons
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(kx + 0.02, ky + 0.02, -0.06))
    tail1 = bpy.context.active_object
    tail1.scale = (0.035, 0.015, 0.08)
    tail1.rotation_euler = Euler((math.radians(15), math.radians(-18), math.radians(20)), 'XYZ')
    tail1.name = "Hat12_Tail1"
    tail1.data.materials.append(mat_red_cap)
    for p in tail1.data.polygons: p.use_smooth = False

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(kx + 0.01, ky + 0.03, -0.08))
    tail2 = bpy.context.active_object
    tail2.scale = (0.03, 0.012, 0.09)
    tail2.rotation_euler = Euler((math.radians(25), math.radians(-8), math.radians(35)), 'XYZ')
    tail2.name = "Hat12_Tail2"
    tail2.data.materials.append(mat_red_dark)
    for p in tail2.data.polygons: p.use_smooth = False

    return [cap, headband, knot, tail1, tail2]

# -------------------------------------------------------------------------
# Build & Export All 12 Hats
# -------------------------------------------------------------------------
HATS = [
    {"id": "hat_01_cap_blue",          "builder": build_hat_01_cap_blue},
    {"id": "hat_02_snapback_red",      "builder": build_hat_02_snapback_red},
    {"id": "hat_03_beanie_black",      "builder": build_hat_03_beanie_black},
    {"id": "hat_04_bucket_safari",     "builder": build_hat_04_bucket_safari},
    {"id": "hat_05_snapback_black_red","builder": build_hat_05_snapback_black_red},
    {"id": "hat_06_fedora_brown",      "builder": build_hat_06_fedora_brown},
    {"id": "hat_07_straw_luffy",       "builder": build_hat_07_straw_luffy},
    {"id": "hat_08_visor_green",       "builder": build_hat_08_visor_green},
    {"id": "hat_09_winter_pompom",     "builder": build_hat_09_winter_pompom},
    {"id": "hat_10_sweatband_sports",  "builder": build_hat_10_sweatband_sports},
    {"id": "hat_11_crown_gold",        "builder": build_hat_11_crown_gold},
    {"id": "hat_12_bandana_pirate",    "builder": build_hat_12_bandana_pirate},
]

print("Building all 12 low-poly hat assets...")

# Dictionary to hold objects for showcase
all_hat_groups = {}

for hat_info in HATS:
    hat_id = hat_info["id"]
    builder = hat_info["builder"]
    
    bpy.ops.object.select_all(action='DESELECT')
    objs = builder()
    all_hat_groups[hat_id] = objs
    
    # Export individual GLB centered at origin (0, 0, 0)
    for o in objs:
        o.select_set(True)
        
    glb_pub = os.path.join(MODELS_DIR, f"{hat_id}.glb")
    glb_ast = os.path.join(ASSETS_MODELS_DIR, f"{hat_id}.glb")
    
    bpy.ops.export_scene.gltf(
        filepath=glb_pub,
        export_format='GLB',
        use_selection=True,
        export_apply=True
    )
    shutil.copy2(glb_pub, glb_ast)
    print(f"Exported: {glb_pub}")

# Save master blender file
BLEND_PATH = os.path.join(BASE_DIR, "hats_collection.blend")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print(f"Saved master blend: {BLEND_PATH}")

# -------------------------------------------------------------------------
# Arrange into 3x4 Grid for High-Res Showcase Render
# Matching the reference image:
# Row 0 (Y = +1.1):  01(X=-1.5), 02(X=-0.5), 03(X=+0.5), 04(X=+1.5)
# Row 1 (Y = 0.0):   05(X=-1.5), 06(X=-0.5), 07(X=+0.5), 08(X=+1.5)
# Row 2 (Y = -1.1):  09(X=-1.5), 10(X=-0.5), 11(X=+0.5), 12(X=+1.5)
# -------------------------------------------------------------------------
SPACING_X = 1.05
SPACING_Y = 0.95

# Isometric 3/4 tilt for showcase: rotate around Z by -25 deg, X by 10 deg
showcase_rot = Euler((math.radians(12), 0, math.radians(-25)), 'XYZ')

for idx, hat_info in enumerate(HATS):
    hat_id = hat_info["id"]
    col = idx % 4
    row = idx // 4
    
    gx = (col - 1.5) * SPACING_X
    gy = (1.0 - row) * SPACING_Y
    
    for obj in all_hat_groups[hat_id]:
        # Local rotation for 3/4 viewing angle
        obj.rotation_euler = showcase_rot
        # Offset to grid slot
        obj.location.x += gx
        obj.location.y += gy

# Export full showcase GLB
SHOWCASE_GLB = os.path.join(MODELS_DIR, "hats_showcase.glb")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=SHOWCASE_GLB,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
print(f"Exported Showcase GLB: {SHOWCASE_GLB}")

# -------------------------------------------------------------------------
# High-Resolution Cycles Studio Render
# -------------------------------------------------------------------------
# Clean background
world = bpy.data.worlds.new("ShowcaseWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.97, 0.97, 0.98, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# Key light
bpy.ops.object.light_add(type='AREA', location=(3.0, -4.5, 4.0))
key = bpy.context.active_object
key.data.energy = 320
key.data.size = 5.0
key.data.color = (1.0, 0.98, 0.95)
key.rotation_euler = Euler((math.radians(50), 0, math.radians(35)), 'XYZ')

# Fill light
bpy.ops.object.light_add(type='AREA', location=(-3.5, -3.5, 3.5))
fill = bpy.context.active_object
fill.data.energy = 160
fill.data.size = 6.0
fill.data.color = (0.92, 0.95, 1.0)
fill.rotation_euler = Euler((math.radians(45), 0, math.radians(-50)), 'XYZ')

# Camera setup
bpy.ops.object.camera_add(location=(0.0, -4.6, 2.8))
cam = bpy.context.active_object
cam.data.lens = 48
bpy.context.scene.camera = cam

target = Vector((0.0, 0.0, 0.05))
cam_dir = target - cam.location
cam.rotation_euler = cam_dir.to_track_quat('-Z', 'Y').to_euler()

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.render.resolution_x = 1600
scene.render.resolution_y = 1200
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'

SHOWCASE_PNG = os.path.join(SHOWCASE_DIR, "hats_showcase.png")
scene.render.filepath = SHOWCASE_PNG

print(f"Rendering showcase image to: {SHOWCASE_PNG}...")
bpy.ops.render.render(write_still=True)
print("Showcase render completed successfully!")
