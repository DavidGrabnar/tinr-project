import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as dat from 'dat.gui'

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
 * Object declarations
 */
let snakeHead = null;
let appleInstance = null;

/**
 * Event handlers
 */
const onDocumentKeyDown = (event) => {
    console.log(event.which);
    var keyCode = event.which;
    if (keyCode == 87) {
        if (snakeHead === null) {
            return;
        }
        snakeHead.position.x += 1;
    } else if (keyCode == 83) {
        if (snakeHead === null) {
            return;
        }
        snakeHead.position.x -= 1;
    } else if (keyCode == 65) {
        if (snakeHead === null) {
            return;
        }
        snakeHead.position.z -= 1;
    } else if (keyCode == 68) {
        if (snakeHead === null) {
            return;
        }
        snakeHead.position.z += 1;
    }

    if (isSnakeHeadOnApple(snakeHead, appleInstance)) {
        moveAppleToRandomPosition(appleInstance);
    }
};

const isSnakeHeadOnApple = (snakeHead, apple) => {
    return snakeHead.position.x === apple.position.x
        && snakeHead.position.y === apple.position.y
        && snakeHead.position.z === apple.position.z;
}

const moveAppleToRandomPosition = (apple) => {
    apple.position.x = Math.floor(Math.random() * FLOOR_X_SIZE) - (FLOOR_X_SIZE / 2) + 0.5;
    apple.position.z = Math.floor(Math.random() * FLOOR_Y_SIZE) - (FLOOR_Y_SIZE / 2) + 0.5;
};


const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    // Update objects

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

const init = () => {
    document.addEventListener("keydown", onDocumentKeyDown, false);

    modelLoader.load('/models/snake_body.obj', 
        (snakeBodyPart => {
            /**
             * Snake
             */
            snakeHead = snakeBodyPart.clone();
            snakeHead.children[0].scale.set(.5, .5, .5);
            snakeHead.children[0].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            snakeHead.position.x = -FLOOR_X_POSITION + 0.5;
            snakeHead.position.z = -FLOOR_Y_POSITION + 0.5;
            snakeHead.position.y = -FLOOR_Z_POSITION + 0.5;
            scene.add(snakeHead);

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
        (apple => {
            /**
             * Apple
             */
            appleInstance = apple.clone();
            appleInstance.children.forEach(c => c.scale.set(.5, .5, .5));
            appleInstance.children[0].material =  new THREE.MeshStandardMaterial( {color: 0xeb4934});
            appleInstance.children[1].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.children[2].material = new THREE.MeshStandardMaterial( {color: 0x1c7a26} );
            appleInstance.position.x = -FLOOR_X_POSITION + 7.5;
            appleInstance.position.z = -FLOOR_Y_POSITION + 7.5;
            appleInstance.position.y = -FLOOR_Z_POSITION + 0.5;
            scene.add(appleInstance);
        }
    ));
    tick();
};

init();
