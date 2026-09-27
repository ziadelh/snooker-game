var Engine = Matter.Engine;
var Render = Matter.Render;
var World = Matter.World;
var Bodies = Matter.Bodies;
var Mouse = Matter.Mouse;
var Runner = Matter.Runner;
var Body = Matter.Body;
var Events = Matter.Events;
var MouseConstraint = Matter.MouseConstraint;
var Constraint = Matter.Constraint;

var engine;
var world;

var tableLength = 800;
var tableWidth = tableLength / 2;
var ballDiameter = tableWidth / 36;
var pocketDiameter = ballDiameter * 1.5;

var redBalls = [];
var coloredBalls = [];
var cueBall = null;

var isCueBallPlaced = false;
var isCueVisible = false;
var hitPower = 0;
var maxCueSpeed = 10;
var lastMouseX, lastMouseY;
var cueBallVelocity = { x: 0, y: 0 };
var pockets = [];

// Sound variables
var hitSound, pocketSound;
var gameMode = 1; 
var originalPositions = {}; 
var collisionMessage = '';
var score = 0;

var tutorialSteps = [];
var currentStep = 0;
var showTutorial = true; 

var collisionMessages = []; 
var messageDuration = 5000; 

function preload() {
    soundFormats('mp3', 'wav');
    hitSound = loadSound('libraries/hit.mp3.wav');
    pocketSound = loadSound('libraries/pocket.wave.wav');
}

function setup() {
    createCanvas(1000, 700);
    background(255);
    angleMode(DEGREES);
    
    // create an engine
    engine = Engine.create();
    world = engine.world;
    engine.world.gravity.y = 0;
    
    // Add table boundaries and pockets
    addTableBoundaries();
    addPockets(); 
    drawTable();
    drawStartingPositions();
    document.addEventListener('keydown', handleKeyPress);
    Runner.run(engine);
    
    Events.on(engine, 'collisionStart', function (event) {
        var pairs = event.pairs;
        pairs.forEach(function (pair) {
            hitSound.play();
            handleCueBallAndCushions(pair);
            handleBallMovements(pair);
        });
    });
    
    originalPositions = {};
    // Define tutorial steps
    tutorialSteps = [
        { message: "Welcome to the snooker tutorial! Press '4' to proceed.", action: null },
        { message: "Step 1: Place the cue ball within the 'D' zone.", action: highlightDZone },
        { message: "Step 2: Aim the cue stick. Move the mouse to aim.", action: highlightCue },
        { message: "Step 3: Adjust the hit power. Use the up and down arrow keys.", action: highlightPower },
        { message: "Step 4: Hit the cue ball. Press the spacebar.", action: highlightHit },
        { message: "Step 5: Try to pot a red ball into any pocket.", action: highlightBalls },
        { message: "Congratulations! You've completed the tutorial. Press '4' to play a practice game.", action: endTutorial }
    ];
}

function draw() {
    background(255);
    drawTable();
    drawBalls();
    if (isCueVisible && isCueBallStationary()) {
        drawCue();
    }

    updateCueBallPosition();
    updateBallsPosition();
    checkPocketedBalls();
    checkOutOfBoundsBalls();

    drawBottomBar();
}

function drawBottomBar() {
    let barHeight = 120;
    fill(50, 50, 50);
    noStroke();
    rect(0, height - barHeight, width, barHeight);

    fill(255);
    textSize(18);
    textAlign(LEFT, TOP);
    textFont('Arial');
    
    text('Score: ' + score, 20, height - barHeight + 20);
    text('Hit Power: ' + hitPower, 20, height - barHeight + 50);

    displayCollisionMessages(200, height - barHeight + 20);
    displayTutorialMessage(600, height - barHeight + 20);
}

function displayCollisionMessages(x, y) {
    fill(255);
    noStroke();
    textSize(14);
    var currentTime = millis();
    collisionMessages = collisionMessages.filter(msg => currentTime - msg.timestamp < messageDuration);
    collisionMessages.forEach((msg, index) => {
        text(msg.message, x, y + index * 20);
    });
}

function displayTutorialMessage(x, y) {
    if (showTutorial) {
        fill(255);
        noStroke();
        textSize(14);
        let lines = tutorialSteps[currentStep].message.split('. ');
        lines.forEach((line, index) => {
            text(line, x, y + index * 20);
        });
        if (tutorialSteps[currentStep].action) {
            tutorialSteps[currentStep].action();
        }
    }
}

function nextTutorialStep() {
    if (currentStep < tutorialSteps.length - 1) {
        currentStep++;
    } else {
        showTutorial = false; 
    }
}

function highlightDZone() {
    // Highlight the 'D' zone area on the table
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;
    push();
    translate(xOffset, yOffset);    
    stroke(255, 255, 0);
    noFill();
    arc(tableLength / 4, tableWidth / 2, tableLength / 4, tableLength / 4, 90, 270);
    pop();
}

function highlightCue() {
    // Highlight the cue stick
    if (cueBall) {
        push();
        stroke(255, 0, 0);
        strokeWeight(2);
        let cueLength = 100;
        let cueDirection = createVector(lastMouseX - cueBall.x, lastMouseY - cueBall.y);
        cueDirection.setMag(cueLength);
        line(cueBall.x, cueBall.y, cueBall.x + cueDirection.x, cueBall.y + cueDirection.y);
        pop();
    }
}

function highlightPower() {
    // Highlight the hit power area
    fill(255, 0, 0);
    noStroke();
    textSize(16);
}

function highlightHit() {
    // Highlight the cue ball hit action
    if (cueBall) {
        push();
        stroke(0, 255, 0);
        strokeWeight(2);
        let cueLength = 100;
        let cueDirection = createVector(lastMouseX - cueBall.x, lastMouseY - cueBall.y);
        cueDirection.setMag(cueLength);
        line(cueBall.x, cueBall.y, cueBall.x + cueDirection.x, cueBall.y + cueDirection.y);
        pop();
    }
    fill(0, 255, 0);
    noStroke();
    textSize(16);
}

function highlightBalls() {
    // Highlight the red balls
    redBalls.forEach(ball => {
        push();
        stroke(255, 0, 0);
        strokeWeight(2);
        ellipse(ball.x, ball.y, ballDiameter + 5, ballDiameter + 5);
        pop();
    });
}

function endTutorial() {
    fill(0, 255, 0);
    noStroke();
    textSize(16);
}

function checkOutOfBoundsBalls() {
    let outOfBoundsBalls = [];

    redBalls.forEach((ball, index) => {
        if (isOutOfBounds(ball.body.position)) {
            outOfBoundsBalls.push(ball);
            redBalls.splice(index, 1);
            World.remove(world, ball.body);
        }
    });

    coloredBalls.forEach((ball, index) => {
        if (isOutOfBounds(ball.body.position)) {
            outOfBoundsBalls.push(ball);
            coloredBalls.splice(index, 1);
            World.remove(world, ball.body);
        }
    });

    if (cueBall && isOutOfBounds(cueBall.body.position)) {
        outOfBoundsBalls.push(cueBall);
        World.remove(world, cueBall.body);
        cueBall = null;
        isCueBallPlaced = false;
    }
}

function isOutOfBounds(position) {
    return (
        position.x < 0 ||
        position.x > width ||
        position.y < 0 ||
        position.y > height
    );
}

function drawTable() {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;
    push();
    translate(xOffset, yOffset);

    // Draw the wooden part of the table borders
    fill(139, 69, 19); 
    noStroke();
    rect(-20, -20, tableLength + 40, tableWidth + 40, 20);
    
    // Draw the darker green part of the table borders (cushions)
    fill(0, 100, 0);
    rect(0, 0, tableLength, 10); 
    rect(0, tableWidth, tableLength, 0); 
    rect(0, 0, 10, tableWidth); 
    rect(tableLength, 0, 0, tableWidth); 
    
    // Draw the table surface 
    fill(34, 139, 34);
    noStroke();
    rect(0, 0, tableLength, tableWidth); 
    
    // Draw pockets
    pockets.forEach(pocket => {
        fill(211, 211, 211);
        ellipse(pocket.position.x - xOffset, pocket.position.y - yOffset, pocketDiameter, pocketDiameter);
    });
    
    // Add shadows on the table surface 
    for (let i = 0; i < 10; i++) {
        let alpha = map(i, 0, 10, 50, 0);
        stroke(0, 0, 0, alpha);
        line(10 + i, 10 + i, tableLength - 10 - i, 10 + i); // Top shadow
        line(10 + i, tableWidth - 10 - i, tableLength - 10 - i, tableWidth - 10 - i);
        line(10 + i, 10 + i, 10 + i, tableWidth - 10 - i); // Left shadow
        line(tableLength - 10 - i, 10 + i, tableLength - 10 - i, tableWidth - 10 - i); 
    }

    // Draw the "D" zone
    noFill();
    stroke(255);
    strokeWeight(2);
    arc(tableLength / 4, tableWidth / 2, tableLength / 4, tableLength / 4, 90, 270);

    // Draw the baulk line
    line(tableLength / 4, 0, tableLength / 4, tableWidth);

    // Draw the baulk spots
    fill(255);
    noStroke();
    ellipse(tableLength / 4, tableWidth / 2, ballDiameter / 2, ballDiameter / 2);
    ellipse(tableLength / 4, tableWidth / 4, ballDiameter / 2, ballDiameter / 2); 
    ellipse(tableLength / 4, tableWidth * 3 / 4, ballDiameter / 2, ballDiameter / 2); 

    // Draw center spots
    fill(255);
    noStroke();
    ellipse(tableLength / 2, tableWidth / 2, ballDiameter / 2, ballDiameter / 2); 
    ellipse(tableLength * 3 / 4, tableWidth / 2, ballDiameter / 2, ballDiameter / 2); 
    ellipse(tableLength * 7 / 8, tableWidth / 2, ballDiameter / 2, ballDiameter / 2);

    pop();
}

function createPockets() {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    pockets = [
        { x: 0, y: 0 },
        { x: tableLength / 2, y: 0 }, 
        { x: tableLength, y: 0 }, 
        { x: 0, y: tableWidth }, 
        { x: tableLength / 2, y: tableWidth },
        { x: tableLength, y: tableWidth } 
    ];
}

////////////////////////////////////////////

function handleKeyPress(event) {
    if (event.key === '4' && showTutorial) {
        nextTutorialStep();
    } else if (!showTutorial) {
        switch (event.key) {
            case '1':
                resetGame(1);
                break;
            case '2':
                resetGame(2);
                break;
            case '3':
                resetGame(3);
                break;
            case ' ':
                if (isCueBallPlaced && isCueBallStationary()) hitCueBall();
                break;
            case 'ArrowUp':
                increaseHitPower();
                break;
            case 'ArrowDown':
                decreaseHitPower();
                break;
        }
    }
}

function resetGame(mode) {
    removeBalls();
    if (mode === 1) drawStartingPositions();
    if (mode === 2) drawRandomRedBalls();
    if (mode === 3) drawRandomAllBalls();
    cueBall = null;
    isCueBallPlaced = false;
    gameMode = mode;
}

function mouseMoved() {
    if (cueBall && isCueBallStationary()) {
        isCueVisible = true;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }
}

function mousePressed() {
    if (!isCueBallPlaced) {
        placeCueBall(mouseX, mouseY);
    } else if (cueBall && isCueBallStationary()) {
        hitCueBall();
    }
}

function placeCueBall(x, y) {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;
    let centerX = xOffset + tableLength / 4;
    let centerY = yOffset + tableWidth / 2;
    let radius = tableLength / 8;

    let distance = dist(x, y, centerX, centerY);
    let angle = atan2(y - centerY, x - centerX);

    if (distance <= radius && (angle <= -90 || angle >= 90)) {
        cueBall = { x: x, y: y };
        isCueBallPlaced = true;

        let cueBallBody = Bodies.circle(cueBall.x, cueBall.y, ballDiameter, {
            restitution: 0.9,
            friction: 0.1,
            frictionAir: 0.01,
            density: 1.0
        });
        World.add(world, cueBallBody);
        cueBall.body = cueBallBody;
    }
}

function drawCue() {
    if (cueBall && isCueVisible) {
        push();
        stroke(255, 255, 0);
        strokeWeight(5);
        let cueLength = 100;
        let cueDirection = createVector(lastMouseX - cueBall.x, lastMouseY - cueBall.y);
        cueDirection.setMag(cueLength);
        line(cueBall.x, cueBall.y, cueBall.x + cueDirection.x, cueBall.y + cueDirection.y);
        pop();
    }
}

function hitCueBall() {
    if (cueBall) {
        let cueDirection = createVector(lastMouseX - cueBall.x, lastMouseY - cueBall.y);
        let cueVelocity = p5.Vector.normalize(cueDirection).mult(hitPower);
        Matter.Body.setVelocity(cueBall.body, { x: cueVelocity.x, y: cueVelocity.y });
        hitPower = 0;
        isCueVisible = false;
    }
}

function isCueBallStationary() {
    if (cueBall && cueBall.body) {
        let velocity = cueBall.body.velocity;
        let speed = sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        return speed < 0.1;
    }
    return false;
}

function updateCueBallPosition() {
    if (cueBall && cueBall.body) {
        cueBall.x = cueBall.body.position.x;
        cueBall.y = cueBall.body.position.y;
    }
}

function updateBallsPosition() {
    redBalls.forEach(ball => {
        if (ball.body) {
            ball.x = ball.body.position.x;
            ball.y = ball.body.position.y;
        }
    });

    coloredBalls.forEach(ball => {
        if (ball.body) {
            ball.x = ball.body.position.x;
            ball.y = ball.body.position.y;
        }
    });
}

function increaseHitPower() {
    if (hitPower < maxCueSpeed) hitPower += 1;
}

function decreaseHitPower() {
    if (hitPower > 0) hitPower -= 1;
}

function drawStartingPositions() {
    redBalls = [];
    coloredBalls = [];

    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    let startX = tableLength * 0.75 + ballDiameter;
    let startY = tableWidth / 2;
    let rows = 5;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= row; col++) {
            let x = startX + row * (ballDiameter - 1);
            let y = startY + (col - row / 2) * (ballDiameter + 1);
            redBalls.push({ x: x + xOffset, y: y + yOffset });

            let ballBody = Bodies.circle(x + xOffset, y + yOffset, ballDiameter / 2, {
                restitution: 0.9,
                friction: 0.005,
                frictionAir: 0.01,
                density: 0.002
            });
            World.add(world, ballBody);
            redBalls[redBalls.length - 1].body = ballBody;
        }
    }

    setColoredBallsAndCueBall(xOffset, yOffset);
    drawBalls();
}

function drawRandomRedBalls() {
    redBalls = [];
    coloredBalls = [];

    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    setColoredBallsAndCueBall(xOffset, yOffset);

    for (let i = 0; i < 15; i++) {
        let position;
        do {
            position = {
                x: random(ballDiameter, tableLength - ballDiameter) + xOffset,
                y: random(ballDiameter, tableWidth - ballDiameter) + yOffset
            };
        } while (isOverlapping(position, redBalls) || isOverlapping(position, coloredBalls));
        redBalls.push(position);

        let ballBody = Bodies.circle(position.x, position.y, ballDiameter / 2, {
            restitution: 0.9,
            friction: 0.01,
            density: 1.0
        });
        World.add(world, ballBody);
        redBalls[redBalls.length - 1].body = ballBody;
    }
    drawBalls();
}

function drawRandomAllBalls() {
    redBalls = [];
    coloredBalls = [];

    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    for (let i = 0; i < 15; i++) {
        let position;
        do {
            position = {
                x: random(ballDiameter, tableLength - ballDiameter) + xOffset,
                y: random(ballDiameter, tableWidth - ballDiameter) + yOffset
            };
        } while (isOverlapping(position, redBalls) || isOverlapping(position, coloredBalls));
        redBalls.push(position);

        let ballBody = Bodies.circle(position.x, position.y, ballDiameter / 2, {
            restitution: 0.9,
            friction: 0.01,
            density: 1.0
        });
        World.add(world, ballBody);
        redBalls[redBalls.length - 1].body = ballBody;
    }

    let colors = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
    for (let i = 0; i < colors.length; i++) {
        let position;
        do {
            position = {
                x: random(ballDiameter, tableLength - ballDiameter) + xOffset,
                y: random(ballDiameter, tableWidth - ballDiameter) + yOffset
            };
        } while (isOverlapping(position, redBalls) || isOverlapping(position, coloredBalls));
        coloredBalls.push({ ...position, color: colors[i] });

        let ballBody = Bodies.circle(position.x, position.y, ballDiameter / 2, {
            restitution: 0.9,
            friction: 0.01,
            density: 1.0
        });
        World.add(world, ballBody);
        coloredBalls[coloredBalls.length - 1].body = ballBody;
    }
    drawBalls();
}

function setColoredBallsAndCueBall(xOffset, yOffset) {
    let colors = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
    let positions = [
        { x: tableLength / 4, y: tableWidth * 3 / 4 },
        { x: tableLength / 4, y: tableWidth / 4 },
        { x: tableLength / 4, y: tableWidth / 2 },
        { x: tableLength / 2, y: tableWidth / 2 },
        { x: tableLength * 3 / 4, y: tableWidth / 2 },
        { x: tableLength * 7 / 8, y: tableWidth / 2 }
    ];

    for (let i = 0; i < colors.length; i++) {
        let pos = positions[i];
        coloredBalls.push({ x: pos.x + xOffset, y: pos.y + yOffset, color: colors[i] });
        originalPositions[colors[i]] = { x: pos.x + xOffset, y: pos.y + yOffset };

        let ballBody = Bodies.circle(pos.x + xOffset, pos.y + yOffset, ballDiameter / 2, {
            restitution: 0.9,
            friction: 0.01,
            density: 1.0
        });
        World.add(world, ballBody);
        coloredBalls[coloredBalls.length - 1].body = ballBody;
    }
}

function isOverlapping(position, balls, minDistance = ballDiameter) {
    for (let ball of balls) {
        let distance = dist(position.x, position.y, ball.x, ball.y);
        if (distance < minDistance) return true;
    }
    return pockets.some(pocket => {
        let dx = position.x - pocket.position.x;
        let dy = position.y - pocket.position.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        return distance < pocketDiameter;
    });
}

function drawBalls() {
    fill(0, 0, 0, 50);
    redBalls.forEach(ball => ellipse(ball.x + 2, ball.y + 2, ballDiameter, ballDiameter));
    coloredBalls.forEach(ball => ellipse(ball.x + 2, ball.y + 2, ballDiameter, ballDiameter));
    if (cueBall) ellipse(cueBall.x + 2, cueBall.y + 2, ballDiameter, ballDiameter);

    fill('red');
    redBalls.forEach(ball => ellipse(ball.x, ball.y, ballDiameter, ballDiameter));

    coloredBalls.forEach(ball => {
        fill(ball.color);
        ellipse(ball.x, ball.y, ballDiameter, ballDiameter);
    });

    if (cueBall) {
        fill('white');
        ellipse(cueBall.x, cueBall.y, ballDiameter, ballDiameter);
    }
}

function addTableBoundaries() {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;
    let borderThickness = 20;

    let boundaries = [
        Bodies.rectangle(xOffset + tableLength / 4, yOffset - borderThickness / 2, tableLength / 2, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset + 3 * tableLength / 4, yOffset - borderThickness / 2, tableLength / 2, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset + tableLength / 4, yOffset + tableWidth + borderThickness / 2, tableLength / 2, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset + 3 * tableLength / 4, yOffset + tableWidth + borderThickness / 2, tableLength / 2, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset - borderThickness / 2, yOffset + tableWidth / 4, borderThickness, tableWidth / 2, { isStatic: true }),
        Bodies.rectangle(xOffset - borderThickness / 2, yOffset + 3 * tableWidth / 4, borderThickness, tableWidth / 2, { isStatic: true }),
        Bodies.rectangle(xOffset + tableLength + borderThickness / 2, yOffset + tableWidth / 4, borderThickness, tableWidth / 2, { isStatic: true }),
        Bodies.rectangle(xOffset + tableLength + borderThickness / 2, yOffset + 3 * tableWidth / 4, borderThickness, tableWidth / 2, { isStatic: true }),
        Bodies.rectangle(xOffset - borderThickness / 2, yOffset - borderThickness / 2, borderThickness, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset + tableLength + borderThickness / 2, yOffset - borderThickness / 2, borderThickness, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset - borderThickness / 2, yOffset + tableWidth + borderThickness / 2, borderThickness, borderThickness, { isStatic: true }),
        Bodies.rectangle(xOffset + tableLength + borderThickness / 2, yOffset + tableWidth + borderThickness / 2, borderThickness, borderThickness, { isStatic: true })
    ];

    World.add(world, boundaries);
}

function addPockets() {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    pockets = [
        { x: xOffset, y: yOffset },
        { x: xOffset + tableLength / 2, y: yOffset },
        { x: xOffset + tableLength, y: yOffset },
        { x: xOffset, y: yOffset + tableWidth },
        { x: xOffset + tableLength / 2, y: yOffset + tableWidth },
        { x: xOffset + tableLength, y: yOffset + tableWidth }
    ];

    pockets = pockets.map(pocket => Bodies.circle(pocket.x, pocket.y, pocketDiameter, { isSensor: true, isStatic: true }));
    World.add(world, pockets);
}

function checkPocketedBalls() {
    redBalls.forEach((ball, index) => {
        if (isInPocket(ball)) {
            pocketSound.play();
            score += 1;
            World.remove(world, ball.body);
            redBalls.splice(index, 1);
        }
    });

    coloredBalls.forEach((ball, index) => {
        if (isInPocket(ball)) {
            pocketSound.play();
            score += 2;
            World.remove(world, ball.body);
            coloredBalls.splice(index, 1);
            if (ball.color) respawnColoredBall(ball);
        }
    });

    if (cueBall && isInPocket(cueBall)) {
        pocketSound.play();
        World.remove(world, cueBall.body);
        cueBall = null;
        isCueBallPlaced = false;
        score -= 1;
    }
}

function respawnColoredBall(ball) {
    let xOffset = (width - tableLength) / 2;
    let yOffset = (height - tableWidth) / 2;

    if (gameMode === 1 || gameMode === 2) {
        let originalPos = originalPositions[ball.color];
        if (originalPos) {
            let ballBody = Bodies.circle(originalPos.x, originalPos.y, ballDiameter / 2, {
                restitution: 0.9,
                friction: 0.01,
                density: 1.0
            });
            World.add(world, ballBody);
            ball.body = ballBody;
            coloredBalls.push(ball);
        }
    } else if (gameMode === 3) {
        let position;
        do {
            position = {
                x: random(ballDiameter, tableLength - ballDiameter) + xOffset,
                y: random(ballDiameter, tableWidth - ballDiameter) + yOffset
            };
        } while (isOverlapping(position, redBalls) || isOverlapping(position, coloredBalls));

        let ballBody = Bodies.circle(position.x, position.y, ballDiameter / 2, {
            restitution: 0.9,
            friction: 0.01,
            density: 1.0
        });
        World.add(world, ballBody);
        ball.body = ballBody;
        ball.x = position.x;
        ball.y = position.y;
        coloredBalls.push(ball);
    }
}

function isInPocket(ball) {
    if (!ball || !ball.body) return false;

    return pockets.some(pocket => {
        if (!pocket || !pocket.position) return false;
        let dx = ball.body.position.x - pocket.position.x;
        let dy = ball.body.position.y - pocket.position.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        return distance < pocket.circleRadius;
    });
}

function removeBalls() {
    redBalls.forEach(ball => World.remove(world, ball.body));
    redBalls = [];

    coloredBalls.forEach(ball => World.remove(world, ball.body));
    coloredBalls = [];

    if (cueBall && cueBall.body) {
        World.remove(world, cueBall.body);
        cueBall = null;
    }
}

function handleCueBallAndCushions(pair) {
    let bodyA = pair.bodyA;
    let bodyB = pair.bodyB;

    if (cueBall && (bodyA === cueBall.body || bodyB === cueBall.body)) {
        let otherBody = bodyA === cueBall.body ? bodyB : bodyA;

        if (pockets.some(pocket => pocket === otherBody)) {
            addCollisionMessage('Cue ball hit a pocket');
            World.remove(world, cueBall.body);
            cueBall = null;
            isCueBallPlaced = false;
            pocketSound.play();
            score -= 1;
        } else {
            let ballType = detectBallType(otherBody);
            if (ballType === 'cushion') addCollisionMessage('Cue ball hit a cushion');
            if (ballType === 'red') addCollisionMessage('Cue ball hit a red ball');
            if (ballType === 'colored') addCollisionMessage('Cue ball hit a colored ball');
            constrainCueBallWithinBoundaries();
        }
    }
}

function detectBallType(body) {
    if (redBalls.some(ball => ball.body === body)) return 'red';
    if (coloredBalls.some(ball => ball.body === body)) return 'colored';
    return 'cushion';
}

function addCollisionMessage(message) {
    let timestamp = millis();
    collisionMessages.push({ message: message, timestamp: timestamp });
}

function handleBallMovements(pair) {
    let bodyA = pair.bodyA;
    let bodyB = pair.bodyB;

    let ballA = getBallByBody(bodyA);
    let ballB = getBallByBody(bodyB);

    if (ballA && ballB) {
        let velocityA = ballA.body.velocity;
        let velocityB = ballB.body.velocity;
        let normal = Matter.Vector.normalise(Matter.Vector.sub(ballB.body.position, ballA.body.position));
        let relativeVelocity = Matter.Vector.sub(velocityA, velocityB);
        let speed = Matter.Vector.dot(relativeVelocity, normal);

        if (speed > 0) {
            let impulse = (2 * speed) / (ballA.body.mass + ballB.body.mass);
            let impulseVector = Matter.Vector.mult(normal, impulse);
            Body.setVelocity(ballA.body, {
                x: velocityA.x - impulseVector.x * ballB.body.mass,
                y: velocityA.y - impulseVector.y * ballB.body.mass
            });
            Body.setVelocity(ballB.body, {
                x: velocityB.x + impulseVector.x * ballA.body.mass,
                y: velocityB.y + impulseVector.y * ballA.body.mass
            });
        }
    }
}

function getBallByBody(body) {
    return [...redBalls, ...coloredBalls, cueBall].find(ball => ball && ball.body === body) || null;
}

function constrainCueBallWithinBoundaries() {
    if (cueBall && cueBall.body) {
        let xOffset = (width - tableLength) / 2;
        let yOffset = (height - tableWidth) / 2;

        let position = cueBall.body.position;
        position.x = constrain(position.x, xOffset + ballDiameter / 2, xOffset + tableLength - ballDiameter / 2);
        position.y = constrain(position.y, yOffset + ballDiameter / 2, yOffset + tableWidth - ballDiameter / 2);

        Body.setPosition(cueBall.body, position);
    }
}

function constrain(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


