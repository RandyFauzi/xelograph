"""Procedural 3D Asset Builder: Kolam Becabur (Polished Final Edition)
Faithfully matches the stylized cartoon diorama illustration:
- Circular stone-rimmed pond with masonry curb segments, low-poly faceted boulders, and grass tufts
- Stylized vibrant cyan water with gentle, lightweight looping wave animation (Shape Keys)
- Cute origami/low-poly sailboat with wooden mast and cream sail, gently bobbing on the water
- Floating green lily pads with natural notch cutouts and subtle micro-float animation
- Wooden pier dock with 3 beveled planks, silver bolts, and underwater pilings
- Arched wooden signboard with posts, bolts, and 3D 'Kolam Becabur' curved lettering
- Master .blend file + Standalone animated .glb (< 2MB) + High-res 1024x1024 preview render
"""
import bpy
import math
import os
import shutil
from mathutils import Vector, Euler, Matrix

# Reset scene completely
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes: bpy.data.meshes.remove(block)
for block in bpy.data.materials: bpy.data.materials.remove(block)
for block in bpy.data.curves: bpy.data.curves.remove(block)
for block in bpy.data.actions: bpy.data.actions.remove(block)
for block in bpy.data.fonts: bpy.data.fonts.remove(block)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../..'))
MODELS_DIR = os.path.join(ROOT, 'assets/models')
PREVIEWS_DIR = os.path.join(ROOT, 'assets/previews')
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)

# ---------------------------------------------------------
# Material Helpers (Linear Color Conversion)
# ---------------------------------------------------------
def make_material(name, hex_color, roughness=0.5, metallic=0.0, specular=0.5, emission=None, emission_strength=0.0):
    hex_clean = hex_color.lstrip('#')
    rgb = [int(hex_clean[i:i+2], 16)/255.0 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*linear, 1.0)
    
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*linear, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular
        
    if emission:
        e_clean = emission.lstrip('#')
        e_rgb = [int(e_clean[i:i+2], 16)/255.0 for i in (0, 2, 4)]
        e_linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in e_rgb]
        bsdf.inputs['Emission Color'].default_value = (*e_linear, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
        
    return mat

# Stylized Color Palette matching reference image
mat_stone_rim   = make_material('StoneRim',   '#e1ddd6', roughness=0.60)
mat_stone_rock1 = make_material('StoneRock1', '#c7c4bb', roughness=0.75)
mat_stone_rock2 = make_material('StoneRock2', '#b2b0a7', roughness=0.80)
mat_stone_rock3 = make_material('StoneRock3', '#9c9d96', roughness=0.85)
mat_water       = make_material('StylizedWater', '#40caee', roughness=0.10, metallic=0.02, specular=0.9, emission='#25b0d6', emission_strength=0.15)
mat_water_deep  = make_material('DeepWater', '#207c99', roughness=0.35)
mat_water_foam  = make_material('WaterFoam', '#d4f7fe', roughness=0.20, specular=0.6)
mat_wood_sign   = make_material('WoodSign',   '#cf7b38', roughness=0.52)
mat_wood_post   = make_material('WoodPost',   '#985222', roughness=0.65)
mat_wood_plank  = make_material('WoodPlank',  '#d68440', roughness=0.48)
mat_wood_dark   = make_material('WoodDark',   '#86471c', roughness=0.65)
mat_metal_bolt  = make_material('MetalBolt',  '#c7ced4', roughness=0.22, metallic=0.85)
mat_lily_pad    = make_material('LilyPad',    '#75bd31', roughness=0.42)
mat_boat_hull   = make_material('BoatHull',   '#c87a38', roughness=0.52)
mat_boat_sail   = make_material('BoatSail',   '#fcf8f0', roughness=0.70)
mat_grass       = make_material('GrassTuft',  '#74bd34', roughness=0.65)
mat_sign_text   = make_material('SignText',   '#fff9eb', roughness=0.35)

# ---------------------------------------------------------
# Asset Hierarchy Root
# ---------------------------------------------------------
root_obj = bpy.data.objects.new('Kolam_Becabur', None)
bpy.context.collection.objects.link(root_obj)

# ---------------------------------------------------------
# 1. Pond Basin & Masonry Curb Ring
# ---------------------------------------------------------
# Basin (deep bowl underneath the water)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.06, depth=0.20, location=(0, 0, -0.04))
basin = bpy.context.object
basin.name = 'Pond_Basin'
basin.parent = root_obj
basin.data.materials.append(mat_water_deep)

# Masonry Stone Curb
CURB_SEGMENTS = 14
R_INNER = 1.08
R_OUTER = 1.34
CURB_H = 0.17

for i in range(CURB_SEGMENTS):
    a1 = 2 * math.pi * i / CURB_SEGMENTS + 0.016
    a2 = 2 * math.pi * (i + 1) / CURB_SEGMENTS - 0.016
    steps = 4
    verts = []
    # Bottom
    for s in range(steps + 1):
        ang = a1 + (a2 - a1) * (s / steps)
        verts.append((R_INNER * math.cos(ang), R_INNER * math.sin(ang), 0.00))
        verts.append((R_OUTER * math.cos(ang), R_OUTER * math.sin(ang), 0.00))
    # Top
    for s in range(steps + 1):
        ang = a1 + (a2 - a1) * (s / steps)
        verts.append((R_INNER * math.cos(ang), R_INNER * math.sin(ang), CURB_H))
        verts.append((R_OUTER * math.cos(ang), R_OUTER * math.sin(ang), CURB_H))
        
    faces = []
    n = steps + 1
    for s in range(steps):
        b_in1, b_out1 = 2 * s, 2 * s + 1
        b_in2, b_out2 = 2 * (s + 1), 2 * (s + 1) + 1
        t_in1, t_out1 = 2 * n + 2 * s, 2 * n + 2 * s + 1
        t_in2, t_out2 = 2 * n + 2 * (s + 1), 2 * n + 2 * (s + 1) + 1
        
        faces.append((b_out1, b_out2, t_out2, t_out1))
        faces.append((b_in2, b_in1, t_in1, t_in2))
        faces.append((t_in1, t_in2, t_out2, t_out1))
        faces.append((b_in1, b_out1, b_out2, b_in2))
        
    faces.append((0, 1, 2 * n + 1, 2 * n))
    faces.append((2 * steps, 2 * n + 2 * steps, 2 * n + 2 * steps + 1, 2 * steps + 1))
    
    mesh = bpy.data.meshes.new(f'CurbSegment_{i}')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    seg_obj = bpy.data.objects.new(f'Curb_Block_{i:02d}', mesh)
    bpy.context.collection.objects.link(seg_obj)
    seg_obj.parent = root_obj
    seg_obj.data.materials.append(mat_stone_rim)
    
    bev = seg_obj.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.014
    bev.segments = 2

# ---------------------------------------------------------
# 2. Low-Poly Rim Boulders & Grass Tufts
# ---------------------------------------------------------
rock_mats = [mat_stone_rock1, mat_stone_rock2, mat_stone_rock3]
rock_data = [
    # (angle_deg, radius, scale, z_offset, mat_idx)
    (15,  1.21, (0.13, 0.11, 0.10), 0.19, 0),
    (42,  1.22, (0.15, 0.13, 0.12), 0.20, 1),
    (72,  1.21, (0.14, 0.12, 0.11), 0.19, 2),
    (108, 1.22, (0.15, 0.13, 0.12), 0.20, 0),
    (138, 1.21, (0.14, 0.12, 0.11), 0.19, 1),
    (168, 1.22, (0.13, 0.11, 0.10), 0.19, 2),
    # Dock is at ~195-215 deg
    (245, 1.21, (0.14, 0.12, 0.11), 0.19, 0),
    (275, 1.22, (0.15, 0.13, 0.12), 0.20, 1),
    (308, 1.21, (0.14, 0.12, 0.10), 0.19, 2),
    (338, 1.22, (0.15, 0.13, 0.12), 0.20, 0),
]

for idx, (deg, r, s, z_off, m_idx) in enumerate(rock_data):
    rad = math.radians(deg)
    x = r * math.cos(rad)
    y = r * math.sin(rad)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(x, y, z_off))
    rock = bpy.context.object
    rock.name = f'RimRock_{idx:02d}'
    rock.parent = root_obj
    rock.scale = s
    rock.rotation_euler = (0.25 * math.sin(idx * 1.3), 0.25 * math.cos(idx * 1.7), rad + idx * 0.5)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rock.data.materials.append(rock_mats[m_idx])

# Grass tufts nestled around the rocks
grass_angles = [28, 58, 90, 122, 180, 260, 292, 324]
for idx, deg in enumerate(grass_angles):
    rad = math.radians(deg)
    r = 1.26
    x = r * math.cos(rad)
    y = r * math.sin(rad)
    for b in range(2):
        bx = x + 0.02 * math.cos(rad + b)
        by = y + 0.02 * math.sin(rad + b)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.022, radius2=0.002, depth=0.09, location=(bx, by, CURB_H + 0.04))
        blade = bpy.context.object
        blade.name = f'Grass_{idx}_{b}'
        blade.parent = root_obj
        blade.rotation_euler = (0.15 * (b - 0.5), -0.2 * (b - 0.5), rad + 0.3 * b)
        blade.data.materials.append(mat_grass)

# ---------------------------------------------------------
# 3. Water Surface with Looping Wave Shape Keys
# ---------------------------------------------------------
WATER_R = 1.09
WATER_Z = 0.09
RINGS = 14
SECTORS = 36

water_verts = [(0.0, 0.0, WATER_Z)]
for ring in range(1, RINGS + 1):
    r_frac = ring / RINGS
    r = WATER_R * (r_frac ** 0.88)
    for sec in range(SECTORS):
        ang = 2 * math.pi * sec / SECTORS
        water_verts.append((r * math.cos(ang), r * math.sin(ang), WATER_Z))

water_faces = []
for sec in range(SECTORS):
    v1 = 0
    v2 = 1 + sec
    v3 = 1 + ((sec + 1) % SECTORS)
    water_faces.append((v1, v2, v3))

for ring in range(RINGS - 1):
    row1 = 1 + ring * SECTORS
    row2 = 1 + (ring + 1) * SECTORS
    for sec in range(SECTORS):
        next_sec = (sec + 1) % SECTORS
        water_faces.append((row1 + sec, row2 + sec, row2 + next_sec, row1 + next_sec))

water_mesh = bpy.data.meshes.new('Pond_Water_Mesh')
water_mesh.from_pydata(water_verts, [], water_faces)
water_mesh.update()
water_obj = bpy.data.objects.new('Pond_Water', water_mesh)
bpy.context.collection.objects.link(water_obj)
water_obj.parent = root_obj
water_obj.data.materials.append(mat_water)

# Shape Keys for gentle lightweight ripple animation
water_obj.shape_key_add(name='Basis')

key1 = water_obj.shape_key_add(name='WaveRipple1')
for i, vert in enumerate(water_verts):
    vx, vy, vz = vert
    dist = math.sqrt(vx*vx + vy*vy)
    dz = 0.012 * math.sin(dist * 11.0) + 0.005 * math.cos(math.atan2(vy, vx) * 3.0)
    key1.data[i].co = Vector((vx, vy, vz + dz))

key2 = water_obj.shape_key_add(name='WaveRipple2')
for i, vert in enumerate(water_verts):
    vx, vy, vz = vert
    dist = math.sqrt(vx*vx + vy*vy)
    dz = 0.012 * math.cos(dist * 11.0) + 0.005 * math.sin(math.atan2(vy, vx) * 3.0)
    key2.data[i].co = Vector((vx, vy, vz + dz))

FRAMES = 60
for f in range(1, FRAMES + 1):
    phi = 2 * math.pi * (f - 1) / FRAMES
    w1 = math.sin(phi)
    w2 = math.cos(phi)
    key1.value = max(0.0, w1)
    key1.keyframe_insert(data_path='value', frame=f)
    key2.value = max(0.0, w2)
    key2.keyframe_insert(data_path='value', frame=f)

# Water Ripple rings around boat
bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=4, major_radius=0.28, minor_radius=0.008, location=(0.08, -0.06, WATER_Z + 0.018))
boat_ripple1 = bpy.context.object
boat_ripple1.name = 'Boat_Ripple_Inner'
boat_ripple1.parent = root_obj
boat_ripple1.scale = (1.0, 0.75, 0.4)
boat_ripple1.data.materials.append(mat_water_foam)

bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=4, major_radius=0.42, minor_radius=0.007, location=(0.08, -0.06, WATER_Z + 0.016))
boat_ripple2 = bpy.context.object
boat_ripple2.name = 'Boat_Ripple_Outer'
boat_ripple2.parent = root_obj
boat_ripple2.scale = (1.0, 0.75, 0.4)
boat_ripple2.data.materials.append(mat_water_foam)

# ---------------------------------------------------------
# 4. Little Origami / Wooden Sailboat
# ---------------------------------------------------------
b_v = [
    ( 0.00,  0.24,  0.09),  # 0: Prow peak
    ( 0.00, -0.24,  0.09),  # 1: Stern peak
    ( 0.00,  0.15, -0.05),  # 2: Keel front
    ( 0.00, -0.15, -0.05),  # 3: Keel back
    ( 0.13,  0.00,  0.05),  # 4: Starboard gunwale
    (-0.13,  0.00,  0.05),  # 5: Port gunwale
    ( 0.09,  0.00, -0.02),  # 6: Starboard chine
    (-0.09,  0.00, -0.02),  # 7: Port chine
    ( 0.00,  0.00, -0.01)   # 8: Cockpit floor
]
b_f = [
    (0, 4, 6, 2),
    (4, 1, 3, 6),
    (0, 2, 7, 5),
    (5, 7, 3, 1),
    (2, 6, 3),
    (2, 3, 7),
    (0, 5, 8, 4),
    (1, 4, 8, 5)
]
boat_mesh = bpy.data.meshes.new('Boat_Mesh')
boat_mesh.from_pydata(b_v, [], b_f)
boat_mesh.update()
boat_obj = bpy.data.objects.new('Sailboat', boat_mesh)
bpy.context.collection.objects.link(boat_obj)
boat_obj.parent = root_obj
# Position near center, rotated so its side profile & sail face the camera nicely
boat_obj.location = (0.08, -0.06, WATER_Z + 0.026)
boat_obj.rotation_euler = (0.0, 0.0, math.radians(-32))
boat_obj.data.materials.append(mat_boat_hull)

# Wooden Mast
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.011, depth=0.34, location=(0.0, 0.02, 0.16))
mast = bpy.context.object
mast.name = 'Boat_Mast'
mast.parent = boat_obj
mast.data.materials.append(mat_wood_dark)

# Solid Triangular Sail (Manifold geometry with clean thickness)
sail_w = 0.008
s_v = [
    (-sail_w,  0.02, 0.04),
    ( sail_w,  0.02, 0.04),
    (-sail_w,  0.02, 0.30),
    ( sail_w,  0.02, 0.30),
    (-sail_w, -0.18, 0.08),
    ( sail_w, -0.18, 0.08),
]
s_f = [
    (0, 2, 4),
    (1, 5, 3),
    (0, 1, 3, 2),
    (2, 3, 5, 4),
    (0, 4, 5, 1)
]
sail_mesh = bpy.data.meshes.new('Sail_Mesh')
sail_mesh.from_pydata(s_v, [], s_f)
sail_mesh.update()
sail_obj = bpy.data.objects.new('Boat_Sail', sail_mesh)
bpy.context.collection.objects.link(sail_obj)
sail_obj.parent = boat_obj
sail_obj.data.materials.append(mat_boat_sail)

# Animate Boat Floating & Rocking
boat_base_z = WATER_Z + 0.026
boat_base_rz = math.radians(-32)
for f in range(1, FRAMES + 1):
    phi = 2 * math.pi * (f - 1) / FRAMES
    boat_obj.location.z = boat_base_z + 0.014 * math.sin(phi)
    boat_obj.rotation_euler.x = math.radians(2.5 * math.sin(phi + 0.5))
    boat_obj.rotation_euler.y = math.radians(3.5 * math.cos(phi))
    boat_obj.rotation_euler.z = boat_base_rz + math.radians(1.5 * math.sin(phi * 2))
    boat_obj.keyframe_insert(data_path='location', frame=f)
    boat_obj.keyframe_insert(data_path='rotation_euler', frame=f)

# ---------------------------------------------------------
# 5. Stylized Lily Pads
# ---------------------------------------------------------
def create_lily_pad(name, loc, radius, rot_z, phase_shift):
    verts = [(0, 0, 0)]
    SEGS = 12
    a_start = math.radians(35)
    a_end = math.radians(325)
    for s in range(SEGS + 1):
        ang = a_start + (a_end - a_start) * (s / SEGS)
        verts.append((radius * math.cos(ang), radius * math.sin(ang), 0.0))
        
    faces = []
    for s in range(1, SEGS + 1):
        faces.append((0, s, s + 1))
        
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root_obj
    obj.location = loc
    obj.rotation_euler = (0.0, 0.0, rot_z)
    obj.data.materials.append(mat_lily_pad)
    
    sol = obj.modifiers.new('Thickness', 'SOLIDIFY')
    sol.thickness = 0.018
    sol.offset = 1.0  # Solidify upwards so top surface is elevated!
    
    base_z = loc[2]
    for f in range(1, FRAMES + 1):
        phi = 2 * math.pi * (f - 1) / FRAMES + phase_shift
        obj.location.z = base_z + 0.005 * math.sin(phi)
        obj.rotation_euler.x = math.radians(1.2 * math.cos(phi))
        obj.rotation_euler.y = math.radians(1.2 * math.sin(phi))
        obj.keyframe_insert(data_path='location', frame=f)
        obj.keyframe_insert(data_path='rotation_euler', frame=f)
    return obj

create_lily_pad('LilyPad_North', (-0.32,  0.42, WATER_Z + 0.018), 0.20, math.radians(25),  0.0)
create_lily_pad('LilyPad_South', (-0.26, -0.36, WATER_Z + 0.018), 0.22, math.radians(105), 1.6)
create_lily_pad('LilyPad_East',  ( 0.65, -0.18, WATER_Z + 0.018), 0.21, math.radians(230), 3.2)
create_lily_pad('LilyPad_Small', ( 0.38,  0.36, WATER_Z + 0.018), 0.15, math.radians(160), 2.4)

# ---------------------------------------------------------
# 6. Wooden Pier / Dock
# ---------------------------------------------------------
# Located at 8 o'clock (left side foreground)
dock_root = bpy.data.objects.new('Wooden_Dock', None)
bpy.context.collection.objects.link(dock_root)
dock_root.parent = root_obj
dock_root.location = (-0.95, -0.38, CURB_H + 0.035)
dock_root.rotation_euler = (0, 0, math.radians(18))

PLANK_L = 0.72
PLANK_W = 0.17
PLANK_H = 0.055
PLANK_GAP = 0.018

for p in range(3):
    py = (p - 1) * (PLANK_W + PLANK_GAP)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, py, 0.0))
    plank = bpy.context.object
    plank.name = f'Dock_Plank_{p}'
    plank.parent = dock_root
    plank.scale = (PLANK_L, PLANK_W, PLANK_H)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    plank.data.materials.append(mat_wood_plank)
    bev = plank.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.011
    bev.segments = 2
    
    # 2 Metal bolts on outer end
    for bx in [-PLANK_L * 0.42]:
        for by in [py - PLANK_W * 0.28, py + PLANK_W * 0.28]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.011, depth=0.012, location=(bx, by, PLANK_H * 0.52))
            bolt = bpy.context.object
            bolt.name = f'Plank_Bolt_{p}'
            bolt.parent = dock_root
            bolt.data.materials.append(mat_metal_bolt)

# Dock Support Legs (pilings) in the water
for post_y in [-PLANK_W * 0.9, PLANK_W * 0.9]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.045, depth=0.34, location=(PLANK_L * 0.32, post_y, -0.16))
    post = bpy.context.object
    post.name = 'Dock_Piling'
    post.parent = dock_root
    post.data.materials.append(mat_wood_dark)

# Crossbeam
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(PLANK_L * 0.32, 0.0, -0.04))
crossbeam = bpy.context.object
crossbeam.name = 'Dock_Crossbeam'
crossbeam.parent = dock_root
crossbeam.scale = (0.08, (PLANK_W + PLANK_GAP) * 2.8, 0.05)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
crossbeam.data.materials.append(mat_wood_dark)

# ---------------------------------------------------------
# 7. Wooden Signboard ("Kolam Becabur")
# ---------------------------------------------------------
sign_root = bpy.data.objects.new('Sign_KolamBecabur', None)
bpy.context.collection.objects.link(sign_root)
sign_root.parent = root_obj
sign_root.location = (0.0, 1.15, CURB_H)

# 2 Sturdy Wooden Posts
POST_X = 0.52
POST_H = 0.78
for px in [-POST_X, POST_X]:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px, 0.0, POST_H * 0.5 - 0.02))
    spost = bpy.context.object
    spost.name = f'Sign_Post_{px}'
    spost.parent = sign_root
    spost.scale = (0.13, 0.13, POST_H)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    spost.data.materials.append(mat_wood_post)
    sbev = spost.modifiers.new('Bevel', 'BEVEL')
    sbev.width = 0.016
    sbev.segments = 2

# Contoured Arched Wooden Board
BOARD_W = 1.48
BOARD_H = 0.44
BOARD_D = 0.09
BOARD_Z = POST_H * 0.58

board_steps = 18
b_verts = []
for s in range(board_steps + 1):
    u = (s / board_steps) - 0.5
    x = u * BOARD_W
    arch = 0.06 * math.cos(u * math.pi)
    b_verts.append((x, -BOARD_D * 0.5, BOARD_Z - BOARD_H * 0.5 + arch))
    b_verts.append((x,  BOARD_D * 0.5, BOARD_Z - BOARD_H * 0.5 + arch))
    b_verts.append((x, -BOARD_D * 0.5, BOARD_Z + BOARD_H * 0.5 + arch))
    b_verts.append((x,  BOARD_D * 0.5, BOARD_Z + BOARD_H * 0.5 + arch))

b_faces = []
for s in range(board_steps):
    c0 = s * 4
    c1 = (s + 1) * 4
    b_faces.append((c0 + 0, c1 + 0, c1 + 2, c0 + 2))
    b_faces.append((c0 + 3, c1 + 3, c1 + 1, c0 + 1))
    b_faces.append((c0 + 2, c1 + 2, c1 + 3, c0 + 3))
    b_faces.append((c0 + 1, c1 + 1, c1 + 0, c0 + 0))

b_faces.append((0, 2, 3, 1))
last = board_steps * 4
b_faces.append((last + 1, last + 3, last + 2, last + 0))

board_mesh = bpy.data.meshes.new('Sign_Board_Mesh')
board_mesh.from_pydata(b_verts, [], b_faces)
board_mesh.update()
board_obj = bpy.data.objects.new('Sign_Board_Plank', board_mesh)
bpy.context.collection.objects.link(board_obj)
board_obj.parent = sign_root
board_obj.data.materials.append(mat_wood_sign)

bbev = board_obj.modifiers.new('Bevel', 'BEVEL')
bbev.width = 0.018
bbev.segments = 2

# 4 Corner Hex/Round Bolts on the Sign
for bx in [-POST_X, POST_X]:
    for bz_off in [-BOARD_H * 0.28, BOARD_H * 0.28]:
        arch_bz = BOARD_Z + bz_off + 0.06 * math.cos((bx / BOARD_W) * math.pi)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.026, depth=0.025, location=(bx, -BOARD_D * 0.5 - 0.01, arch_bz))
        sbolt = bpy.context.object
        sbolt.name = 'Sign_Bolt'
        sbolt.parent = sign_root
        sbolt.rotation_euler = (math.radians(90), 0, 0)
        sbolt.data.materials.append(mat_metal_bolt)

# 3D Text "Kolam Becabur"
curve_text = bpy.data.curves.new('SignTextCurve', 'FONT')
curve_text.body = "Kolam Becabur"
curve_text.align_x = 'CENTER'
curve_text.align_y = 'CENTER'
curve_text.size = 0.19
curve_text.extrude = 0.018
curve_text.bevel_depth = 0.007
curve_text.bevel_resolution = 2

font_path = "C:/Windows/Fonts/arialbd.ttf"
if os.path.exists(font_path):
    try:
        custom_font = bpy.data.fonts.load(font_path)
        curve_text.font = custom_font
    except Exception as e:
        print(f"Font note: {e}")

text_obj = bpy.data.objects.new('Sign_Text_KolamBecabur', curve_text)
bpy.context.collection.objects.link(text_obj)
text_obj.parent = sign_root
text_obj.location = (0.0, -BOARD_D * 0.5 - 0.014, BOARD_Z + 0.05)
text_obj.rotation_euler = (math.radians(90), 0, 0)
text_obj.data.materials.append(mat_sign_text)

# ---------------------------------------------------------
# Set Animation Frames
# ---------------------------------------------------------
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = FRAMES
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_set(1)

# ---------------------------------------------------------
# Save Master .blend File
# ---------------------------------------------------------
blend_filepath = os.path.join(HERE, 'kolam_becabur.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_filepath)
print(f"Saved Blender project: {blend_filepath}")

# ---------------------------------------------------------
# Export Standalone .glb Asset with Animation
# ---------------------------------------------------------
glb_filepath = os.path.join(MODELS_DIR, 'kolam_becabur.glb')
bpy.ops.export_scene.gltf(
    filepath=glb_filepath,
    export_format='GLB',
    export_apply=False,
    export_animations=True,
    export_morph=True,
    export_yup=True
)
print(f"Exported GLB asset: {glb_filepath}")

glb_copy = os.path.join(ROOT, 'assets/kolam_becabur.glb')
shutil.copy2(glb_filepath, glb_copy)

# ---------------------------------------------------------
# Setup Isometric Studio Camera & Lighting
# ---------------------------------------------------------
cam_data = bpy.data.cameras.new('IsometricPreviewCam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.30
cam_obj = bpy.data.objects.new('IsometricCamera', cam_data)
bpy.context.collection.objects.link(cam_obj)

# Front isometric view directly facing sign & pond diorama
cam_obj.location = (0.9, -3.2, 2.4)
dir_vec = Vector((0.0, 0.15, 0.35)) - cam_obj.location
cam_obj.rotation_euler = dir_vec.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam_obj

# Three-point warm cartoon lighting
bpy.ops.object.light_add(type='SUN', location=(3.0, -3.0, 6.0))
sun = bpy.context.object
sun.data.energy = 4.8
sun.data.color = (1.0, 0.97, 0.92)
sun.rotation_euler = (math.radians(40), math.radians(22), math.radians(-32))

bpy.ops.object.light_add(type='AREA', location=(-3.0, -2.0, 4.0))
fill = bpy.context.object
fill.data.energy = 140.0
fill.data.size = 3.5
fill.data.color = (0.75, 0.90, 1.0)

bpy.ops.object.light_add(type='AREA', location=(0.0, 4.0, 3.8))
rim = bpy.context.object
rim.data.energy = 95.0
rim.data.size = 2.8
rim.data.color = (1.0, 0.98, 0.94)

# Render Settings
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

preview_img_path = os.path.join(PREVIEWS_DIR, 'kolam_becabur.png')
scene.render.filepath = preview_img_path

print(f"Rendering high-res preview to: {preview_img_path}...")
bpy.ops.render.render(write_still=True)
print("Render finished successfully!")
