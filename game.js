let [cos, sin] = [Math.cos.bind(Math), Math.sin.bind(Math)];

let enemyVel = 1, planeVel = 1, rollSpeed = 0.07, pitchSpeed = 0.05, enemyRollSpeed = 0.1, enemyPitchSpeed = 0.03, aimAssistRange = Math.PI/24;
let enemyLeadsAim = true;

class matrix {
  constructor(list) {
    this.list = list;
    this.dim = [this.list.length, this.list[0].length];
  }
  multiply(other) {
    if (other.dim[0] !== this.dim[1]) return false;
    let newMatrix = matrix.dimensions(this.dim[0], other.dim[1]);
    for (let i = 0; i < this.dim[0]; i++) {
      for (let j = 0; j < other.dim[1]; j++) {
      	newMatrix.list[i][j] = this.list[i].map((el, idx) => el*other.list[idx][j]).reduce((a, b)=>a+b);
      }
    }
    return newMatrix;
  }
  static from(list) {return new matrix(list);}
  static dimensions(r, c) {
    let list = [];
    for (let i = 0; i < r; i++) {
      list.push((new Array(c)).fill(0));
    }
    return new matrix(list);
  }
  static identity(n) {
    let list = [];
    for (let i = 0; i < n; i++) {
      list.push([]);
      for (let j = 0; j < n; j++) {
        if (i === j) list.at(-1).push(1);
        else list.at(-1).push(0);
      }
    }
    return new matrix(list);
  }
}
class Shape {
  constructor(polys) {
    this.polys = polys;
    this.offset = [0, 0, 0];
    this.rotate = [0, 0, 0];
    this.speed = 0;
    this.localFrame = {
      "roll": [1, 0, 0],
      "pitch": [0, 1, 0],
      "yaw": [0, 0, 1]
    }
  }
  move(offset) {
    this.offset = this.offset.map((el, idx) => el+offset[idx]);
    this.polys = this.polys.map(poly => {
      let newPoly = poly.map(pt => pt.map((el, idx) => el+offset[idx]));
      newPoly.mtl = poly.mtl;
      newPoly.cross = poly.cross;
      return newPoly;
    });
  }
  moveInDirection(dist) {
    //this.move([dist*Math.sin(this.rotate[0])*Math.cos(this.rotate[1]), dist*Math.sin(this.rotate[1]), dist*Math.cos(this.rotate[0])*Math.cos(this.rotate[1])]);
    this.move([dist*this.localFrame.roll[1], dist*this.localFrame.roll[2], dist*this.localFrame.roll[0]])
  }
  turn(direction) {
    this.rotate = this.rotate.map((n, idx) => n + direction[idx]);
  }
  updateCrossProducts() {
    for (let poly of this.polys) {
      poly.cross = crossPoly(poly);
    }
  }
  update(a, name) {
    const rotationAxis = this.localFrame[name];
    const pv = rotationAxis;
    const [x, y, z] = pv;

    const mc = (1 - cos(a));
    const Q = [
      x * x * mc + cos(a), x * y * mc - z * sin(a), x * z * mc + y * sin(a),
      x * y * mc + z * sin(a), y * y * mc + cos(a), y * z * mc - x * sin(a),
      x * z * mc - y * sin(a), y * z * mc + x * sin(a), z * z * mc + cos(a),
    ];
    this.localFrame.roll = mul(Q, this.localFrame.roll);
    this.localFrame.pitch = mul(Q, this.localFrame.pitch);
    this.localFrame.yaw = mul(Q, this.localFrame.yaw);
    let offset = this.offset;
    this.polys = this.polys.map(poly => {
      let newPoly = poly.map(pt => mul(Q, [pt[2]-offset[2], pt[0]-offset[0], pt[1]-offset[1]]));
      newPoly = newPoly.map(pt => [pt[1]+offset[0], pt[2]+offset[1], pt[0]+offset[2]]);
      newPoly.mtl = poly.mtl;
      newPoly.cross = poly.cross;
      return newPoly;
    });
    this.updateCrossProducts();
    if (name === "roll") {
      this.rotate[2] += a;

    }
    this.rotate[1] = Math.atan2(this.localFrame.roll[2], Math.sqrt(this.localFrame.roll[0]**2+this.localFrame.roll[1]**2))
    this.rotate[0] = (Math.atan2(this.localFrame.roll[1], (this.localFrame.roll[0])))
  };
}

function mul(M, v) {
   let x, y, z;
   if (v.length === 3) {
     x = v[0];
     y = v[1];
     z = v[2];
   } else {
     x = v.x;
     y = v.y;
     z = v.z;
   }
   return [
     M[0] * x + M[1] * y + M[2] * z,
     M[3] * x + M[4] * y + M[5] * z,
     M[6] * x + M[7] * y + M[8] * z,
   ];
 }
function crossProduct(vec1, vec2) {
  return (matrix.from([[0, -vec1[2], vec1[1]], [vec1[2], 0, -vec1[0]], [-vec1[1], vec1[0], 0]])).multiply(matrix.from([[vec2[0]], [vec2[1]], [vec2[2]]]));
}
function crossPoly(pts) {
  return unit(crossProduct([pts[1][0]-pts[0][0], pts[1][1]-pts[0][1], pts[1][2]-pts[0][2]], [pts[2][0]-pts[1][0], pts[2][1]-pts[1][1], pts[2][2]-pts[1][2]]).list.flat());
}
function dotProduct(vec1, vec2) {
  return vec1.reduce((a, b, idx) => a+b*vec2[idx], 0);
}
function center(list) {
  return list.reduce((a, b) => a.map((el, idx) => el+b[idx]/list.length), [0,0,0]);
}
function unit(list) {
  let dist = list.reduce((a, b) => a+b**2, 0)**0.5;
  return list.map(n => n/dist);
}
function leadAim(initPos, targetPos, speed, targetVel) {
  let collisionPos = targetPos, time = null;
  for (let i = 0; i < 5; i++) {
    time = Math.sqrt(collisionPos.map((n, idx) => (n-initPos[idx])**2).reduce((a, b) => a+b))/speed;
    collisionPos = targetPos.map((n, idx) => n+targetVel[idx]*time);
  }
  return [unit(collisionPos.map((n, idx) => n-initPos[idx])), collisionPos];
}
function distInDir(dirVec, init, pt) {
  if (init === null) init = [0, 0, 0];
  return dotProduct(unit(dirVec), pt.map((n, idx) => n-init[idx]));
}

let camFollow = null;

let points = [[0, 0, 1], [1, 0, 1], [1, 1, 2]];

let shapes = [];

let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");

function circle(x, y, radius) {
  ctx.arc(x, y, radius, 0, Math.PI*2);
  ctx.fill();
  ctx.closePath();
}

let camAngle = [0, 0], camPos = [0, 0, 0];

function project(point) {
  return [point[0]/(point[2])*canvas.width/2+canvas.width/2, -point[1]/Math.abs(point[2])*canvas.height/2+canvas.height/2, Math.max(10/point[2], 0)];
}
function clear(canvas) {
	let ctx = canvas.getContext("2d");
	ctx.beginPath();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.closePath();
}

let lastTime = performance.now();
setInterval(function() {
  clear(canvas);
  ctx.fillStyle = "lightblue";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "grey";
  let cameraSpeed = 1, cameraDistance = 10;
  if (camFollow === null) {
    if (keys["w"]) {
      camPos[2] += Math.cos(camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
      camPos[0] += Math.sin(-camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
      camPos[1] += Math.sin(camAngle[1]) * cameraSpeed;
    }
    if (keys["s"]) {
      camPos[2] -= Math.cos(camAngle[0]) * cameraSpeed * Math.cos(camAngle[1])
      camPos[0] -= Math.sin(-camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
      camPos[1] -= Math.sin(camAngle[1]) * cameraSpeed;
    }
    if (keys["a"]) {
      camPos[2] -= Math.sin(camAngle[0]) * cameraSpeed;
      camPos[0] -= Math.cos(-camAngle[0]) * cameraSpeed;
    }
    if (keys["d"]) {
      camPos[2] += Math.sin(camAngle[0]) * cameraSpeed;
      camPos[0] += Math.cos(-camAngle[0]) * cameraSpeed;
    }
  } else {
    camPos[0] = camFollow.offset[0] + Math.sin(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
    camPos[1] = camFollow.offset[1] - Math.sin(camAngle[1]) * cameraDistance + cameraDistance/5;
    camPos[2] = camFollow.offset[2] - Math.cos(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
  }

  let yaw = matrix.from([[Math.cos(camAngle[0]), -Math.sin(camAngle[0]), 0], [Math.sin(camAngle[0]), Math.cos(camAngle[0]), 0], [0, 0, 1]]);
  let roll = matrix.from([[1, 0, 0], [0, Math.cos(camAngle[1]), -Math.sin(camAngle[1])], [0, Math.sin(camAngle[1]), Math.cos(camAngle[1])]]);
  let pitch = matrix.from([[Math.cos(camAngle[0]), 0, Math.sin(camAngle[0])], [0, 1, 0], [-Math.sin(camAngle[0]), 0, Math.cos(camAngle[0])]]);
  points = []

  let renderList = [];
  let cache = [[],[]]
  for (let shape of shapes) {
    let rotationX = matrix.from([[Math.cos(shape.rotate[2]), -Math.sin(shape.rotate[2]), 0], [Math.sin(shape.rotate[2]), Math.cos(shape.rotate[2]), 0], [0, 0, 1]]);
    let rotationY = matrix.from([[Math.cos(shape.rotate[0]), 0, Math.sin(shape.rotate[0])], [0, 1, 0], [-Math.sin(shape.rotate[0]), 0, Math.cos(shape.rotate[0])]]);
    let rotationZ = matrix.from([[1, 0, 0], [0, Math.cos(-shape.rotate[1]), -Math.sin(-shape.rotate[1])], [0, Math.sin(-shape.rotate[1]), Math.cos(-shape.rotate[1])]]);
    let transformCache = new Map();
    for (let poly of shape.polys) {
      let pts = poly.map(pt => [[pt[0]-shape.offset[0]], [pt[1]-shape.offset[1]], [pt[2]-shape.offset[2]]]);
      let cross = poly.cross;
      /*if (shape.rotate.some(n => n !== 0)) {
        pts = pts.map(pt => (rotationY.multiply(rotationZ).multiply(rotationX).multiply(matrix.from(pt)).list));
        cross = crossPoly(pts);
      }*/
      let dot = dotProduct(cross, unit([.5, -1, 0]));

      let cameraDot = dotProduct(cross, unit([pts[1][0]-camPos[0]+shape.offset[0], pts[1][1]-camPos[1]+shape.offset[1], pts[1][2]-camPos[2]+shape.offset[2]]));
      pts = pts.map(pt => {
        let str = JSON.stringify(pt);
        if (transformCache.has(str)) {
          return transformCache.get(str)
        } else {
          let transformed = roll.multiply(pitch).multiply(matrix.from([[pt[0]-camPos[0]+shape.offset[0]], [pt[1]-camPos[1]+shape.offset[1]], [pt[2]-camPos[2]+shape.offset[2]]])).list;
          transformCache.set(str, transformed);
          return transformed;
        }
      });
      if (pts.some(pt => pt[2] < 0)) {
        if (pts.filter(pt => pt[2] > 0).length >= 1) {
          pts = pts.map(pt => pt[2] <= 0 ? [pt[0], pt[1], Math.abs(pt[2])*.1] : pt);
        } else continue;
      }
      let centroid = center(pts)
      if (centroid[2] > 200) continue;
      if (cameraDot > 0) dot = -dot;
      let rgb = null;
      if (poly.mtl in materials) rgb = materials[poly.mtl];
      else rgb = [128, 128, 128];
      rgb = rgb.map(n => n*(1-dot/4));
      pts.mtl = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      pts.meanZ = Math.sqrt((centroid[0])**2+(centroid[1])**2+(centroid[2])**2);

      renderList.push(pts)
    }
  }
  renderList.sort((a, b) => b.meanZ-a.meanZ)
  for (let pts of renderList) {
    ctx.fillStyle = pts.mtl;
    ctx.strokeStyle = pts.mtl;
    pts = pts.map(project)
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();

    ctx.stroke();
    ctx.fill()
  }
  ctx.fillStyle = "black"
  for (let point of points) {
    let data = project(roll.multiply(pitch).multiply(matrix.from([[point[0]-camPos[0]], [point[1]-camPos[1]], [point[2]-camPos[2]]])).list)
    circle(data[0], data[1], 10);
  }


  if (plane) camFollow = plane;
  if (keys["arrowleft"] || keys["a"]) {
    plane.update(rollSpeed, "roll")
  }
  if (keys["arrowright"] || keys["d"]) {
    plane.update(-rollSpeed, "roll")
  }
  if (keys["arrowup"] || keys["w"]) {
    plane.update(pitchSpeed*.7, "pitch")
  }
  if (keys["arrowdown"] || keys["s"]) {
    plane.update(-pitchSpeed, "pitch")
  }
  if (keys[" "]) {
    spawnShot(plane, true);
  }
  
  plane.moveInDirection(planeVel);
  enemy.moveInDirection(enemyVel);

  for (let bullet of bullets) {
    bullet.moveInDirection(5);
    bullet.move([Math.random()-.5, Math.random()-.5, Math.random()-.5].map(n=>n*.2));
    bullet.distance += 5;
    if (bullet.distance > 200) {
      bullets.splice(bullets.indexOf(bullet), 1);
      shapes.splice(shapes.indexOf(bullet), 1);
    }
  }

  let target = enemyLeadsAim ? leadAim(enemy.offset, plane.offset, 5, [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]].map(n=>n*planeVel))[1] : plane.offset;
  let overallAngle = dotProduct(unit([enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]]), unit(target.map((n, idx) => n-enemy.offset[idx])));
  if (overallAngle < .9999) {
    let distSide = distInDir([enemy.localFrame.pitch[1], enemy.localFrame.pitch[2], enemy.localFrame.pitch[0]], enemy.offset, target);
    let distVert = distInDir([enemy.localFrame.yaw[1], enemy.localFrame.yaw[2], enemy.localFrame.yaw[0]], enemy.offset, target);
    let distFront = distInDir([enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]], enemy.offset, target);
    let angle = Math.atan2(distVert, distSide);
    let vertAngle = Math.atan2(distVert, distFront);
    if (Math.abs(angle-Math.PI/2) < enemyRollSpeed) {
      enemy.update(angle-Math.PI/2, "roll");
      enemy.update(Math.max(-enemyPitchSpeed,-vertAngle), "pitch")
    } else if (distSide > 0) enemy.update(-enemyRollSpeed, "roll");
    else if (distSide < 0) enemy.update(enemyRollSpeed, "roll");
  }
  if (Math.acos(overallAngle) < aimAssistRange) spawnShot(enemy);
  let difference = performance.now()-lastTime;
  lastTime = performance.now();
}, 20);


canvas.addEventListener("mousemove", function(e) {
  camAngle[0] -= e.movementX/200;
  camAngle[1] = Math.max(Math.min(camAngle[1]-e.movementY/200, Math.PI/2), -Math.PI/2);
});
canvas.addEventListener("click", function(e) {
  canvas.requestPointerLock();
})

/*let fileInput = document.querySelector("input[type=file]");
fileInput.addEventListener("input", async function(e) {
  let fileType = this.files[0].name.match(/\.(\w+)$/)[1];
  let reader = new FileReader();
  reader.readAsText(this.files[0])
  reader.onload = () => {
    if (fileType === "obj") shapes.push(processObj(reader.result));
    else if (fileType === "mtl") processMtl(reader.result);
  }
});*/

function processObj(text) {
  let vertices = text.match(/\nv (.+?) (.+?) (.+)/g);
  vertices = vertices.map(vertex => vertex.match(/ ([-\.\d]+)/g).map(Number));
  let shape = new Shape([]);
  let materialSections = text.match(/(usemtl .+?)\n((?!usemtl).+?\n?)+/g) || [text];
  for (let materialSection of materialSections) {
    let mtl = materialSection.match(/usemtl (.+)\n/)?.[1];
    let polys = materialSection.match(/\nf (\d+\/\d+\/\d+ ?)+/g);

    for (let poly of polys) {
      let pts = poly.match(/ \d+/g).map(pt => vertices[Number(pt)-1].map(n=>n));
      pts.mtl = mtl;
      shape.polys.push(pts);
    }
  }
  shape.offset = center(shape.polys.map(center))
  shape.updateCrossProducts();
  return shape;
}
let materials = {};
function processMtl(text) {
  let mtls = text.match(/[\n^] *newmtl (.+)\n(.*?\n){8}/g);
  for (let material of mtls) {
    let name = material.match(/[\n^] *newmtl (.+)\n/)[1];
    let color = material.match(/\n *Kd ((\d\.?\d*[ \n]){3})/)[1].split(" ").map(n=>256*Number(n));
    materials[name] = color;
  }
}

let bullets = [];
function spawnShot(from, target=false) {
  let shot = new Shape([]);
  for (let poly of bullet.polys) {
    let newPoly = poly.map(pt => pt.map(n=>n));
    newPoly.mtl = poly.mtl;
    shot.polys.push(newPoly);
  }
  shot.update(from.rotate[0], "yaw");
  shot.update(-from.rotate[1], "pitch");
  shot.move(from.offset.map((n, idx) => n-shot.offset[idx]));
  shot.moveInDirection(2+Math.random()-.5);
  shot.distance = 0;
  shapes.push(shot);
  bullets.push(shot);
  if (target && enemy !== null) {
    let lead = leadAim(plane.offset, enemy.offset, 5, [enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]].map(n=>n*enemyVel));
    let currentAim = [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]];
    if (Math.acos(dotProduct(unit(lead[1].map((n, idx) => n-plane.offset[idx])), currentAim)) < aimAssistRange) {
      shot.localFrame.roll = [lead[0][2], lead[0][0], lead[0][1]];
    }
  }
}

let keys = {};
document.addEventListener("keydown", function(e) {
	keys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
	delete keys[e.key.toLowerCase()];
});

["bullet", "plane", "map", "enemy"].forEach(name => {
  fetch("https://gosoccerboy5.github.io/plane-battle/assets/" + name + ".mtl").then(res => res.text()).then(mtl => {
    processMtl(mtl);
  });
});

let plane = null, map = null, bullet = null, enemy = null;

fetch("https://gosoccerboy5.github.io/plane-battle/assets/plane.obj").then(res => res.text()).then(obj => {
  plane = processObj(obj);
  shapes.push(plane);
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/bullet.obj").then(res => res.text()).then(obj => {
  bullet = processObj(obj);
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/map.obj").then(res => res.text()).then(obj => {
  map = processObj(obj);
  shapes.push(map);
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/enemy.obj").then(res => res.text()).then(obj => {
  enemy = processObj(obj);
  enemy.moveInDirection(150);
  enemy.update(Math.PI, "yaw");
  shapes.push(enemy);
});