import bpy,os,math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'assets','previews');os.makedirs(OUT,exist_ok=True)
def render(asset,name,location,target,scale,character='male'):
 bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets','blender',asset))
 s=bpy.context.scene
 try:s.render.engine='CYCLES';s.cycles.samples=16
 except TypeError:pass
 s.render.resolution_x=1200;s.render.resolution_y=900;s.render.resolution_percentage=100
 s.render.threads_mode='FIXED';s.render.threads=4
 s.world.color=(.65,.78,.85)
 s.world.use_nodes=True
 bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.68,.80,.88,1);bg.inputs[1].default_value=.65
 bpy.ops.object.light_add(type='AREA',location=(-8,-10,20));bpy.context.object.data.energy=2400;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=12
 bpy.ops.object.light_add(type='SUN',location=(0,0,15));bpy.context.object.rotation_euler=(.35,-.45,-.35);bpy.context.object.data.energy=1.6;bpy.context.object.data.angle=.35
 bpy.ops.object.camera_add(location=location);cam=bpy.context.object;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;s.camera=cam
 s.render.filepath=os.path.join(OUT,name);s.render.image_settings.file_format='PNG'
 if asset.endswith('avatar.blend'):
  for o in s.objects:
   if o.name.startswith('Hair_'):o.hide_render=not o.name.startswith('Hair_long' if character=='female' else 'Hair_short')
   if o.name.startswith('Cap_brim'):o.hide_render=True
   if o.name=='Torso':o.hide_render=character=='female'
   if o.name.startswith('Body_female_'):o.hide_render=character!='female'
 bpy.ops.render.render(write_still=True)
render('xelograph-world.blend','world.png',(45,-57,50),(0,-6,0),78)
render('xelograph-avatar.blend','avatar.png',(2,-4,2.1),(0,0,.9),2.3)
render('xelograph-avatar.blend','avatar-female.png',(2,-4,2.1),(0,0,.9),2.3,'female')
