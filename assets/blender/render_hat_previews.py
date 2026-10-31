"""
Render individual transparent 512x512 shop preview icons for 12 Hats
Saves directly to public/branding/store/ and assets/previews/
"""

import bpy
import math
import os
from mathutils import Vector, Euler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
ROOT_DIR = os.path.dirname(PROJECT_ROOT)

MODELS_DIR = os.path.join(ROOT_DIR, "public", "models")
STORE_IMG_DIR = os.path.join(ROOT_DIR, "public", "branding", "store")
PREVIEWS_DIR = os.path.join(ROOT_DIR, "assets", "previews")

os.makedirs(STORE_IMG_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)

hat_ids = [
    "hat_01_cap_blue",
    "hat_02_snapback_red",
    "hat_03_beanie_black",
    "hat_04_bucket_safari",
    "hat_05_snapback_black_red",
    "hat_06_fedora_brown",
    "hat_07_straw_luffy",
    "hat_08_visor_green",
    "hat_09_winter_pompom",
    "hat_10_sweatband_sports",
    "hat_11_crown_gold",
    "hat_12_bandana_pirate",
]

for hat_id in hat_ids:
    glb_path = os.path.join(MODELS_DIR, f"{hat_id}.glb")
    out_png = os.path.join(STORE_IMG_DIR, f"{hat_id}.png")
    out_prev = os.path.join(PREVIEWS_DIR, f"{hat_id}.png")
    
    if not os.path.exists(glb_path):
        print(f"Skipping missing: {glb_path}")
        continue
        
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import GLB
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    # Rotate for 3/4 isometric preview matching the reference image
    for obj in bpy.context.scene.objects:
        obj.rotation_euler = Euler((math.radians(14), 0, math.radians(-28)), 'XYZ')
        for poly in getattr(obj.data, 'polygons', []):
            poly.use_smooth = False
            
    # Transparent background
    world = bpy.data.worlds.new("StoreWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.05, 0.05, 0.06, 1.0)
        bg.inputs["Strength"].default_value = 0.5
        
    # Key light
    bpy.ops.object.light_add(type='AREA', location=(1.5, -2.0, 1.8))
    key = bpy.context.active_object
    key.data.energy = 90
    key.data.size = 2.0
    key.data.color = (1.0, 0.98, 0.95)
    key.rotation_euler = Euler((math.radians(50), 0, math.radians(35)), 'XYZ')
    
    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(-1.8, -1.5, 1.5))
    fill = bpy.context.active_object
    fill.data.energy = 50
    fill.data.size = 2.5
    fill.data.color = (0.92, 0.95, 1.0)
    fill.rotation_euler = Euler((math.radians(45), 0, math.radians(-50)), 'XYZ')
    
    # Rim light
    bpy.ops.object.light_add(type='AREA', location=(0.0, 1.8, 1.6))
    rim = bpy.context.active_object
    rim.data.energy = 75
    rim.data.size = 3.0
    rim.data.color = (1.0, 1.0, 1.0)
    rim.rotation_euler = Euler((math.radians(-45), 0, math.radians(180)), 'XYZ')
    
    # Camera setup framed cleanly on hat
    bpy.ops.object.camera_add(location=(0.0, -1.25, 0.65))
    cam = bpy.context.active_object
    cam.data.lens = 52
    bpy.context.scene.camera = cam
    
    target = Vector((0.0, 0.0, 0.08))
    cam_dir = target - cam.location
    cam.rotation_euler = cam_dir.to_track_quat('-Z', 'Y').to_euler()
    
    # Render settings
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = out_png
    
    print(f"Rendering thumbnail: {out_png}")
    bpy.ops.render.render(write_still=True)
    
    import shutil
    shutil.copy2(out_png, out_prev)

print("All 12 hat preview icons rendered successfully!")
