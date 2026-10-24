"""Blender --background --python assets/blender/build_campus.py"""
import bpy,os,sys
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
from campus_world import create_world
from campus_avatar import create_avatar
ROOT=os.path.abspath(os.path.join(HERE,'../..'));OUT=os.path.join(ROOT,'public','models');os.makedirs(OUT,exist_ok=True)
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
clear()
for m in list(bpy.data.materials):bpy.data.materials.remove(m)
create_world()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'xelograph-world.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'world.glb'),export_format='GLB',export_apply=True,export_extras=True)
clear();create_avatar()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'xelograph-avatar.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'avatar.glb'),export_format='GLB',export_apply=True)
print('Original campus and modular avatar exported successfully.')
