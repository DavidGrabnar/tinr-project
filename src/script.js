import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as dat from 'dat.gui'

import * as TWEEN from '@tweenjs/tween.js';

/**
 * Base
 */
// Debug
const gui = new dat.GUI()

// Textures
const textureLoader = new THREE.TextureLoader()
const snakeHeadTexture = textureLoader.load('/textures/snake-bite.png');
const appleFaceTexture = textureLoader.load('/textures/shiny-apple.png');

// Models
const modelLoader = new OBJLoader();

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const light = new THREE.PointLight(0xffffff, 0.5)
light.position.x = 2
light.position.y = 3
light.position.z = 4
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

const floor = new THREE.Mesh( new THREE.BoxGeometry( FLOOR_X_SIZE, 1, FLOOR_Y_SIZE ), new THREE.MeshStandardMaterial( {color: 0x996f31} ));
floor.position.x = FLOOR_X_POSITION - (FLOOR_X_SIZE / 2);
floor.position.z = FLOOR_Y_POSITION - (FLOOR_Y_SIZE / 2);
floor.position.y = FLOOR_Z_POSITION - (FLOOR_Z_SIZE / 2);
scene.add( floor );

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

const scale = 7.5;

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

scene.background = new THREE.Color(0x2181c2);

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

// game objects
let snake = [];
// 0 -> +x, 1 -> -x, 2 -> +y, 3 -> -y
let snakeDirection = 0;
let moveDuration = .25;
let prevMoveTime = 0;

let apple = null;
/**
 * Event handlers
 */
const onDocumentKeyDown = (event) => {
    let keyCode = event.which;
    if (keyCode == 87) {
        snakeDirection = 0;
    } else if (keyCode == 83) {
        snakeDirection = 1;
    } else if (keyCode == 68) {
       snakeDirection = 2;
    } else if (keyCode == 65) {
        snakeDirection = 3;
    }
};

const isSnakeHeadOnApple = (snake, apple) => {
    const head = getSnakeHead(snake);
    return head.position.x === apple.position.x
        && head.position.y === apple.position.y
        && head.position.z === apple.position.z;
}

const moveToRandomPosition = (apple) => {
    apple.position.x = Math.floor(Math.random() * FLOOR_X_SIZE) - (FLOOR_X_SIZE / 2) + 0.5;
    apple.position.z = Math.floor(Math.random() * FLOOR_Y_SIZE) - (FLOOR_Y_SIZE / 2) + 0.5;
};

const moveSnake = (snake, snakeDirection) => {
    let prevPosition;
    snake.forEach((snakePart, index) => {
        let currPosition = snakePart.position.clone();
        if (index === 0) {
            const head = getSnakeHead(snake);
            switch (snakeDirection) {
                case 0:
                    head.position.x += 1;
                    head.rotateY(0 - head.rotation.y);
                    break;
                case 1:
                    head.position.x -= 1;
                    head.rotateY(Math.PI - head.rotation.y);
                    break;
                case 2:
                    head.position.z += 1;
                    head.rotateY((-Math.PI / 2) - head.rotation.y);
                    break;
                case 3:
                    head.position.z -= 1;
                    head.rotateY((Math.PI / 2) - head.rotation.y);
                    break;
                default:
                    console.warn(`Invalid snake direction '${snakeDirection}'. Should be in range [0, 3]. Skipping.`);
            }
        } else {
            console.log('will move ', snakePart.position, prevPosition);
            const tween = new TWEEN.Tween(snakePart.position)
                .to(prevPosition, moveDuration * 1000)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    console.log('updated', snakePart.position);
                })
                .start()

            // const tween2 = new TWEEN.Tween()
            //     .to(prevPosition, moveDuration * 1000)
            //     .easing(bounceBackEasing)
            //     .onUpdate(() => {
            //         console.log('updated', snakePart.position);
            //     })
            //     .start()
            // snakePart.position.copy(prevPosition);
        }
        prevPosition = currPosition;
    });
    
};

const bounceBackEasing = (k) => {
	return Math.floor(k * 10) / 10;
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

const ready = (snake, apple) => {
    return snake.length > 0 && !!apple;
};

const tick = (deltaTime) => {
    const currTime = clock.getElapsedTime();

    if (ready(snake, apple)) {
        // Update objects
        if (currTime - prevMoveTime >= moveDuration) {
            let tailPosition = getSnakeTail(snake).position;
            moveSnake(snake, snakeDirection);

            if (isSnakeHeadOnApple(snake, apple)) {
                addSnakePart(snake, tailPosition);
                moveToRandomPosition(apple);
            }

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

const init = () => {
    document.addEventListener("keydown", onDocumentKeyDown, false);

    modelLoader.load('/models/snake_body.obj', 
        (snakePartModel => {
            // init model instance
            snakePartInstance = snakePartModel.clone();
            snakePartInstance.children[0].scale.set(.5, .5, .5);
            snakePartInstance.children[0].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
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
    modelLoader.load('/models/apple.obj', 
        (appleModel => {
            // init model instance
            appleInstance = appleModel.clone();
            appleInstance.children.forEach(c => c.scale.set(.5, .5, .5));
            appleInstance.children[0].material = new THREE.MeshStandardMaterial( {color: 0xeb4934} );
            appleInstance.children[1].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.children[2].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.position.x = -FLOOR_X_POSITION + 0.5;
            appleInstance.position.z = -FLOOR_Y_POSITION + 0.5;
            appleInstance.position.y = -FLOOR_Z_POSITION + 0.5;

            // init game object
            apple = appleInstance.clone();
            moveToRandomPosition(apple);
            scene.add(apple);
        }
    ));

    window.requestAnimationFrame(tick);
};

init();
