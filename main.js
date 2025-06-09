import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js';
























let scene, camera, renderer;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let draggingBlock = null;
let offset = new THREE.Vector3();

let rows = 5, cols = 20;
let spacingAngle = Math.PI * 2 / cols; // angle between blocks on cylinder
let radius = 3;
let spacingY = 2;
let blocks = [];
let colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];
let score = 0;
let scoreText; // score sprite
const victoryScreen = document.getElementById('victoryScreen');
const victoryBtn = document.getElementById('victoryBtn');
// Adjust layout scale for smaller screens
let isMobile = window.innerWidth < 768;
let blockRadius = isMobile ? 0.9 : 2.5;
let blockHeight = isMobile ? 1.2 : 3;
//let radius = isMobile ? 9 : 15;
//let spacingY = isMobile ? 2.5 : 3.0;
//let rows = 5, cols = 8;
//let spacingAngle = Math.PI * 2 / cols;



init();
animate();

function init() {
  scene = new THREE.Scene();
  //scene.background = new THREE.Color(0x202020);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 10, 0);
  camera = new THREE.PerspectiveCamera(
    isMobile ? 75 : 60,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  camera.position.set(0, isMobile ? 12 : 10, isMobile ? 35 : 40);
  camera.lookAt(0, 10, 0);
  
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

  document.body.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));

  createGrid();
  createScoreText();

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  



  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  
  window.addEventListener('resize', onWindowResize);
  // Show hand and fade out after 4 seconds
  let inactivityTimer;
  const handHint = document.getElementById('handHint');
  
  // Hide hand after initial 4s
  setTimeout(() => fadeOutHand(), 4000);
  
  // Reset inactivity timer on interaction
  ['pointerdown', 'mousemove', 'touchstart'].forEach(event => {
    window.addEventListener(event, () => {
      clearTimeout(inactivityTimer);
      fadeOutHand();
      inactivityTimer = setTimeout(showHandHint, 5000); // 5s of inactivity
    });
  });
  
  function showHandHint() {
    handHint.style.display = 'block';
    handHint.style.opacity = '1';
  }
  
  function fadeOutHand() {
    handHint.style.opacity = '0';
    setTimeout(() => {
      handHint.style.display = 'none';
    }, 1000);
  }
  

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

  playNowBtn.style.display = 'none';
  playNowBtn.addEventListener('click', () => {
    playNowBtn.style.display = 'none';
    resetGame();
  });
}

function createGrid() {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      addBlock(col, row);
    }
  }
}

function addBlock(col, row) {
  let color = colors[Math.floor(Math.random() * colors.length)];
  let material = new THREE.MeshStandardMaterial({ color });
  let hex = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 2, 6),
    material
  );
  

  // Calculate position on cylindrical surface
  let angle = col * spacingAngle;
  hex.position.x = radius * Math.sin(angle);
  hex.position.z = radius * Math.cos(angle);
  hex.position.y = row * spacingY;

  // Rotate block to face outward from cylinder center
  hex.rotation.y = angle;

  scene.add(hex);

  blocks.push({
    mesh: hex,
    row: row,
    col: col,
    color: color,
    targetAngle: angle,
    currentAngle: angle,
  });
}

function onPointerDown(event) {
  setMousePosition(event);

  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObjects(blocks.map(b => b.mesh));
  if (intersects.length > 0) {
    let selected = intersects[0].object;
    draggingBlock = blocks.find(b => b.mesh === selected);
    offset.copy(intersects[0].point).sub(selected.position);
  }
}

function onPointerMove(event) {
  if (!draggingBlock) return;

  setMousePosition(event);
  raycaster.setFromCamera(mouse, camera);

  // Project onto horizontal plane Y=draggingBlock.position.y
  let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -draggingBlock.mesh.position.y);
  let intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersection);
  intersection.sub(offset);

  // Calculate angle from center to intersection point
  let angle = Math.atan2(intersection.x, intersection.z);
  if (angle < 0) angle += Math.PI * 2;

  // Update targetAngle of dragging block
  draggingBlock.targetAngle = angle;

  // Arrange all blocks in same row as a chain around the cylinder
  let draggingY = draggingBlock.mesh.position.y;
  let rowBlocks = blocks.filter(b =>
    Math.abs(b.mesh.position.y - draggingY) < 0.5
  );
  rowBlocks.sort((a, b) => a.col - b.col);
  let startIdx = rowBlocks.findIndex(b => b === draggingBlock);

  rowBlocks[startIdx].targetAngle = draggingBlock.targetAngle;

  // Spread blocks to left (previous indices)
  for (let i = startIdx - 1; i >= 0; i--) {
    rowBlocks[i].targetAngle = rowBlocks[i + 1].targetAngle - spacingAngle;
    if (rowBlocks[i].targetAngle < 0) rowBlocks[i].targetAngle += Math.PI * 2;
  }
  // Spread blocks to right (next indices)
  for (let i = startIdx + 1; i < rowBlocks.length; i++) {
    rowBlocks[i].targetAngle = rowBlocks[i - 1].targetAngle + spacingAngle;
    if (rowBlocks[i].targetAngle > Math.PI * 2) rowBlocks[i].targetAngle -= Math.PI * 2;
  }
}

function onPointerUp() {
  if (!draggingBlock) return;

  const row = draggingBlock.row;
  let rowBlocks = blocks.filter(b => b.row === row);

  // Sort blocks based on final targetAngle
  rowBlocks.sort((a, b) => a.targetAngle - b.targetAngle);

  // Snap each block to the nearest valid column position
  for (let i = 0; i < rowBlocks.length; i++) {
    let snappedAngle = (i * spacingAngle) % (Math.PI * 2);
    rowBlocks[i].targetAngle = snappedAngle;
    rowBlocks[i].col = i;
  }

  draggingBlock = null;
  checkAllColumnsForMatch();
}


function checkAllColumnsForMatch() {
  // Group blocks by column index based on closest angle
  let columnMap = new Map();

  for (let b of blocks) {
    // Find closest column by angle
    let colIdx = Math.round(b.targetAngle / spacingAngle) % cols;
    if (!columnMap.has(colIdx)) {
      columnMap.set(colIdx, []);
    }
    columnMap.get(colIdx).push(b);
  }

  // Check each column
  for (let [colIdx, colBlocks] of columnMap) {
    if (colBlocks.length !== rows) continue;

    const firstColor = colBlocks[0].color;
    const allSame = colBlocks.every(b => b.color === firstColor);

    if (allSame) {
      colBlocks.forEach(b => {
        b.mesh.material.emissive = new THREE.Color(0x00ff00);
        b.mesh.material.emissiveIntensity = 1.0;
      
        createParticleExplosion(b.mesh.position, b.color); // 🎇 add explosion
        playMatchSound(); // 🔊 add sound (see next section)
      
        animateBlockOut(b.mesh, () => {
          scene.remove(b.mesh);
          blocks = blocks.filter(block => block !== b);
        });
      });
      
      function animateBlockOut(mesh, onComplete) {
        let startY = mesh.position.y;
        let startTime = null;
      
        function animate(time) {
          if (!startTime) startTime = time;
          let elapsed = time - startTime;
          let progress = Math.min(elapsed / 500, 1);
      
          mesh.position.y = startY + progress * 3; // move up
          mesh.scale.setScalar(1 - progress);      // scale down
      
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            onComplete();
          }
        }
      
        requestAnimationFrame(animate);
      }
      
      function createParticleExplosion(position, color) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        const sizes = [];
      
        for (let i = 0; i < particleCount; i++) {
          const px = position.x;
          const py = position.y;
          const pz = position.z;
      
          positions.push(px, py, pz);
          velocities.push(
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5 + 0.2,
            (Math.random() - 0.5) * 0.5
          );
          sizes.push(Math.random() * 0.2 + 0.1);
        }
      
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      
        const material = new THREE.PointsMaterial({
          color,
          size: 0.2,
          transparent: true,
          opacity: 1.0,
        });
      
        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
      
        let startTime = performance.now();
      
        function animateExplosion() {
          const elapsed = performance.now() - startTime;
          const positions = geometry.attributes.position.array;
          const velocities = geometry.attributes.velocity.array;
      
          for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];
          }
      
          geometry.attributes.position.needsUpdate = true;
      
          material.opacity -= 0.02;
      
          if (material.opacity > 0) {
            requestAnimationFrame(animateExplosion);
          } else {
            scene.remove(particles);
          }
        }
      
        animateExplosion();
      }
      function playMatchSound() {
        const sound = document.getElementById('matchSound');
        if (sound) {
          sound.currentTime = 0;
          sound.play();
        }
      }
      
      
     
      
      setTimeout(() => {
        for (let r = 0; r < rows; r++) {
          addBlock(colIdx, r);
        }
        updateScore();

        // Show play now button after sorting
        //showPlayNowButton();
      }, 500);
    } else {
      colBlocks.forEach(b => {
        b.mesh.material.emissive.set(0x000000);
      });
    }
  }
}

function animateMoveY(mesh, targetY, delay) {
  let startY = mesh.position.y;
  let startTime = null;

  function animate(time) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime - delay;
    if (elapsed < 0) {
      requestAnimationFrame(animate);
      return;
    }

    const progress = Math.min(elapsed / 400, 1);
    mesh.position.y = startY + (targetY - startY) * progress;

    if (progress < 1) requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

function animate() {
  requestAnimationFrame(animate);

  for (let b of blocks) {
    // Smoothly move currentAngle toward targetAngle
    let diff = b.targetAngle - b.currentAngle;

    // Normalize angle difference (-PI, PI)
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    b.currentAngle += diff * 0.2;

    // Update block position and rotation on cylinder
    b.mesh.position.x = radius * Math.sin(b.currentAngle);
    b.mesh.position.z = radius * Math.cos(b.currentAngle);
    b.mesh.rotation.y = b.currentAngle;

    b.mesh.position.y = b.row * spacingY;
  }

  renderer.render(scene, camera);
}

function setMousePosition(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function createScoreText() {
  let canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  let context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.font = 'bold 32px Arial';
  context.fillText('Score: 0', 10, 40);

  let texture = new THREE.CanvasTexture(canvas);
  let material = new THREE.SpriteMaterial({ map: texture });
  scoreText = new THREE.Sprite(material);
  scoreText.position.set(-20, 30, 0);
  scene.add(scoreText);
  scoreText.userData.context = context;
  scoreText.userData.canvas = canvas;
  scoreText.userData.texture = texture;
}

function updateScore() {
  score += 10;
  let ctx = scoreText.userData.context;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('Score: ' + score, 10, 40);
  scoreText.userData.texture.needsUpdate = true;
  const scoreDiv = document.getElementById('scoreDisplay');
  if (scoreDiv) {
    scoreDiv.textContent = 'Score: ' + score;
  }
  if (score >= 1) {
    showVictoryScreen(); // 🎉 show win screen
    launchConfetti();    // 🎉 shoot confetti
  }
}

function showVictoryScreen() {
  document.getElementById('victoryScreen').style.display = 'flex';
}
function launchConfetti() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    zIndex: 2000,
  });
}

function restartGame() {
  document.getElementById('victoryScreen').style.display = 'none';
  resetGame();
}
victoryBtn.addEventListener('click', () => {
  window.open('https://play.google.com/store/apps/details?id=com.gamebrain.hexasort', '_blank');
});

function showPlayNowButton() {
  playNowBtn.style.display = 'block';
}

function resetGame() {
  for (let b of blocks) {
    scene.remove(b.mesh);
  }
  blocks = [];
  score = 0;

  const scoreDiv = document.getElementById('scoreDisplay');
  if (scoreDiv) {
    scoreDiv.textContent = 'Score: 0';
  }

  createGrid();
}

