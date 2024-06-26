let [cos, sin] = [Math.cos.bind(Math), Math.sin.bind(Math)];

let gameState = "menu";

let enemyVel = null, planeVel = null, rollSpeed = null, pitchSpeed = null, enemyRollSpeed = null, enemyPitchSpeed = null, aimAssistRange = null;
let bulletVel = null;
let planeBaseVel = null;
let enemyLeadsAim = null;

let plane = null, enemy = null, map = null;

function resetValues() {
  enemyVel = 1.5; planeVel = 1.5; rollSpeed = 0.1; pitchSpeed = 0.04; enemyRollSpeed = 0.1; enemyPitchSpeed = 0.03; aimAssistRange = Math.PI/24; bulletVel = 5;
  planeBaseVel = 1.5;
  enemyLeadsAim = true;
  shapes = []; bullets = [];
  plane = copyShape(planeTemplate); shapes.push(plane);
  map = copyShape(mapTemplate); shapes.push(map);
  enemy = copyShape(enemyTemplate); 
  enemy.moveInDirection(150);
  enemy.update(Math.PI, "yaw");
  shapes.push(enemy);
  shapes.push(enemy);
}

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
  if (gameState === "playing" && !isLoading) {
    if (keys["p"] || document.pointerLockElement === null || !document.hasFocus()) gameState = "justPaused";
  }
  if (gameState === "playing" && !isLoading) {
    clear(canvas);
    ctx.fillStyle = "skyblue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "grey";
    let cameraSpeed = 1, cameraDistance = 10;
    camFollow = plane;
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
    let transformCamera = roll.multiply(pitch);
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
        /*let minDist = pts.reduce((a, b) => Math.min(a, Math.sqrt((b[0]-camPos[0])**2+(b[2]-camPos[2])**2)), Infinity);
        if (minDist > 200) continue;*/

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
            let transformed = transformCamera.multiply(matrix.from([[pt[0]-camPos[0]+shape.offset[0]], [pt[1]-camPos[1]+shape.offset[1]], [pt[2]-camPos[2]+shape.offset[2]]])).list;
            transformCache.set(str, transformed);
            return transformed;
          }
        });
        if (pts.some(pt => pt[2] < 0)) {
          if (pts.filter(pt => pt[2] > 0).length >= 1) {
            pts = pts.map(pt => pt[2] <= 0 ? [pt[0], pt[1], Math.abs(pt[2])*.1] : pt);
          } else continue;
        }
        let centroid = center(pts);
        
        if (cameraDot > 0) dot = -dot;
        let rgb = null;
        if (poly.mtl in materials) rgb = materials[poly.mtl];
        else rgb = [128, 128, 128];
        rgb = rgb.map(n => n*(1-dot/3));
        pts.mtl = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        pts.meanZ = Math.sqrt((centroid[0])**2+(centroid[1])**2+(centroid[2])**2);

        renderList.push(pts)
      }
    }
    renderList.sort((a, b) => b.meanZ-a.meanZ)
    for (let pts of renderList) {
      ctx.fillStyle = pts.mtl;
      ctx.strokeStyle = pts.mtl;
      ctx.lineWidth = 1;
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

    if (keys["arrowleft"] || keys["a"]) {
      plane.update(rollSpeed, "roll")
    }
    if (keys["arrowright"] || keys["d"]) {
      plane.update(-rollSpeed, "roll")
    }
    if (keys["arrowup"] || keys["w"]) {
      plane.update(pitchSpeed*.7*(planeVel/planeBaseVel), "pitch")
    }
    if (keys["arrowdown"] || keys["s"]) {
      plane.update(-pitchSpeed*(planeVel/planeBaseVel), "pitch")
    }
    if (keys[" "]) {
      spawnShot(plane, true);
    }
    
    plane.moveInDirection(planeVel);
    enemy.moveInDirection(enemyVel);
    planeVel += Math.sin(plane.localFrame.roll[2] * -0.015);
    planeVel += (planeBaseVel-planeVel)/50;

    for (let bullet of bullets) {
      bullet.moveInDirection(bulletVel);
      bullet.move([Math.random()-.5, Math.random()-.5, Math.random()-.5].map(n=>n*.2));
      bullet.distance += bulletVel;
      if (bullet.distance > 200) {
        bullets.splice(bullets.indexOf(bullet), 1);
        shapes.splice(shapes.indexOf(bullet), 1);
      }
    }

    let target = enemyLeadsAim ? leadAim(enemy.offset, plane.offset, bulletVel*1.5, [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]].map(n=>n*planeVel))[1] : plane.offset;
    let overallAngle = dotProduct(unit([enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]]), unit(target.map((n, idx) => n-enemy.offset[idx])));
    let totalDist = Math.sqrt(plane.offset.map((n, idx) => (n-enemy.offset[idx])**2).reduce((a, b) => a+b));
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
    if (totalDist < 50 && Math.acos(overallAngle) < aimAssistRange) spawnShot(enemy);

    let difference = performance.now()-lastTime;
    lastTime = performance.now();
    drawText(ctx, "FPS: " + Math.round(1000/difference), canvas.width-42, 10, 10, "black", "left");
  }
  canvas.style.cursor = "auto";
  if (gameState === "paused") {
    if (mouseDown) {
      (async function() {
        await canvas.requestPointerLock();
        if (document.pointerLockElement === canvas) gameState = "playing";
      })();
    }
  }
  if (gameState === "justPaused") {
    document.exitPointerLock();
    gameState = "paused";
    ctx.fillStyle = "rgba(175, 175, 175, 0.8)";
    ctx.beginPath();
    ctx.roundRect(canvas.width/2-150, canvas.height/2-150, 300, 150, 5);
    ctx.fill();
    drawText(ctx, "Paused!", canvas.width/2, canvas.height/2-100, 40, "black", "center", "Helvetica");
    drawText(ctx, "Click anywhere to resume", canvas.width/2, canvas.height/2-60, 20, "black", "center", "Helvetica");
    drawText(ctx, "Press 'm' to return to the menu", canvas.width/2, canvas.height/2-30,  20, "black", "center", "Helvetica");
  }
  if ((gameState === "playing" || gameState === "paused") && keys["m"]) {
    gameState = "menu";
    document.exitPointerLock();
  }
  if (gameState === "menu" || gameState === "credits") {
    clear(canvas);
    ctx.fillStyle = "lightblue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState === "menu") {
      ctx.drawImage(thumbnail, canvas.width/2-thumbnail.width*.75/2-(mouseX-50)/2, canvas.height/2-thumbnail.height*.75/2-(mouseY-50)/2, thumbnail.width*.75, thumbnail.height*.75);
      /*ctx.font = "bold 60px Arial";
      ctx.fillStyle = "rgb(0, 0, 0, .7)";
      ctx.fillText("Plane Battle", canvas.width/2, 90);*/
    }
    for (let button of Button.buttons) {
      if (button.props.targetScreen === gameState) {
        button.draw();
        if (mouseDown && button.isHovering(mouseX, mouseY)) button.props.event();
      }
    }
  }
  
  if (gameState === "credits") {
    drawText(ctx, "Credits", canvas.width/2, 30, 40, "black", "center", "Helvetica");
    drawText(ctx, "Valley Terrain by Zsky [CC-BY] (https://creativecommons.org/licenses/by/3.0/)", canvas.width/2, 70, 20, "black", "center", "Verdana");
    drawText(ctx, "via Poly Pizza (https://poly.pizza/m/u78ByZHYB2); modified", canvas.width/2, 92, 20, "black", "center", "Verdana");
    drawText(ctx, "Rotations code by Mike 'Pomax' Kamermans (https://stackoverflow.com/a/78518869/15938577)", canvas.width/2, 120, 20, "black", "center", "Verdana");
  }
}, 20);

let bullets = [];
function spawnShot(from, target=false) {
  let shot = copyShape(bullet);
  shot.update(from.rotate[0], "yaw");
  shot.update(-from.rotate[1], "pitch");
  shot.move(from.offset.map((n, idx) => n-shot.offset[idx]));
  shot.moveInDirection(2+Math.random()-.5);
  shot.distance = 0;
  shapes.push(shot);
  bullets.push(shot);
  if (target && enemy !== null) {
    let lead = leadAim(plane.offset, enemy.offset, bulletVel, [enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]].map(n=>n*enemyVel));
    let currentAim = [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]];
    if (Math.acos(dotProduct(unit(lead[1].map((n, idx) => n-plane.offset[idx])), currentAim)) < aimAssistRange) {
      shot.localFrame.roll = [lead[0][2], lead[0][0], lead[0][1]];
    }
  }
}

canvas.addEventListener("mousemove", function(e) {
  if (gameState === "playing") {
    camAngle[0] -= e.movementX/200;
    camAngle[1] = Math.max(Math.min(camAngle[1]-e.movementY/200, Math.PI/2), -Math.PI/2);
  } else {
    let bd = canvas.getBoundingClientRect();
    let mousePos = [(e.clientX - bd.left)*canvas.width/Number(getComputedStyle(canvas).width.replace("px", "")), (e.clientY - bd.top)*canvas.height/Number(getComputedStyle(canvas).height.replace("px", ""))];
    mouseX = mousePos[0]/canvas.width*100; mouseY = mousePos[1]/canvas.height*100;
  }
});
canvas.addEventListener("mousedown", function(e) {
  if (e.buttons !== 1) {e.preventDefault(); e.stopPropagation();return;}
  mouseDown = true;
});
canvas.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("mouseup", function() {
  mouseDown = false;
});

if (ctx.roundRect === undefined) ctx.roundRect = ctx.rect;
class Button {
	static buttons = [];
	constructor(left, top, width, height, fill, text, targetScreen, event=function(){}) {
		this.props = {left, top, width, height, fill, text, targetScreen, event};
		Button.buttons.push(this);
		this.visible = true;
	}
	isHovering(x, y) {
		return this.visible && x >= this.props.left && x <= this.props.left + this.props.width && y >= this.props.top && y <= this.props.top + this.props.height;
	}
	draw() {
		ctx.beginPath();
		ctx.fillStyle = this.isHovering(mouseX, mouseY) ? "grey" : this.props.fill;
		ctx.roundRect(this.props.left*canvas.width/100, this.props.top*canvas.height/100, this.props.width*canvas.width/100, this.props.height*canvas.height/100, 3);
		ctx.fill();
		ctx.textAlign = "center";
		ctx.textBaseline = 'middle';
		drawText(ctx, this.props.text.value, (this.props.left+this.props.width/2)*canvas.width/100, 
      (this.props.top+this.props.height/2)*canvas.height/100, this.props.text.size, "black", "center", this.props.text.font);
		ctx.textBaseline = 'alphabetic';
		if (this.isHovering(mouseX, mouseY)) canvas.style.cursor = ("pointer");
	}
}
let play = new Button(40, 72.5, 20, 10, "rgb(150, 150, 150)", {value:"Begin Mission", font:"Courier, monospace", size:20}, "menu", async function() {
  await canvas.requestPointerLock();
  if (document.pointerLockElement === canvas) {
    resetValues();
    gameState = "playing";
    let resume = new Button(40, 60, 20, 10, "rgb(150, 150, 150)", {value:"Resume Mission", font:"Courier, monospace", size:20}, "menu", async function() {
      await canvas.requestPointerLock();
      if (document.pointerLockElement === canvas) {
        gameState = "playing";
      }
    });
  }
});
let credits = new Button(28.5, 85, 20, 10, "rgb(150, 150, 150)", {value:"Credits", font:"Courier, monospace", size:20}, "menu", function() {
  gameState = "credits";
  mouseDown = false;
});
let github = new Button(52.5, 85, 20, 10, "rgb(150, 150, 150)", {value:"Github", font:"Courier, monospace", size:20}, "menu", function() {
  let link = document.createElement("a");
  link.href = "https://github.com/gosoccerboy5/plane-battle";
  link.target = "_blank";
  link.click();
  mouseDown = false;
});
let backhome = new Button(40, 70, 20, 10, "rgb(150, 150, 150)", {value:"Home", font:"Courier, monospace", size:20}, "credits", function() {
  gameState = "menu";
  mouseDown = false;
});

let thumbnail = new Image();
thumbnail.src = "https://gosoccerboy5.github.io/plane-battle/assets/thumb_blurred.png";

function drawText(ctx, text, x, y, size=10, color="black", align="center", font="Arial") {
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.font = size + "px " + font;
  ctx.fillText(text, x, y);
}

let fileInput = document.querySelector("input[type=file]");
if (fileInput !== null) {
  fileInput.addEventListener("input", async function(e) {
    let fileType = this.files[0].name.match(/\.(\w+)$/)[1];
    let reader = new FileReader();
    reader.readAsText(this.files[0])
    reader.onload = () => {
      if (fileType === "obj") shapes.push(processObj(reader.result));
      else if (fileType === "mtl") processMtl(reader.result);
    }
  });
}
function copyShape(shape) {
  let newShape = new Shape([]);
  for (let poly of shape.polys) {
    let newPoly = poly.map(pt => pt.map(n=>n));
    newPoly.mtl = poly.mtl;
    newShape.polys.push(newPoly);
  }
  newShape.updateCrossProducts();
  return newShape;
}

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


let keys = {};
let mouseDown = false;
let mouseX = 0, mouseY = 0;
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

let planeTemplate = null, mapTemplate = null, bullet = null, enemyTemplate = null;
Object.defineProperty(window, "isLoading", {
  get() {return [planeTemplate, mapTemplate, bullet, enemyTemplate].some(template => template === null);},
});

fetch("https://gosoccerboy5.github.io/plane-battle/assets/plane.obj").then(res => res.text()).then(obj => {
  planeTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/bullet.obj").then(res => res.text()).then(obj => {
  bullet = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/map.obj").then(res => res.text()).then(obj => {
  mapTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/enemy.obj").then(res => res.text()).then(obj => {
  enemyTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
