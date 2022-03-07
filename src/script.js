import 'bootstrap';
import "./scss/index.scss";
import './style.css';
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as dat from 'dat.gui'

import * as TWEEN from '@tweenjs/tween.js';

import axios from 'axios';

const BASE_URL = 'https://9dhnedfh4h.execute-api.eu-central-1.amazonaws.com/dev';

let username = null;
let startTime = new Date();
let endTime = null;
let currLevel = 1;
let finished = true;
let collected = 0;

const assetUrl = (url) => {
    return `${process.env.NODE_ENV === 'production' ? '/tinr-project': ''}/${url}`;
}

/**
 * Base
 */
// Debug
const gui = new dat.GUI()

// Textures
const textureLoader = new THREE.TextureLoader()
const snakeHeadTexture = textureLoader.load(assetUrl('textures/snake-bite.png'));
const appleFaceTexture = textureLoader.load(assetUrl('textures/shiny-apple.png'));
const ghostIconTexture = textureLoader.load(assetUrl('textures/ghost.png'));
const snailIconTexture = textureLoader.load(assetUrl('textures/snail.png'));

// Models
const modelLoader = new OBJLoader();

// Audio
const listener = new THREE.AudioListener();
const moveSound = new THREE.Audio(listener);
const eatSound = new THREE.Audio(listener);
const failSound = new THREE.Audio(listener);
const passSound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const light = new THREE.DirectionalLight(0xffffff, 0.4)
light.position.x = 100
light.position.y = 100
light.position.z = 0
light.castShadow = true
light.shadow.radius = 2;
scene.add(light)

/**
 * Objects
 */


/**
 * Floor
 */

// position is bottom left
const FLOOR_X_POSITION = 5;
const FLOOR_Y_POSITION = 5;
const FLOOR_Z_POSITION = 0;

const FLOOR_X_SIZE = 10;
const FLOOR_Y_SIZE = 10;
const FLOOR_Z_SIZE = 1;

const FLOOR_X_COUNT = 10;
const FLOOR_Y_COUNT = 10;

const MAX_RADOM_POSITION_ATTEMT = 1000;

const floor = new THREE.Mesh( new THREE.BoxGeometry( FLOOR_X_SIZE, 1, FLOOR_Y_SIZE ), new THREE.MeshStandardMaterial( {color: 0x996f31} ));
floor.position.x = FLOOR_X_POSITION - (FLOOR_X_SIZE / 2);
floor.position.z = FLOOR_Y_POSITION - (FLOOR_Y_SIZE / 2);
floor.position.y = FLOOR_Z_POSITION - (FLOOR_Z_SIZE / 2);
floor.receiveShadow = true;
scene.add( floor );

/**
 * Settings
 */
const defaultSettings = {
    backgroundColor: 0x2181c2,
    moveDuration: .5,
};

const settings = {
    backgroundColor: defaultSettings.backgroundColor,
    moveDuration: defaultSettings.moveDuration,
};

const loadSettings = () => {
    Object.entries(settings).forEach(([key]) => {
        const storageKey = `setting-${key}`;
        let value = JSON.parse(localStorage.getItem(storageKey));
        if (!value) {
            console.log('loading default setting', key, defaultSettings[key]);
            value = defaultSettings[key];
        }
        console.log('updating setting', key, defaultSettings[key]);
        updateSetting(key, value);
    });
};

const updateSetting = (key, value) => {
    console.log('update setting', key, value);
    settings[key] = value;
    const storageKey = `setting-${key}`;
    localStorage.setItem(storageKey, JSON.stringify(value));
    switch(key) {
        case 'backgroundColor':
            scene.background = new THREE.Color(value);
            break;
        case 'moveDuration':
            document.getElementById('inputMoveDuration').value = String(value);
            document.getElementById('labelMoveDuration').innerText = value.toFixed(2);
            break;
    }
};

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

const scale = 7.5;

let start = false;

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    const aspectRatio = sizes.width / sizes.height;
    camera.left = -1 * aspectRatio * scale;
    camera.right = 1 * aspectRatio * scale;
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})


/**
 * Camera
 */
// Base camera
const aspectRatio = sizes.width / sizes.height;
const camera = new THREE.OrthographicCamera(-1 * aspectRatio * scale, 1 * aspectRatio * scale, 1 * scale, -1 * scale, 0.1, 1000)
camera.position.x = -100
camera.position.y = 100
camera.position.z = -100
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.type = THREE.PCFSoftShadowMap

/**
 * Animate
 */
const clock = new THREE.Clock()

/**
 * Declarations
 */

// model instances
let snakePartInstance = null;
let appleInstance = null;
let slopeInstance = null;

// game objects
let snake = [];
let powerups = [];
let activePowerups = [];
// 0 -> +x, 1 -> -x, 2 -> +y, 3 -> -y
let snakeDirection = 0;
let prevMoveTime = 0;

let cyclesPerAppleMove = 1;
let variationCyclePerAppleMove = 0;

let cyclesFromLastAppleMove = 0;

let apple = null;

let slope = null;
// 0 -> +x, 1 -> -x, 2 -> +y, 3 -> -y
let slopeDirection = 1;

let tickMultiplier = 1;

/**
 * Level config
 */

let currLevelPage = 0;
const levelConfig = {
    powerups: {
        ghost: {
            name: 'Ghost',
            instance: null,
            icon: null
        },
        snail: {
            name: 'Snail',
            instance: null,
            icon: null
        }
    },
    levels: [
        {
            goal: 3,
            dynamic: false,
            powerups: ['ghost', 'snail']
        },
        {
            goal: 3,
            dynamic: false,
            powerups: []
        },
        {
            goal: 3,
            dynamic: false,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: false,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: false,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: false,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        },
        {
            goal: 3,
            dynamic: true,
            powerups: [] 
        }
    ]
};

fetch(assetUrl('textures/ghost.png'))
    .then(response => response.blob())
    .then(imageBlob => {
        levelConfig.powerups.ghost.icon = URL.createObjectURL(imageBlob);
    });

fetch(assetUrl('textures/snail.png'))
    .then(response => response.blob())
    .then(imageBlob => {
        levelConfig.powerups.snail.icon = URL.createObjectURL(imageBlob);
    });

/**
 * Event handlers
 */
const onDocumentKeyDown = (event) => {
    let keyCode = event.which;
    if (keyCode == 87 && (snakeDirection === 2 || snakeDirection === 3)) {
        snakeDirection = 0;
    } else if (keyCode == 83 && (snakeDirection === 2 || snakeDirection === 3)) {
        snakeDirection = 1;
    } else if (keyCode == 68 && (snakeDirection === 0 || snakeDirection === 1)) {
       snakeDirection = 2;
    } else if (keyCode == 65 && (snakeDirection === 0 || snakeDirection === 1)) {
        snakeDirection = 3;
    }
};

const isSnakeHeadOnApple = (snake, apple) => {
    const head = getSnakeHead(snake);
    return head.position.equals(apple.position);
}

const isPositionOnSnakeBody = (position, snake) => {
    for (const part of snake.slice(1)) {
        if (position.equals(part.position)) {
            return true;
        }
    }
    return false;
}

const isPositionOnSlope = (position, slope) => {
    return position.equals(slope.position);
}

const isSnakeHeadCrashedOnSlope = (snake, slope) => {
    const head = getSnakeHead(snake);
    return isPositionOnSlope(head.position, slope) && snakeDirection !== slopeDirection;
}

const isPositionOutOfBounds = (position) => {
    return position.x <= -FLOOR_X_SIZE / 2
     || position.x >= FLOOR_X_SIZE / 2
     || position.z <= -FLOOR_Y_SIZE / 2
     || position.z >= FLOOR_Y_SIZE / 2;
}

const isAppleOnSnake = (apple, snake) => {
    for (const part of snake) {
        if (part.position.equals(apple.position)) {
            return true;
        }
    }
    return false;
}

const isAnythingBelowSnakeHead = (snake, apple, slope) => {
    const head = getSnakeHead(snake);

    const applePos = apple.position.clone();
    applePos.y += 1;
    if (head.position.equals(applePos)) {
        return true;
    }

    const slopePos = slope.position.clone();
    slopePos.y += 1;
    if (head.position.equals(slopePos)) {
        return true;
    }

    for (const part of snake.slice(1)) {
        const partPos = part.position.clone();
        partPos.y += 1;
        if (head.position.equals(partPos)) {
            return true;
        }
    }

    return false;
}

const moveToRandomPosition = (apple, snake) => {
    for (let i = 0; i < MAX_RADOM_POSITION_ATTEMT; i++) {
        apple.position.x = Math.floor(Math.random() * FLOOR_X_SIZE) - (FLOOR_X_SIZE / 2) + 0.5;
        apple.position.z = Math.floor(Math.random() * FLOOR_Y_SIZE) - (FLOOR_Y_SIZE / 2) + 0.5;
        if (!isAppleOnSnake(apple, snake)) {
            return;
        }
    }
    console.error(`ERROR: Cannot move to random position. Failed ${MAX_RADOM_POSITION_ATTEMT} times`);
};

const moveSnake = (snake, snakeDirection) => {
    let prevPosition;
    snake.forEach((snakePart, index) => {
        let currPosition = snakePart.position.clone();
        if (index === 0) {
            const head = getSnakeHead(snake);
            prevPosition = snakePart.position.clone();
            switch (snakeDirection) {
                case 0:
                    prevPosition.x += 1;
                    head.rotateY(0 - head.rotation.y);
                    break;
                case 1:
                    prevPosition.x -= 1;
                    head.rotateY(Math.PI - head.rotation.y);
                    break;
                case 2:
                    prevPosition.z += 1;
                    head.rotateY((-Math.PI / 2) - head.rotation.y);
                    break;
                case 3:
                    prevPosition.z -= 1;
                    head.rotateY((Math.PI / 2) - head.rotation.y);
                    break;
                default:
                    console.warn(`Invalid snake direction '${snakeDirection}'. Should be in range [0, 3]. Skipping 'moveSnake'.`);
            }
            if (isPositionOnSlope(head.position, slope)) {
                console.log('will increase');
                prevPosition.y += 1;
            } else if (prevPosition.y !== -FLOOR_Z_POSITION + 0.5 && !isAnythingBelowSnakeHead(snake, apple, slope)) {
                console.log('will decrease');
                prevPosition.y -= 1;
            }
        }
        new TWEEN.Tween(snakePart.position)
            .to(prevPosition, settings.moveDuration * tickMultiplier * 0.9 * 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start()

        new TWEEN.Tween(snakePart.scale)
            .to(new THREE.Vector3(.75, .75, .75), settings.moveDuration * tickMultiplier * 0.9 * 1000)
            .easing(bounceBackEasing)
            .start();

        if (moveSound.sourceType !== 'empty') {
            if (moveSound.isPlaying) {
                moveSound.stop();
                moveSound.currentTime = 0;
            }
            moveSound.play();
        }
        prevPosition = currPosition;
    });   
};

const bounceBackEasing = (k) => {
    return k === 0 
        ? 1 
        : k < .5 
        ? 1 - Math.pow(2, -10 * k)
        : Math.pow(2, -10 * k);
};
const easeDeLaSphagetti = (x) => {
    return x < 0.5 
    ? - x 
    : (2 * (x - 0.5) * 1.5) - 0.5;
}

const moveApple = (apple, snake) => {
    const newApplePosition = apple.position.clone();
    const snakeHeadPosition = getSnakeHead(snake).position;
    const diffX = newApplePosition.x - snakeHeadPosition.x;
    const diffY = newApplePosition.z - snakeHeadPosition.z;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        newApplePosition.x += diffX !== 0 ? diffX / Math.abs(diffX) : 0;
    } else {
        newApplePosition.z += diffY !== 0 ? diffY / Math.abs(diffY): 0;
    }

    if (isPositionOnSnakeBody(newApplePosition, snake) || isPositionOutOfBounds(newApplePosition) || isPositionOnSlope(newApplePosition, slope)) {
        newApplePosition.copy(apple.position);
        if (Math.abs(diffX) > Math.abs(diffY)) {
            newApplePosition.z += diffY !== 0 ? diffY / Math.abs(diffY): 0;
        } else {
            newApplePosition.x += diffX !== 0 ? diffX / Math.abs(diffX) : 0;
        }

        if (isPositionOnSnakeBody(newApplePosition, snake) || isPositionOutOfBounds(newApplePosition) || isPositionOnSlope(newApplePosition, slope)) {
            newApplePosition.copy(apple.position);
            if (Math.abs(diffX) > Math.abs(diffY)) {
                newApplePosition.z -= diffY !== 0 ? diffY / Math.abs(diffY): 0;
            } else {
                newApplePosition.x -= diffX !== 0 ? diffX / Math.abs(diffX) : 0;
            }

            if (isPositionOnSnakeBody(newApplePosition, snake) || isPositionOutOfBounds(newApplePosition) || isPositionOnSlope(newApplePosition, slope)) {
            }
        }
    }
    new TWEEN.Tween(apple.position)
        .to(newApplePosition, settings.moveDuration * tickMultiplier * 0.9 * 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start()
};

const getSnakeHead = (snake) => {
    return snake[0];
};

const getSnakeTail = (snake) => {
    return snake[snake.length - 1];
};

const addSnakePart = (snake, tailPosition) => {
    let part = snakePartInstance.clone();
    part.position.copy(tailPosition);
    scene.add(part);
    snake.push(part);
};

const ready = (snake, apple, slope) => {
    return snake.length > 0 && !!apple && !!slope;
};

const tick = (deltaTime) => {
    const currTime = clock.getElapsedTime();

    if (start && ready(snake, apple, slope)) {
        // Update objects
        if (currTime - prevMoveTime >= settings.moveDuration * tickMultiplier) {
            // check game state
            const head = getSnakeHead(snake);

            const powerup = powerups.find(powerup => powerup.position.equals(head.position));
            if (powerup) {
                scene.remove(powerup);

                const id = `powerup-${Math.random() * 8999 + 1000}`;
                activePowerups.push({
                    id,
                    type: powerup.userData.type,
                    start: new Date()
                });

                const el = document.getElementsByClassName('hud-powerups-sample')[0].cloneNode(true);
                el.classList.remove('d-none');
                el.classList.add('d-flex');
                el.id = id;
                el.getElementsByClassName('hud-image')[0].src = levelConfig.powerups[powerup.userData.type].icon;
                document.getElementById('hud-powerups').appendChild(el);
            }

            activePowerups.forEach((powerup, i) => {
                const el = document.getElementById(powerup.id);
                const left = 10 - (new Date() - powerup.start) / 1000;
                if (left < 0) {
                    // remove
                    activePowerups.splice(i, 1);
                    el.remove();
                } else {
                    const seconds = Math.floor(left % 60);
                    const minutes = Math.floor(left / 60);
                    el.getElementsByClassName('hud-duration')[0].innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                }
            });

            const isGhost = activePowerups.find(powerup => powerup.type === 'ghost');
            const isSnail = activePowerups.find(powerup => powerup.type === 'snail');

            const win = collected >= currentLevel().goal;
            const lose = 
                (!isGhost && isPositionOnSnakeBody(head.position, snake)) 
                || isPositionOutOfBounds(head.position)
                || (!isGhost && isSnakeHeadCrashedOnSlope(snake, slope));

            if (win || lose) {
                let sound;
                if (win) {
                    sound = passSound;
                } else {
                    sound = failSound;
                }
                if (sound.sourceType !== 'empty') {
                    if (sound.isPlaying) {
                        sound.stop();
                        sound.currentTime = 0;
                    }
                    sound.play();
                }
                
                finished = win;
                endTime = new Date();
                submitResults();
                changeInterfaceVisiblity(true);
                const elapsed = (endTime - startTime) / 1000;
                const score = Math.max(0, Number(finished) * (currLevel * 100 + collected * 10 - Math.floor(elapsed / 10)));
                updateScore(finished, score);
                changeViewTo('game-over');
                start = false;

                if (!win) {
                    const animationDuration = 3;
                    snake.forEach(part => {
                        part.rotation.y = head.rotation.y;
                        const payload = {angle: 0, prevAngle: 0};
                        const targetPayload = {angle: animationDuration * 2 * Math.PI};
                        new TWEEN.Tween(payload)
                            .to(targetPayload, animationDuration * 1000)
                            .easing(TWEEN.Easing.Quadratic.InOut)
                            .onUpdate(() => {
                                let angleDiff = payload.angle - payload.prevAngle;
                                if (head.position.x <= -FLOOR_X_SIZE / 2) {
                                    part.rotateX(-1 * angleDiff);
                                } else if (head.position.x >= FLOOR_X_SIZE / 2) {
                                    part.rotateX(1 * angleDiff);
                                } else if (head.position.z <= -FLOOR_Y_SIZE / 2) {
                                    part.rotateZ(-1 * angleDiff);
                                } else if (head.position.z >= FLOOR_Y_SIZE / 2) {
                                    part.rotateZ(1 * angleDiff);
                                } else {
                                    part.rotateX(-1 * angleDiff);
                                }
                                payload.prevAngle = payload.angle;
                            })
                            .start();
    
                        const positionV = part.position.clone();
                        const targetPositionV = part.position.clone();
                        targetPositionV.y = -15;
                        new TWEEN.Tween(positionV)
                            .to(targetPositionV, animationDuration * 1000)
                            .easing(easeDeLaSphagetti)
                            .onUpdate(() => part.position.y = positionV.y)
                            .start();
    
                        const positionH = part.position.clone();
                        const targetPositionH = head.position.clone();
                        if (head.position.x <= -FLOOR_X_SIZE / 2) {
                            targetPositionH.x -= 10;
                        } else if (head.position.x >= FLOOR_X_SIZE / 2) {
                            targetPositionH.x += 10;
                        } else if (head.position.z <= -FLOOR_Y_SIZE / 2) {
                            targetPositionH.z -= 10;
                        } else if (head.position.z >= FLOOR_Y_SIZE / 2) {
                            targetPositionH.z += 10;
                        } else {
                            targetPositionH.x -= 10;
                        }
                        targetPositionH.x += (Math.random() * 3) - 1.5;
                        targetPositionH.z += (Math.random() * 3) - 1.5;
                        new TWEEN.Tween(positionH)
                            .to(targetPositionH, animationDuration * 1000)
                            .easing(TWEEN.Easing.Quadratic.InOut)
                            .onUpdate(() => {
                                part.position.x = positionH.x;
                                part.position.z = positionH.z;
                            })
                            .start();
                    });
                } else {
                    const animationDuration = 3;
                    const repeat = 3;
                    snake.forEach((part, i) => {
                        const targetPosition = part.position.clone();
                        targetPosition.y += 1;
                        new TWEEN.Tween(part.position)
                            .to(targetPosition, animationDuration * 1000 / repeat)
                            .easing(bounceBackEasing)
                            .delay(250 * i)
                            .repeat(repeat)
                            .repeatDelay(250)
                            .start();
                    });
                }
            } else {
                const opacity = isGhost ? 0.5 : 1;
                snake.forEach(el => el.children[0].material.opacity = opacity);

                if (isSnail) {
                    tickMultiplier = 2;
                } else {
                    tickMultiplier = 1;
                }

                let tailPosition = getSnakeTail(snake).position;
                moveSnake(snake, snakeDirection);
    
                if (isSnakeHeadOnApple(snake, apple)) {
                    if (eatSound.sourceType !== 'empty') {
                        if (eatSound.isPlaying) {
                            eatSound.stop();
                            eatSound.currentTime = 0;
                        }
                        eatSound.play();
                    }
                    collected++;
                    addSnakePart(snake, tailPosition);
                    moveToRandomPosition(apple, snake);
                } else {
                    if (currentLevel().dynamic) {
                        cyclesFromLastAppleMove += cyclesPerAppleMove;
                        if (cyclesFromLastAppleMove >= cyclesPerAppleMove) {
                            moveApple(apple, snake);
                            cyclesFromLastAppleMove = 0;
                        }
                    }
                }
            }

            updateHud();

            prevMoveTime = currTime;
        }
    }
    

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    TWEEN.update(deltaTime);
    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
};

const reset = () => {
    if (!ready(snake, apple, slope)) {
        return;
    }
    const body = snake.splice(1);
    body.forEach(part => scene.remove(part));
    const head = getSnakeHead(snake);
    head.position.x = -FLOOR_X_POSITION + 0.5;
    head.position.z = -FLOOR_Y_POSITION + 0.5;
    head.position.y = -FLOOR_Z_POSITION + 0.5;
    head.rotation.set(0, 0, 0);
    snakeDirection = 0;

    powerups.forEach(powerup => scene.remove(powerup));
    powerups.splice(0);

    const powerupsWrapper = document.getElementById('hud-powerups');
    while (powerupsWrapper.firstChild) {
        powerupsWrapper.removeChild(powerupsWrapper.firstChild);
    }

    activePowerups.splice(0);
    
    spawnPowerups();

    moveToRandomPosition(apple, snake);

};

const spawnPowerups = () => {
    // TODO check if location is free (no snake, no apple, no step, no pillar)
    const level = currentLevel();
    level.powerups.forEach(key => {
        switch (key) {
            case 'ghost':
            case 'snail':
                const powerup = levelConfig.powerups[key].instance.clone();
                powerup.position.x = Math.floor(Math.random() * FLOOR_X_SIZE) - (FLOOR_X_SIZE / 2) + 0.5;
                powerup.position.z = Math.floor(Math.random() * FLOOR_Y_SIZE) - (FLOOR_Y_SIZE / 2) + 0.5;
                const payload = {angle: 0, prevAngle: 0};
                new TWEEN.Tween(payload)
                    .to({angle: 2 * Math.PI}, 1000)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        let angleDiff = payload.angle - payload.prevAngle;
                        powerup.rotateY(-1 * angleDiff);
                        payload.prevAngle = payload.angle;
                    })
                    .repeat(Infinity)
                    .start();
                
                scene.add(powerup);
                powerups.push(powerup);
                break;
            default:
                console.warn(`Invalid powerup in config: '${key}'`);
        }
    });
}

// meta

const currentLevel = () => {
    return levelConfig.levels[currLevel - 1];
};

const submitResults = async () => {
    try {
        const response = await axios.post(`${BASE_URL}/submit`, {
            username,
            level: currLevel,
            finished,
            elapsed: (endTime - startTime) / 1000,
            collected
        });
        console.info(response);
        provideSnakeLevels();
    } catch (e) {
        console.error(e);
    }
};

const getStatistics = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/statistics?name=${username}`);
        return response.data.leaderboard;
    } catch (e) {
        console.error(e);
    }
};

const getLeaderboard = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/leaderboard-weekly`);
        return response.data.leaderboard;
    } catch (e) {
        console.error(e);
    }
};

const getUserInfo = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/user-info?username=${username}`);
        return response.data.user;
    } catch (e) {
        console.error(e);
    }
};

// UI
let currentView = 'landing';
let prevView = 'landing';

const changeViewTo = (viewId)  => {
    const newView = document.getElementById(viewId);
    if (!newView) {
        console.warn(`New view with id '${viewId}' not found!`);
        return;
    }
    const currView = document.getElementById(currentView);
    if (!currView) {
        console.error(`Current view with id '${currentView}' not found!`);
    }
    console.log(viewId, currentView, prevView);
    currView.classList.remove('d-flex');
    currView.classList.add('d-none');
    newView.classList.add('d-flex');
    newView.classList.remove('d-none');
    prevView = currentView;
    currentView = viewId;
    if (viewId === 'leaderboard') {
        provideLeaderboard();
    }
};

const changeInterfaceVisiblity = (visible) => {
    if (visible) {
        document.getElementById('interface').classList.remove('interface-hidden');
        document.getElementById('hud').classList.add('hud-hidden');
    } else {
        document.getElementById('interface').classList.add('interface-hidden');
        document.getElementById('hud').classList.remove('hud-hidden');
    }
}

const changeViewToPrev = () => {
    changeViewTo(prevView);
};

const onStart = (level) => {
    currLevel = level;
    collected = 0;
    startTime = new Date();
    changeInterfaceVisiblity(false);
    reset();

    const head = getSnakeHead(snake);
    const animationDuration = 2;
    const payload = {angle: 0, prevAngle: 0};
    const targetPayload = {angle: animationDuration * 2 * Math.PI};
    new TWEEN.Tween(payload)
        .to(targetPayload, animationDuration * 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            let angleDiff = payload.angle - payload.prevAngle;
            head.rotateZ(1 * angleDiff);
            payload.prevAngle = payload.angle;
        })
        .start();

    const targetPosition = head.position.clone();
    head.position.y = 20;
    new TWEEN.Tween(head.position)
        .to(targetPosition, animationDuration * 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    setTimeout(() => start = true, animationDuration * 1.1 * 1000);
};

const provideSnakeLevels = async () => {
    const progress = document.getElementById('snake-levels-progress');
    progress.classList.remove('d-none');
    progress.classList.add('d-block');

    const user = await getUserInfo();

    const samplePage = document.getElementsByClassName('snake-levels-sample')[0];
    const sampleRow = samplePage.children[0];
    const sampleLevel = sampleRow.children[0];
    const wrapper = document.getElementById('snake-levels-entries');
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
    }

    const levelCount = levelConfig.levels.length;
    const pageCount = Math.ceil(levelCount / 6);
    const rowCount = 2;
    const perRow = 3;
    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
        const pageClone = samplePage.cloneNode(true);
        pageClone.removeChild(pageClone.firstChild);

        pageClone.classList.remove('snake-levels-sample');
        if (pageIdx === 0) {
            pageClone.classList.remove('d-none');
            pageClone.classList.add('d-block');
        }

        for (let pageRowIdx = 0; pageRowIdx < (pageIdx === pageCount - 1 && levelCount % 6 !== 0 && levelCount % 6 <= perRow ? 1 : rowCount); pageRowIdx++) {
            const rowClone = sampleRow.cloneNode(true);
            rowClone.removeChild(rowClone.firstChild);

            for (let rowLevelIdx = 0; rowLevelIdx < (pageIdx === pageCount - 1 && pageRowIdx === 1 && levelCount % perRow !== 0 ? levelCount % perRow : perRow); rowLevelIdx++) {
                const levelIdx = pageIdx * 6 + pageRowIdx * perRow + rowLevelIdx;
                const levelClone = sampleLevel.cloneNode(true);
                if (levelIdx > user.latestLevel - 1) {
                    levelClone.classList.add('disabled');
                    levelClone.classList.add('locked');
                } else {
                    levelClone.addEventListener('click', (e) => onStart(parseInt(e.target.id.replace('snake-levels-level-', '')) + 1));
                }
                levelClone.id = `snake-levels-level-${levelIdx}`;
                levelClone.innerText = levelIdx + 1;
                rowClone.appendChild(levelClone);
            }

            pageClone.appendChild(rowClone);
        }
        
        wrapper.appendChild(pageClone);
    }

    progress.classList.remove('d-block');
    progress.classList.add('d-none');
};

const provideLeaderboard = async () => {
    const progress = document.getElementById('leaderboard-progress');
    progress.classList.remove('d-none');
    progress.classList.add('d-block');

    const leaderboard = await getLeaderboard();

    const sample = document.getElementsByClassName('leaderboard-sample')[0];
    const wrapper = document.getElementById('leaderboard-entries');
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
    }
    leaderboard.forEach(user => {
        const clone = sample.cloneNode(true);
        clone.getElementsByClassName('leaderboard-name')[0].innerText = user.name;
        clone.getElementsByClassName('leaderboard-total')[0].innerText = user.scores.reduce((t, s) => t + s.value, 0);
        clone.classList.remove('d-none');
        clone.classList.add('d-flex');

        wrapper.appendChild(clone);
    });

    progress.classList.remove('d-block');
    progress.classList.add('d-none');
};

const updateHud = () => {
    document.getElementById('hud-level').innerText = currLevel;
    document.getElementById('hud-collected').innerText = `${collected}/${currentLevel().goal}`;

    const elapsed = (new Date() - startTime) / 1000;
    const seconds = Math.floor(elapsed % 60);
    const minutes = Math.floor(elapsed / 60);
    document.getElementById('hud-elapsed').innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const updateScore = (finished, score) => {
    const status = finished
        ? 'You won!'
        : 'You lost! Try again.';

    document.getElementById('game-over-status').innerText = status;
    document.getElementById('game-over-score').innerText = score;
};

const onChangePage = (direction) => {
    const wrapper = document.getElementById('snake-levels-entries');
    wrapper.children[currLevelPage].classList.remove('d-block');
    wrapper.children[currLevelPage].classList.add('d-none');

    const pageCount = Math.ceil(levelConfig.levels.length / 6);
    currLevelPage = Math.max(0, Math.min(pageCount - 1, currLevelPage + direction));
    wrapper.children[currLevelPage].classList.remove('d-none');
    wrapper.children[currLevelPage].classList.add('d-block');
};

const onEnter = () => {
    username = document.getElementById('inputName').value;
    if (!username) {
        username = `guest-${Math.floor(Math.random() * 8999 + 1000)}`;
    }
    document.getElementById('labelName').innerText = username;
    changeViewTo('main');
    provideSnakeLevels();
};

const onLogout = () => {
    username = '';
    document.getElementById('inputName').value = '';
    document.getElementById('labelName').innerText = username;
    changeViewTo('landing');
};

window.addEventListener("load", () => {
    const backgroundColorInput = document.getElementById('inputBackgroundColor');
    backgroundColorInput.value = `#${settings.backgroundColor.toString(16)}`;

    backgroundColorInput.addEventListener(
        "input", 
        (e) => 
            updateSetting('backgroundColor', parseInt(e.target.value.replace('#', ''), 16)), 
        false
    );

    const moveDurationInput = document.getElementById('inputMoveDuration');
    moveDurationInput.value = String(settings.moveDuration);

    moveDurationInput.addEventListener(
        "input", 
        (e) => 
            updateSetting('moveDuration', parseFloat(e.target.value)),
        false
    );

}, false);

window.changeViewTo = changeViewTo;
window.changeViewToPrev = changeViewToPrev;
window.onChangePage = onChangePage;
window.onStart = onStart;
window.onEnter = onEnter;
window.onLogout = onLogout;

// init

const init = () => {
    loadSettings();
    document.addEventListener("keydown", onDocumentKeyDown, false);

    modelLoader.load(assetUrl('models/snake_body.obj'), 
        (snakePartModel => {
            // init model instance
            snakePartInstance = snakePartModel.clone();
            snakePartInstance.children[0].scale.set(.5, .5, .5);
            snakePartInstance.children[0].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26, transparent: true} );
            snakePartInstance.children.forEach(c => c.castShadow = true);
            snakePartInstance.position.x = -FLOOR_X_POSITION + 0.5;
            snakePartInstance.position.z = -FLOOR_Y_POSITION + 0.5;
            snakePartInstance.position.y = -FLOOR_Z_POSITION + 0.5;
            snakePartInstance.rotation.order = 'YXZ';

            // init game object
            let snakeHead = snakePartInstance.clone();
            scene.add(snakeHead);
            snake.push(snakeHead);

            const snakeHeadPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(.8, .8), 
                new THREE.MeshBasicMaterial({
                    color: 0xffff00, 
                    map: snakeHeadTexture,
                    transparent: true,
                    polygonOffset: true, 
                    polygonOffsetFactor: -1
                }) 
            );
            snakeHeadPlane.rotateY(Math.PI / 2);
            snakeHeadPlane.position.set(.5, 0, 0);
            snakeHead.add(snakeHeadPlane);
        }
    ));
    modelLoader.load(assetUrl('models/apple.obj'), 
        (appleModel => {
            // init model instance
            appleInstance = appleModel.clone();
            appleInstance.children.forEach(c => c.scale.set(.5, .5, .5));
            appleInstance.children[0].material = new THREE.MeshStandardMaterial( {color: 0xeb4934} );
            appleInstance.children[1].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.children[2].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.children.forEach(c => c.castShadow = true);
            appleInstance.position.x = -FLOOR_X_POSITION + 0.5;
            appleInstance.position.z = -FLOOR_Y_POSITION + 0.5;
            appleInstance.position.y = -FLOOR_Z_POSITION + 0.5;

            // init game object
            apple = appleInstance.clone();
            moveToRandomPosition(apple, snake || []);
            scene.add(apple);
        }
    ));
    modelLoader.load(assetUrl('models/slope_2.obj'), 
        (slopeModel => {
            // init model instance
            slopeInstance = slopeModel.clone();
            slopeInstance.children.forEach(c => c.scale.set(.5, .5, .5));
            slopeInstance.children.forEach(c => c.material = new THREE.MeshStandardMaterial( {color: 0x8b4ee6} ));
            slopeInstance.children.forEach(c => c.castShadow = true);
            slopeInstance.position.x = -FLOOR_X_POSITION + 0.5 + 3;
            slopeInstance.position.z = -FLOOR_Y_POSITION + 0.5 + 3;
            slopeInstance.position.y = -FLOOR_Z_POSITION + 0.5;

            // init game object
            slope = slopeInstance.clone();
            scene.add(slope);
        }
    ));

    audioLoader.load(assetUrl('audios/blip.mp3'),
        (buffer) => {
            moveSound.setBuffer(buffer);
            moveSound.setVolume(0.5);
        }
    );

    audioLoader.load(assetUrl('audios/punch.mp3'),
        (buffer) => {
            eatSound.setBuffer(buffer);
            eatSound.setVolume(0.5);
        }
    );

    audioLoader.load(assetUrl('audios/fail.mp3'),
        (buffer) => {
            failSound.setBuffer(buffer);
            failSound.setVolume(0.5);
        }
    );

    audioLoader.load(assetUrl('audios/pass.mp3'),
        (buffer) => {
            passSound.setBuffer(buffer);
            passSound.setVolume(0.5);
        }
    );

    levelConfig.powerups.ghost.instance = new THREE.Mesh(
        new THREE.PlaneGeometry(.8, .8), 
        new THREE.MeshBasicMaterial({
            color: 0x9803fc, 
            map: ghostIconTexture,
            transparent: true,
            polygonOffset: true, 
            polygonOffsetFactor: -1,
            side: THREE.DoubleSide
        }) 
    );

    levelConfig.powerups.ghost.instance.position.set(0, .5, 0);
    levelConfig.powerups.ghost.instance.userData.type = 'ghost';

    levelConfig.powerups.snail.instance = new THREE.Mesh(
        new THREE.PlaneGeometry(.8, .8), 
        new THREE.MeshBasicMaterial({
            color: 0x9803fc, 
            map: snailIconTexture,
            transparent: true,
            polygonOffset: true, 
            polygonOffsetFactor: -1,
            side: THREE.DoubleSide
        }) 
    );
    
    levelConfig.powerups.snail.instance.position.set(0, .5, 0);
    levelConfig.powerups.snail.instance.userData.type = 'snail';

    window.requestAnimationFrame(tick);
};

init();
