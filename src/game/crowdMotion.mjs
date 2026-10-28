import { Vector3 } from 'three';

/** Bind baked vertices to their authored shoulder pivot, or a shared neck pivot. */
export function avatarIdleJoint(object) {
  if (object.userData.idleJoint) return object.userData.idleJoint;
  for (let node = object; node; node = node.parent) {
    if (node.name === 'Arm_R' || node.name === 'Arm_L') {
      const p = node.getWorldPosition(new Vector3());
      return [p.x, p.y, p.z, node.name === 'Arm_R' ? 2 : 3];
    }
  }
  if (/^(Head|Ear|Eye|Brow|Smile|Hair_|Cap_brim)/.test(object.name)) return [0, 1.12, 0, 1];
  return [0, 0, 0, 0];
}

export function crowdPhase(id) {
  let seed = 2166136261;
  for (const letter of id) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619);
  return ((seed >>> 0) / 4294967296) * Math.PI * 2;
}

/** Also used for envelope tests against the actual authored avatar vertices. */
export function sampleCrowdMotion(time, phase, enabled = true) {
  if (!enabled) return { head: 0, right: 0, left: 0, breath: 0, turn: 0 };
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const cycle = (((time + phase * 3.1831) % 20) + 20) % 20;
  const wave = smooth(0, 0.6, cycle) * (1 - smooth(2.4, 3, cycle));
  return {
    head: Math.sin(time * 0.37 + phase) * 0.14,
    right: wave * (2.2 + 0.18 * Math.sin(time * 6 + phase)),
    left: Math.sin(time * 0.65 + phase) * 0.035,
    breath: Math.sin(time * 1.65 + phase) * 0.008,
    turn: Math.sin(time * 0.23 + phase) * 0.025,
  };
}

const declarations = /* glsl */ `
attribute vec4 idleJoint;
attribute float idlePhase;
uniform float idleTime;
uniform float idleEnabled;
mat3 idleYaw(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c,0.,-s, 0.,1.,0., s,0.,c);
}
mat3 idleJointRotation() {
  float angle = 0.;
  if (idleJoint.w > 1.5 && idleJoint.w < 2.5) {
    float cycle = mod(idleTime + idlePhase * 3.1831, 20.);
    float wave = smoothstep(0., .6, cycle) * (1. - smoothstep(2.4, 3., cycle));
    angle = wave * (2.2 + .18 * sin(idleTime * 6. + idlePhase));
  } else if (idleJoint.w > 2.5) {
    angle = sin(idleTime * .65 + idlePhase) * .035;
  } else if (idleJoint.w > .5) {
    return idleYaw(sin(idleTime * .37 + idlePhase) * .14 * idleEnabled);
  }
  angle *= idleEnabled;
  float c = cos(angle), s = sin(angle);
  return mat3(c,s,0., -s,c,0., 0.,0.,1.);
}
mat3 idleBodyRotation() {
  return idleYaw(sin(idleTime * .23 + idlePhase) * .025 * idleEnabled);
}
`;

/** Keep material batching and instance colors; only two shared uniforms change per frame. */
export function animateCrowdMaterial(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.idleTime = uniforms.time;
    shader.uniforms.idleEnabled = uniforms.enabled;
    shader.vertexShader =
      declarations +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `
        #include <beginnormal_vertex>
        float idleBreath = sin(idleTime * 1.65 + idlePhase) * .008 * idleEnabled;
        objectNormal.y /= 1. + (position.y > .65 ? idleBreath : 0.);
        objectNormal = idleBodyRotation() * idleJointRotation() * objectNormal;
      `,
        )
        .replace(
          '#include <begin_vertex>',
          `
        #include <begin_vertex>
        transformed = idleJointRotation() * (transformed - idleJoint.xyz) + idleJoint.xyz;
        transformed.y += max(transformed.y - .65, 0.) * idleBreath;
        transformed = idleBodyRotation() * transformed;
      `,
        );
  };
  material.customProgramCacheKey = () => 'xylograph-crowd-idle-v1';
  return material;
}
