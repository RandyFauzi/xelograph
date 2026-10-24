import bpy
from campus_primitives import *

def create_avatar():
 skin=material('AvatarSkin','#c78e65');shirt=material('AvatarShirt','#367fcb');pants=material('AvatarPants','#344859');hair=material('AvatarHair','#49362b');shoe=material('AvatarShoe','#f6f3e7');ink=material('AvatarEyes','#253644');hat=material('AvatarCap','#f0b168')
 cube('Torso',(0,0,.87),(.5,.31,.51),shirt,.095)
 cube('Collar',(0,-.012,1.105),(.24,.28,.05),shoe,.025)
 for side,x in [('L',-.145),('R',.145)]:
  before=set(bpy.context.scene.objects)
  cube('Trouser_'+side,(x,0,.39),(.19,.225,.43),pants,.045)
  cube('Sneaker_'+side,(x,-.055,.14),(.225,.33,.16),shoe,.05)
  cube('Sole_'+side,(x,-.055,.075),(.23,.335,.035),shirt,.012)
  for y in [-.07,-.12]:cube('Shoelace',(x,y,.227),(.12,.018,.014),ink)
  pivot=bpy.data.objects.new('Leg_'+side,None);bpy.context.collection.objects.link(pivot);pivot.location=(x,0,.61)
  bpy.context.view_layer.update()
  for o in new_objects(before):
   if o!=pivot:matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
 for side,x in [('L',-.34),('R',.34)]:
  before=set(bpy.context.scene.objects)
  cube('Sleeve_'+side,(x,0,.88),(.16,.24,.31),shirt,.06)
  cube('Forearm_'+side,(x,0,.66),(.13,.17,.19),skin,.045)
  ico('Hand_'+side,(x,-.015,.55),(.085,.09,.1),skin,2)
  pivot=bpy.data.objects.new('Arm_'+side,None);bpy.context.collection.objects.link(pivot);pivot.location=(x,0,1.02)
  bpy.context.view_layer.update()
  for o in new_objects(before):
   if o!=pivot:matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
 ico('Head',(0,0,1.4),(.29,.265,.32),skin,3)
 for x in [-.278,.278]:ico('Ear',(x,.015,1.39),(.045,.055,.075),skin,2)
 ico('Hair_short',(0,.015,1.59),(.3,.27,.18),hair,2)
 ico('Hair_bob',(0,.09,1.43),(.325,.235,.34),hair,2)
 cylinder('Hair_cap',(0,.015,1.64),.3,.12,hat,16)
 cube('Cap_brim',(0,-.22,1.64),(.38,.27,.04),hat,.035)
 for x in [-.1,.1]:
  ico('Eye',(x,-.25,1.42),(.024,.016,.03),ink,2)
  cube('Brow',(x,-.247,1.49),(.06,.015,.012),hair,.004)
 cube('Smile',(0,-.26,1.29),(.065,.012,.012),hair,.005)
