import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

global.THREE = THREE;

// console.log(THREE)

import fragment from "./modules/shader/fragment.glsl";
import vertex from "./modules/shader/vertexParticles.glsl";
import * as dat from "dat.gui";
import gsap from "gsap";


const createGeometry = require('three-bmfont-text')

// var MSDFShader = require('three-bmfont-text/shaders/msdf');
const MSDFShader = require('./modules/msdf');

import fontTexture from '../img/font/manifold.png'
// import font from './modules/manifold.json'
import font from './modules/font'

export default class Sketch {
    constructor(options) {
        this.scene = new THREE.Scene();

        this.container = options.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x333333, 1);

        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.001,
            1000
        );

        // var frustumSize = 10;
        // var aspect = window.innerWidth / window.innerHeight;
        // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
        this.camera.position.set(0, 0, 2);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.time = 0;
        this.mouse = {x:0,y:0}

        this.isPlaying = true;

        new THREE.TextureLoader().load(fontTexture,(t)=>{
            this.fontTexture = t;
            console.log(this.fontTexture);

            this.addObjects();
            this.addText();
            this.mouseEvents();
            this.resize();
            this.render();
            this.setupResize();

        })
        // this.settings();
    }

    mouseEvents(){
        window.addEventListener('mousemove',(event)=>{
            this.mouse = {
                x: event.clientX/window.innerWidth * 2.0,
                y: event.clientY/window.innerHeight * 2.0 - 1.0,
            }
            this.materialText.uniforms.uMouse.value = new THREE.Vector2(this.mouse.x,this.mouse.y)
            this.material.uniforms.uMouse.value = new THREE.Vector2(this.mouse.x,this.mouse.y)
        })
    }

    settings() {
        let that = this;
        this.settings = {
            progress: 0,
        };
        this.gui = new dat.GUI();
        this.gui.add(this.settings, "progress", 0, 1, 0.01);
    }

    setupResize() {
        window.addEventListener("resize", this.resize.bind(this));
    }

    resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer.setSize(this.width, this.height);
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
    }


    addText(){
        this.geom = createGeometry({
            text: 'HAVE A GOOD\nDAY',
            font: font,
            align: 'center',
            flipY: this.fontTexture.flipY
        })

        this.materialText = new THREE.RawShaderMaterial(MSDFShader({
            map: this.fontTexture,
            transparent: true,
            color: 0xffffff,
            side: THREE.DoubleSide
        }))

        let layout = this.geom.layout
        let text = new THREE.Mesh(this.geom, this.materialText)
        text.scale.set(0.01,-0.01,0.01);
        text.position.set(-0.01*layout.width/2, -0.01*layout.height/2,0)
        // text.position.set(0, -layout.descender + layout.height, 0)
        // text.scale.multiplyScalar(Math.random() * 0.5 + 0.5)
        this.scene.add(text);
    }

    addObjects() {
        let that = this;
        let number = 1000;
        let geo = new THREE.BufferGeometry();
        let pos = []
        for (let i = 0; i <number; i++) {
            let x = 3*(Math.random() - 0.5)
            let y = 3*(Math.random() - 0.5)
            let z = (Math.random() - 0.5)
            pos.push(x,y,z);
        }

        pos = new Float32Array(pos);


        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));


        this.material = new THREE.ShaderMaterial({
            extensions: {
                derivatives: "#extension GL_OES_standard_derivatives : enable"
            },
            side: THREE.DoubleSide,
            uniforms: {
                time: { value: 0 },
                viewport: {  value: new THREE.Vector2(window.innerWidth,window.innerHeight) },
                uMouse: {  value: new THREE.Vector2(0,0) },
                resolution: { value: new THREE.Vector4() },
            },
            // wireframe: true,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            vertexShader: vertex,
            fragmentShader: fragment
        });

        // this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

        this.points = new THREE.Points(geo, this.material);
        this.scene.add(this.points);
    }

    stop() {
        this.isPlaying = false;
    }

    play() {
        if(!this.isPlaying){
            this.render()
            this.isPlaying = true;
        }
    }

    render() {
        if (!this.isPlaying) return;
        this.time += 0.05;
        this.material.uniforms.time.value = this.time;
        if(this.materialText) {
            this.materialText.uniforms.time.value = this.time;
        }
        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}

new Sketch({
    dom: document.getElementById("container")
});
