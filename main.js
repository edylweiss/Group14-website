import { DRACOLoader } from "../libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "../libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

// --- CONFIGURATION ---
const DEFAULT_SCALE = { x: 0.15, y: 0.15, z: 0.15 };
const DEFAULT_POS = { x: 0, y: -0.4, z: 0 };
const allModels = []; // For Interaction tracking

const getLanguageFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('lang') || 'english';
};

const initializeMindAR = () => {
  return new window.MINDAR.IMAGE.MindARThree({
    container: document.body,
    imageTargetSrc: '../assets/targets/grp14.mind', 
  });
};

const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('../libs/three.js-r132/examples/js/libs/draco/'); 
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

const loadModel = async (path) => {
  const loader = configureGLTFLoader();
  const model = await loader.loadAsync(path);
  return model;
};

// --- ANCHOR SETUP ---
const setupPage = async (mindarThree, pageIndex, modelPath, audioPath, config) => {
  const anchor = mindarThree.addAnchor(pageIndex);
  const model = await loadModel(modelPath);
  
  const s = config.scale || DEFAULT_SCALE;
  const p = config.position || DEFAULT_POS;
  model.scene.scale.set(s.x, s.y, s.z);
  model.scene.position.set(p.x, p.y, p.z);
  
  // Tag for interaction system
  model.scene.userData.isInteractable = true;
  model.scene.userData.audio = new Audio(audioPath);
  
  anchor.group.add(model.scene);
  allModels.push(model.scene);

  const mixer = new THREE.AnimationMixer(model.scene);
  const actions = [];
  if (model.animations.length > 0) {
    model.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
      actions.push(action);
    });
  }

  model.scene.userData.mixer = mixer;
  model.scene.userData.actions = actions;

  anchor.onTargetFound = () => {
    model.scene.visible = true;
    actions.forEach((a) => { a.paused = false; if (!a.isRunning()) a.play(); });
    model.scene.userData.audio.currentTime = 0;
    model.scene.userData.audio.play().catch(() => {});
  };

  anchor.onTargetLost = () => {
    model.scene.visible = false;
    actions.forEach((a) => a.paused = true);
    model.scene.userData.audio.pause();
  };

  return { mixer };
};

// --- UNIFIED INTERACTION SYSTEM ---
const initInteractionSystem = (camera, renderer) => {
  let currentModel = null;
  let isDragging = false;
  let prevPos = { x: 0, y: 0 };
  let initialPinchDist = 0;
  let initialScale = 1;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const getPos = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const onStart = (e) => {
    const pos = getPos(e);
    prevPos = pos;

    // Handle Pinch Start
    if (e.touches && e.touches.length === 2) {
      initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (currentModel) initialScale = currentModel.scale.x;
      return;
    }

    // Raycast to find model
    mouse.x = (pos.x / window.innerWidth) * 2 - 1;
    mouse.y = -(pos.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(allModels, true);
    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.isInteractable) obj = obj.parent;
      
      if (obj.visible) {
        currentModel = obj;
        isDragging = true;

        // CLICK INTERACTION: Toggle Play/Pause
        const actions = currentModel.userData.actions;
        const audio = currentModel.userData.audio;
        if (actions) {
            actions.forEach(a => a.paused = !a.paused);
            if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
        }
      }
    }
  };

  const onMove = (e) => {
    if (!currentModel || !currentModel.visible) return;

    // PINCH ZOOM
    if (e.touches && e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const zoom = dist / initialPinchDist;
      const s = Math.min(Math.max(initialScale * zoom, 0.05), 0.5);
      currentModel.scale.set(s, s, s);
      return;
    }

    // ROTATION
    if (!isDragging) return;
    const pos = getPos(e);
    currentModel.rotation.y += (pos.x - prevPos.x) * 0.01;
    currentModel.rotation.x += (pos.y - prevPos.y) * 0.01;
    prevPos = pos;
  };

  const canvas = renderer.domElement;
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', () => { isDragging = false; });
  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('wheel', (e) => {
    if (currentModel) {
        const s = Math.min(Math.max(currentModel.scale.x + (e.deltaY * -0.0005), 0.05), 0.5);
        currentModel.scale.set(s, s, s);
    }
  });
};

// --- MAIN EXECUTION ---
document.addEventListener('DOMContentLoaded', () => {
  const start = async () => {
    const language = getLanguageFromURL();
    const mindarThree = initializeMindAR();
    const { renderer, scene, camera } = mindarThree;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 5, 5);
    scene.add(dirLight);

    renderer.clock = new THREE.Clock();
    const pageMixers = [];

    for (let i = 1; i <= 11; i++) {
        const modelPath = `../assets/models/page${i}/page${i}.glb`;
        const audioPath = `../assets/audio/${language}/page ${i}.mp3`;
        try {
            const result = await setupPage(mindarThree, i - 1, modelPath, audioPath, { scale: DEFAULT_SCALE, position: DEFAULT_POS });
            pageMixers.push(result.mixer);
        } catch (error) { console.error(`Error Page ${i}:`, error); }
    }

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';

    initInteractionSystem(camera, renderer); // Start the interaction system

    await mindarThree.start();
    renderer.setAnimationLoop(() => {
      const delta = renderer.clock.getDelta();
      pageMixers.forEach(mixer => mixer.update(delta));
      renderer.render(scene, camera);
    });
  };
  start();
});