import { AnimationClip, AnimationMixer, LoopRepeat } from 'three';

function equalTrack(a, b) {
  return a.getInterpolation() === b.getInterpolation()
    && a.times.length === b.times.length && a.values.length === b.values.length
    && a.times.every((value, index) => value === b.times[index])
    && a.values.every((value, index) => value === b.values[index]);
}

function isStatic(track) {
  // Cubic-spline values interleave in/out tangents; do not classify those as
  // static using the ordinary keyframe layout.
  if (track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) return false;
  const stride = track.getValueSize();
  return track.values.every((value, index) => Math.abs(value - track.values[index % stride]) < 1e-7);
}

export function prepareAnimation(root, sourceClips) {
  const bindings = new Map();
  const duplicates = [];
  for (const clip of sourceClips) {
    for (const track of clip.tracks) {
      const previous = bindings.get(track.name);
      if (!previous) {
        bindings.set(track.name, { clip, track });
      } else if (equalTrack(previous.track, track)) {
        duplicates.push({ property: track.name, discarded: clip.name, reason: 'identical' });
      } else if (isStatic(previous.track) !== isStatic(track)) {
        const discardPrevious = isStatic(previous.track);
        duplicates.push({ property: track.name, discarded: discardPrevious ? previous.clip.name : clip.name, reason: 'static duplicate' });
        if (discardPrevious) bindings.set(track.name, { clip, track });
      } else {
        throw new Error(`Animation export conflict: ${track.name} is controlled differently by ${previous.clip.name} and ${clip.name}`);
      }
    }
  }
  const mixer = new AnimationMixer(root);
  const actions = [];
  for (const source of sourceClips) {
    const tracks = source.tracks.filter((track) => {
      const owner = bindings.get(track.name);
      return owner?.clip === source && owner.track === track;
    });
    if (!tracks.length) continue;
    const clip = new AnimationClip(source.name, source.duration, tracks, source.blendMode);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity).setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    actions.push(action);
  }
  mixer.update(0);
  return {
    mixer, actions,
    diagnostics: { sourceClips: sourceClips.length, playingClips: actions.length, tracks: bindings.size, duplicates },
    dispose() {
      mixer.stopAllAction();
      for (const action of actions) mixer.uncacheClip(action.getClip());
      mixer.uncacheRoot(root);
    },
  };
}
