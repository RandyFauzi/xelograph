"""Build only the modular avatar, with six authored model previews; leaves world and database untouched."""
import bpy, os, sys
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
from campus_avatar import create_avatar
ROOT=os.path.abspath(os.path.join(HERE,'../..'))
OUT=os.path.join(ROOT,'public','avatars');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
create_avatar()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'xelograph-avatar.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/avatar.glb'),export_format='GLB',export_apply=True)
models=list(bpy.context.scene.objects)

def visible(name,character,hair):
 custom=(character=='female' and hair in ['ponytail','hijab']) or (character=='male' and hair in ['quiff','cap'])
 if name.startswith('Look_'):return name.startswith('Look_'+character+'_'+hair+'_')
 if name=='Torso' and (character=='female' or custom):return False
 if name.startswith('Body_') and (custom or not name.startswith('Body_'+character+'_')):return False
 if name=='Collar' and hair in ['hijab','cap','ponytail']:return False
 if name.startswith(('Sleeve_','Forearm_')) and hair=='hijab':return False
 if name.startswith('Hair_') and not name.startswith('Hair_'+hair):return False
 if name.startswith('Cap_brim') and hair!='cap':return False
 return True

s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16
s.render.threads_mode='FIXED';s.render.threads=4
s.render.resolution_x=300;s.render.resolution_y=360;s.render.resolution_percentage=100
s.render.film_transparent=True
s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.68,.80,.88,1);bg.inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));bpy.context.object.data.energy=550;bpy.context.object.data.size=4
bpy.ops.object.light_add(type='AREA',location=(3,2,4));bpy.context.object.data.energy=250;bpy.context.object.data.size=3
bpy.ops.object.camera_add(location=(2,-5,2.25));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.05;s.camera=camera
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
for character,hair in [('female','long'),('female','ponytail'),('female','hijab'),('male','short'),('male','quiff'),('male','cap')]:
 for obj in models:
  if obj.type=='MESH':obj.hide_render=not visible(obj.name,character,hair)
 s.render.filepath=os.path.join(OUT,character+'-'+hair+'.png')
 bpy.ops.render.render(write_still=True)
print('Six character models exported and rendered.')
