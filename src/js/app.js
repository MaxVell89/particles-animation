import * as THREE from "three";
import assign from 'object-assign';
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
const MSDFShader = require('./modules/msdf2');

import fontTexture from '../img/font/manifold.png'
// import font from './modules/manifold.json'
import font from './modules/font'
import {flatten, range, shuffle, sortBy, times} from "lodash";
import {getDistance, getRandom, deNormalize, getRandom2, degToRad} from "./utils";
import particlesVertex from "./modules/shader/particles/vertex.glsl";
import particlesFragment from "./modules/shader/particles/fragment.glsl";
import detectTouch from "./libs/detectTouch";
import linesVertex from "./modules/shader/lines/vertex.glsl";
import linesFragment from "./modules/shader/lines/fragment.glsl";

const isMobile = detectTouch();
const planeGeometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1);
const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    scale: 1.0, //(t = isMobile ? 1080 : 1920, e = isMobile ? 0 : .6, n = isMobile ? 2 : 1, Object(l.a)(window.innerWidth / t, e, n)),
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    uiPixelRatio: 2
};

const pointer = {position: [.5, .5], positionNorm: [.5, .5], active: false, click: 0};
window.addEventListener('mousemove',(event) => {
    pointer.position = [event.clientX, event.clientY];
    pointer.positionNorm = [event.clientX / window.innerWidth, event.clientY / window.innerHeight];
});

export default class Sketch {
    constructor(options) {
        if (!options.dom) return;

        this.tweens = {
            lineMaskProgress: 0,
            lineGradientProgress: 0,
            fillProgress: 0,
            lineScale: 1 //0
        };

        this.options = assign({
            text: "Text",
            align: "center",
            position: "center",
            lineHeight: .8,
            //layer: 1,
            interaction: true,
            animationDuration: 2,
            animationStagger: .05,
            lineWidth: .15,
            particlesPerGlyph: 8
        }, options);

        this.props = {
            viewport: viewport,
            v: false,
            active: true,
            render: false,
            fontSize: 60,
            width: 400,
            height: 200,
            pointerActive: this.options.interaction && pointer.active,
        }

        this.charLength = this.options.text.replace(" ", "").length;
        this.titleScale = 0;
        this.baseFontSize = font.info.size;
        this.time = 0;
        this.mouse = [0, 0];
        this.mouseNorm = [0, 0];
        this.textCenterPos = [0, 0];
        this.maskMaxRadius = 200;
        this.textMaskRadius = 0.0001;
        this.textMaskRadiusVel = 0;
        this.textMaskRadiusTarget = this.textMaskRadius;
        this.particleMaskRadius = 0.0001;
        this.particleMaskRadiusVel = 0;
        this.particleMaskRadiusTarget = this.particleMaskRadius;

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
        //this.camera.position.set(0, 0, 2);
        this.camera.position.z = 300;
        this.camera.fov = 2*Math.atan( (viewport.height/2)/300 )* (180/Math.PI);
        //this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.time = 0;
        this.mouse2 = {x:0,y:0};

        this.isPlaying = true;

        new THREE.TextureLoader().load(fontTexture,(t) => {
            this.fontTexture = t;

            //this.addObjects();
            //this.addText();
            //this.setupCircle();
            this.setupText();
            this.setupParticleSystem();
            this.setupLines();
            this.setViewport();
            this.setFontSize();
            this.mouseEvents();
            this.resize();
            this.render();
            this.setupResize();

            this.show();
        })
        this.settings();
    }

    mouseEvents() {
        /*window.addEventListener('mousemove',(event)=>{
            this.mouse2 = {
                x: event.clientX/window.innerWidth * 2.0,
                y: event.clientY/window.innerHeight * 2.0 - 1.0,
            }
            // this.materialText.uniforms.uMouse.value = new THREE.Vector2(this.mouse2.x,this.mouse2.y)
            // this.material.uniforms.uMouse.value = new THREE.Vector2(this.mouse.x,this.mouse.y)
        });*/

        document.addEventListener('mousedown', () => {
            this.onPointerActive();
        });

        document.addEventListener('mouseup', () => {
            this.offPointerActive();
        });
    }

    settings() {
        this.settings = {
            progress: 0,
            explode: () => this.explode(),
            show: () => this.show(),
            hide: () => this.hide(),
            onActivateDelay: () => this.onActivateDelay(),
            animateInFill: () => this.animateInFill(),
            animateOutFill: () => this.animateOutFill(),
        };
        this.gui = new dat.GUI();
        this.gui.add(this.settings, "progress", 0, 1, 0.01);

        this.gui.add(this.settings, 'explode');
        this.gui.add(this.settings, 'onActivateDelay');
        this.gui.add(this.settings, 'show');
        this.gui.add(this.settings, 'hide');
        this.gui.add(this.settings, 'animateInFill');
        this.gui.add(this.settings, 'animateOutFill');
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
        });

        this.materialText = new THREE.RawShaderMaterial(MSDFShader({
            map: this.fontTexture,
            transparent: true,
            color: 0xffffff,
            side: THREE.DoubleSide
        }));

        let layout = this.geom.layout;
        this.text = new THREE.Mesh(this.geom, this.materialText);
        //this.text.scale.set(0.01,-0.01,0.01);
        //this.text.position.set(-0.01*layout.width/2, -0.01*layout.height/2,0)
        this.text.scale.set(1,-1,1);
        this.text.position.set(-1*layout.width/2, -1*layout.height/2,0);
        // text.position.set(0, -layout.descender + layout.height, 0)
        // text.scale.multiplyScalar(Math.random() * 0.5 + 0.5)
        this.scene.add(this.text);
    }

    setupCircle() {
        const circleGeometry = new THREE.CircleGeometry(1, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({color: 16711680, transparent: true});
        circleMaterial.opacity = .5;
        this.circle = new THREE.Mesh(circleGeometry, circleMaterial);

        //this.circle.layers.set(this.options.layer);
        this.circle.scale.multiplyScalar(this.textMaskRadius);
        this.circle.position.z = .1;
        this.circle.renderOrder = 1;
        this.scene.add(this.circle);
    }

    setupText() {
        const titleGeometry = createGeometry({
            width: this.props.width,
            align: this.options.align,
            font: font,
            lineHeight: font.common.lineHeight * this.options.lineHeight,
            text: this.options.text.toUpperCase()
        });
        const n = range(titleGeometry.attributes.position.count).fill(0);
        titleGeometry.setAttribute("progress", new THREE.Float32BufferAttribute(n, 1));

        this.letterPrArray = range(titleGeometry.attributes.position.count / 4).map(function () {
            return {pr: 0}
        });

        const titleMaterial = new THREE.RawShaderMaterial(MSDFShader({
            map: this.fontTexture,
            transparent: true,
            color: "white",
            pixelRatio: viewport.uiPixelRatio,
            lineWidth: this.options.lineWidth,
        }));
        titleMaterial.type = 'TitleMaterial';

        this.text = new THREE.Mesh(titleGeometry, titleMaterial);
        this.text.rotation.x = degToRad(180);
        //this.text.layers.set(this.options.layer);
        this.text.renderOrder = 50;
        this.scene.add(this.text);
    }

    setFontSize() {
        this.updateTitle();
    }

    updateTitle() {
        const fontSizeRem = this.props.fontSize / this.baseFontSize;
        this.text.scale.setScalar(fontSizeRem);
        this.text.geometry.update({width: this.props.width / fontSizeRem});

        this.text.geometry.layout.glyphs.forEach((glyph, i) => {
            const glyphData = glyph.data;
            times(this.options.particlesPerGlyph, (o) => {
                const particle = this.particles[i * this.options.particlesPerGlyph + o];
                if (particle) {
                    let position = glyph.position;
                    let positionX = position[0] + glyphData.width / 4;
                    let positionY = -position[1] - glyphData.height / 2;
                    positionX += getRandom(-glyphData.width / 2, glyphData.width / 2);
                    positionY += getRandom(-glyphData.height / 2, glyphData.height / 2);
                    particle.posBase = [positionX * fontSizeRem, positionY * fontSizeRem, 0];
                }
            })
        });

        const n = this.text.geometry.layout.width / this.text.geometry.layout.height;
        const i = this.props.width / 2;
        const r = this.props.width / n / 2;

        switch (this.options.position) {
            case"top-left":
                this.text.position.set(0, 2 * -r, 0);
                break;
            case"bottom-left":
                this.text.position.set(0, 0, 0);
                break;
            default:
                this.text.position.set(-i, -r, 0)
        }

        this.lines && this.lines.position.copy(this.text.position);
        this.points && this.points.position.copy(this.text.position);
        this.props.height = 2 * r;

        this.particles.forEach((particle) => {
            const n = sortBy(this.particles, function (sortParticle) {
                return particle === sortParticle ? 1 / 0 : getDistance(particle.posBase[0], particle.posBase[1], sortParticle.posBase[0], sortParticle.posBase[1]);
            });
            particle.neighbours = n.slice(0, 5).concat(n.slice(10, 15));
        });
        this.links = [];

        for (let o = 0; o < this.maxNumLinks; o++) this.createLink();
        this.updateBasePosition();
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

    setupParticleSystem() {
        this.particles = [];
        const particlesGeometry = new THREE.BufferGeometry();
        let particleIndex = (this.text && this.text.geometry.layout.width) || (this.text && this.text.geometry.layout.height) || 0;
        const geometryLayout = this.text.geometry.layout;
        const positions = [];
        const scales = [];

        geometryLayout.glyphs.forEach((gliyph) => {
            times(this.options.particlesPerGlyph, () => {
                const isSelected = Math.random() < .5;
                const secondScale = getRandom(.8, 1);
                const particle = {
                    visible: true,
                    index: particleIndex,
                    pos: [0, 0, 0],
                    posTarget: [0, 0, 0],
                    posBase: [gliyph.position[0] - geometryLayout.width / 2, -gliyph.position[1] - geometryLayout.height / 2, 0],
                    posVel: [0, 0],
                    spring: .02,
                    friction: .7,
                    speed: getRandom(.02, .1),
                    radius: isMobile ? getRandom(3, 6) : getRandom(3, 10),
                    startTime: getRandom(0, 2 * Math.PI),
                    scale: getRandom(2, 10),
                    selected: isSelected,
                    randomVal: getRandom(0, 1),
                    neighbours: []
                };
                this.particles.push(particle);

                positions.push(particle.posBase[0], particle.posBase[1], particle.posBase[2]);
                scales.push(particle.scale, secondScale);

                particleIndex++;
            });
        });

        particlesGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        particlesGeometry.setAttribute("options", new THREE.Float32BufferAttribute(scales, 2));

        this.particles.forEach((particle) => {
            const sortedParticles = sortBy(this.particles, function (sortParticle) {
                return particle === sortParticle ? 1 / 0 : getDistance(particle.posBase[0], particle.posBase[1], sortParticle.posBase[0], sortParticle.posBase[1])
            });
            particle.neighbours = sortedParticles.slice(0, 20);
        });

        const particlesMaterial = new THREE.ShaderMaterial({
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true,
            uniforms: {
                uCircleRadius: {value: this.textMaskRadius},
                uBasePos: {value: [0, 0]},
                uMousePos: {value: [0, 0]},
                uMousePosNorm: {value: [0, 0]},
                uViewport: {value: [0, 0]},
                uPixelRatio: {value: viewport.uiPixelRatio}
            },
            vertexShader: particlesVertex,
            fragmentShader: particlesFragment,
        });
        particlesMaterial.type = "TitleParticleSystemMaterial";
        this.points = new THREE.Points(particlesGeometry, particlesMaterial);
        // this.points.scale.set(0.01,0.01,0.01);

        this.scene.add(this.points);
        //this.points.layers.set(this.options.layer);
    }

    setupLines() {
        this.maxNumLinks = 150;
        this.links = [];

        for (let e = 0; e < this.maxNumLinks; e++) this.createLink();

        const linksCount = (isMobile || this.maxNumLinks);
        const linesGeometry = new THREE.InstancedBufferGeometry();
        linesGeometry.index = planeGeometry.index;
        linesGeometry.attributes = planeGeometry.attributes;

        const aConnectionPoints = new THREE.InstancedBufferAttribute(new Float32Array(4 * linksCount), 4);
        const aPointsIndex = new THREE.InstancedBufferAttribute(new Float32Array(2 * linksCount), 2);
        const aOptions = new THREE.InstancedBufferAttribute(new Float32Array(4 * linksCount), 4);
        const particles = this.particles;

        for (let index = 0; index < linksCount; index += 1) {
            for (var particleIndex1 = particles[getRandom2(0, particles.length - 1)].index, particleIndex2 = particles[getRandom2(0, particles.length - 1)].index; particleIndex1 === particleIndex2;) {
                particleIndex2 = particles[getRandom2(0, particles.length - 1)].index;
            }
            const particleIndex3 = getRandom(0, 1);
            aPointsIndex.setXY(index, particleIndex1, particleIndex2);
            aOptions.setXYZW(index, particleIndex3, false, 100, 0);
        }
        linesGeometry.setAttribute("aConnectionPoints", aConnectionPoints);
        linesGeometry.setAttribute("aPointsIndex", aPointsIndex);
        linesGeometry.setAttribute("aOptions", aOptions);

        this.lines = new THREE.Mesh(linesGeometry, new THREE.ShaderMaterial({
            uniforms: {uTime: {value: 0}, uProgress: {value: 0}, uScale: {value: 0}},
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            vertexShader: linesVertex,
            fragmentShader: linesFragment
        }));
        //this.lines.scale.set(0.01,0.01,0.01);
        this.lines.material.type = "TitleLinesMaterial";
        this.lines.frustumCulled = false;
        this.lines.material.depthWrite = false;
        //this.lines.layers.set(this.options.layer);
        this.scene.add(this.lines);
    }

    updateLinePositions() {
        this.filterLinks();

        if (this.links.length < this.maxNumLinks) {
            for (let e = 0; e < 5; e++) this.createLink();
        }

        const connectionPoints = this.lines.geometry.getAttribute("aConnectionPoints");
        const aOptions = this.lines.geometry.getAttribute("aOptions");

        for (let i = 0; i < connectionPoints.count; i += 1) {
            if (i < this.links.length) {
                const link = this.links[i];
                aOptions.setY(i, true);
                aOptions.setW(i, link.alpha);
                connectionPoints.setXYZW(i, link.from.pos[0], link.from.pos[1], link.to.pos[0], link.to.pos[1]);
                connectionPoints.needsUpdate = true;
            } else aOptions.setY(i, false);
            aOptions.needsUpdate = true;
        }
    }

    createLink() {
        const foundParticle = shuffle(this.particles).find((particle) => {
            const distance = getDistance(particle.pos[0] + this.textCenterPos[0], particle.pos[1] + this.textCenterPos[1], this.mouse[0], this.mouse[1]);
            // this.links.find((link) => {
            //     return link.from === particle || link.to === particle
            // });
            return distance < this.textMaskRadius
        });
        if (foundParticle) {
            const nearestNeighbour = sortBy(foundParticle.neighbours, (neighbour) => {
                return getDistance(foundParticle.pos[0], foundParticle.pos[1], neighbour.pos[0], neighbour.pos[1])
            })[0];

            const foundLink = this.links.find((link) => {
                return !(link.from !== foundParticle && link.from !== nearestNeighbour || link.to !== foundParticle && link.to !== nearestNeighbour)
            });

            if (!foundLink) {
                const distance = getDistance(nearestNeighbour.pos[0], nearestNeighbour.pos[1], foundParticle.pos[0], foundParticle.pos[1]);
                if (distance <= 0.5 * this.textMaskRadius) {
                    this.links.push({
                        from: foundParticle,
                        to: nearestNeighbour,
                        alpha: deNormalize(foundParticle.randomVal * nearestNeighbour.randomVal, .2, 1)
                    });
                }
            }
        }
    }

    filterLinks() {
        this.links = this.links.filter((link) => {
            var n = getDistance(link.from.pos[0] + this.textCenterPos[0], link.from.pos[1] + this.textCenterPos[1], this.mouse[0], this.mouse[1]),
                i = getDistance(link.from.pos[0], link.from.pos[1], link.to.pos[0], link.to.pos[1]);
            return n < 1.01 * this.textMaskRadius && i < this.textMaskRadius * deNormalize(link.from.randomVal, .3, .7)
        });
    }

    whileRender() {
        this.time = performance.now() / 10000;
        const width = viewport.width,
            height = viewport.height,
            scale = viewport.scale,
            positionNormX = pointer.positionNorm[0],
            positionNormY = pointer.positionNorm[1],
            s = isMobile ? -0.3 * scale : 0;

        this.mouseNorm[0] += .12 * (positionNormX - this.mouseNorm[0]);
        this.mouseNorm[1] += .12 * (positionNormY - this.mouseNorm[1] + s);
        this.mouse[0] = deNormalize(this.mouseNorm[0], -width / 2, width / 2);
        this.mouse[1] = deNormalize(this.mouseNorm[1], height / 2, -height / 2);

        //console.log(this.mouse[0]);

        const u = this.props.pointerActive || .05;
        const l = this.props.pointerActive || .6;

        this.textMaskRadiusVel += (this.textMaskRadiusTarget - this.textMaskRadius) * u;
        this.textMaskRadiusVel *= l;
        this.textMaskRadius += this.textMaskRadiusVel;
        this.particleMaskRadiusVel += (this.particleMaskRadiusTarget - this.particleMaskRadius) * u;
        this.particleMaskRadiusVel *= l;
        this.particleMaskRadius += this.particleMaskRadiusVel;

        if (this.text) {
            this.text.material.uniforms.uCircleRadius.value = this.textMaskRadius;
            this.text.material.uniforms.uMousePosNorm.value = this.mouseNorm;
            this.text.material.uniforms.uTime.value = this.time;

            //this.text.material.uniforms.uCircleRadius.value = this.textMaskRadius;
            // this.text.material.uniforms.uMouse.value = this.mouse2;
            // this.text.material.uniforms.time.value = this.time * 10;
        }

        if (this.circle) {
            this.circle.scale.set(this.textMaskRadius, this.textMaskRadius, this.textMaskRadius);
            const mouseX = this.mouse[0];
            const mouseY = this.mouse[1];
            this.circle.position.x = mouseX;
            this.circle.position.y = mouseY;
        }

        if (this.points) {
            this.points.material.uniforms.uCircleRadius.value = this.particleMaskRadius;
            this.points.material.uniforms.uMousePos.value = this.mouse;
            this.points.material.uniforms.uBasePos.value[0] = this.textCenterPos[0];
            this.points.material.uniforms.uBasePos.value[1] = this.textCenterPos[1];
            this.updateParticlePositions();
        }

        if (this.lines) {
            this.lines.material.uniforms.uScale.value = this.tweens.lineScale;
            this.updateLinePositions();
        }
    }

    updateParticlePositions() {
        this.isActiveDelay = true; // временно

        if (!this.points) return;

        const aPosition = this.points.geometry.getAttribute("position");

        for (let t = 0; t < this.particles.length; t += 1) {
            const particle = this.particles[t];
            const direction = particle.randomVal > .5 ? 1 : -1;
            const pos = particle.startTime + this.time * particle.speed * direction * (this.props.pointerActive ? 2 : 1);
            let posX = particle.posBase[0] + Math.sin(100 * pos) * particle.radius;
            let posY = particle.posBase[1] + Math.cos(100 * pos) * particle.radius;

            if (this.isActiveDelay) {
                const baseDistanceToMouse = getDistance(particle.posBase[0] + this.textCenterPos[0], particle.posBase[1] + this.textCenterPos[1], this.mouse[0], this.mouse[1]);
                const distanceToMouse = getDistance(particle.pos[0] + this.textCenterPos[0], particle.pos[1] + this.textCenterPos[1], this.mouse[0], this.mouse[1]);
                particle.visible = distanceToMouse < this.particleMaskRadius;

                if (particle.visible && baseDistanceToMouse < this.particleMaskRadius) {
                    const dx = particle.posBase[0] + this.textCenterPos[0] - this.mouse[0];
                    const dy = particle.posBase[1] + this.textCenterPos[1] - this.mouse[1];
                    const angle = Math.atan2(dy, dx);

                    if (baseDistanceToMouse < 100 && particle.selected) {
                        posX = -this.textCenterPos[0] + this.mouse[0] + Math.cos(angle) * this.particleMaskRadius * .3 + Math.sin(50 * pos) * particle.radius * 1.5 * (this.props.pointerActive ? 2 : 1);
                        posY = -this.textCenterPos[1] + this.mouse[1] + Math.sin(angle) * this.particleMaskRadius * .3 + Math.cos(50 * pos) * particle.radius * 1.5 * (this.props.pointerActive ? 2 : 1);
                    } else {
                        posX = -this.textCenterPos[0] + this.mouse[0] + Math.cos(angle) * this.particleMaskRadius + Math.sin(60 * pos) * particle.radius * (this.props.pointerActive ? 3 : 1);
                        posY = -this.textCenterPos[1] + this.mouse[1] + Math.sin(angle) * this.particleMaskRadius + Math.cos(60 * pos) * particle.radius * (this.props.pointerActive ? 3 : 1);
                    }
                }
            } else {
                particle.visible = false;
            }

            const spring = particle.spring;
            const friction = particle.friction;

            particle.posVel[0] = (posX - particle.pos[0]) * spring + particle.posVel[0] * friction;
            particle.posVel[1] = (posY - particle.pos[1]) * spring + particle.posVel[1] * friction;
            particle.pos[0] += particle.posVel[0];
            particle.pos[1] += particle.posVel[1];

            aPosition.setXYZ(t, particle.pos[0], particle.pos[1], particle.pos[2]);
            aPosition.needsUpdate = true;
        }
    }

    updateBasePosition() {
        requestAnimationFrame(() => {
            const vector3 = new THREE.Vector3;
            this.points.updateMatrixWorld();
            vector3.setFromMatrixPosition(this.points.matrixWorld);
            this.textCenterPos = [vector3.x, vector3.y];
        })
    }

    setViewport() {
        const width = viewport.width;
        const height = viewport.height;
        const scale = viewport.scale;
        const ratio = viewport.uiPixelRatio;

        this.maskMaxRadius = (isMobile ? 100 : 80) * scale;

        if (this.text) {
            this.text.material.uniforms.uViewport.value[0] = width * ratio;
            this.text.material.uniforms.uViewport.value[1] = height * ratio;
        }

        if (this.points) {
            this.points.material.uniforms.uViewport.value[0] = width * ratio;
            this.points.material.uniforms.uViewport.value[1] = height * ratio;

            const options = this.points.geometry.getAttribute("options");

            for (let a = 0; a < options.count; a += 1) {
                const s = (isMobile ? getRandom(3, 15) : getRandom(2, 10)) * scale;
                options.setX(a, s);
                options.needsUpdate = true;
            }
        }
    }

    show() {
        const options = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        const delay = options.delay || 0;
        const dur = options.dur || 1;
        const stagger = options.stagger || .01;
        const easeLetter = options.easeLetter || "easeOutSine";
        const fullDur = options.fillDur || 1;
        const fullDelay = options.fillDelay || .8;
        const uniforms = this.text.material.uniforms;

        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, {
            duration: fullDur,
            value: 1,
            ease: "easeOutSine",
            delay: delay + fullDelay,
            onComplete: () => {
                if (!isMobile && this.options.interaction) {
                    this.props.active = true;
                    this.offPointerActive();
                }
            }
        });

        gsap.killTweensOf(this.letterPrArray);
        gsap.to(this.letterPrArray, {
            duration: dur,
            stagger: stagger,
            pr: 1,
            delay: delay,
            ease: easeLetter,
            onStart: () => {
                this.props.render = true;
                this.props.v = true;
            },
            onUpdate: () => this.updateProgressAttribute()
        });
        this.updateBasePosition();
    }

    hide() {
        const options = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        const delay = options.delay || 0;
        const dur = options.dur || .3;
        const stagger = options.stagger || 0;
        const uniforms = this.text.material.uniforms;

        this.props.active = false;

        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, {
            duration: dur,
            value: 0,
            ease: "easeOutSine",
            delay: delay
        });
        gsap.killTweensOf(this.letterPrArray);
        gsap.to(this.letterPrArray, {
            duration: dur,
            stagger: stagger,
            pr: 0,
            ease: "easeOutSine",
            delay: delay,
            onUpdate: () => this.updateProgressAttribute(),
            onComplete: () => {
                this.props.v = false;
                this.props.render = false;
            }
        });
    }

    updateProgressAttribute() {
        this.text.geometry.attributes.progress.array.set(
            flatten(this.letterPrArray.map(function (e) {
                return [e.pr, e.pr, e.pr, e.pr]
            }))
        );
        this.text.geometry.attributes.progress.needsUpdate = true;
    }

    stop() {
        this.isPlaying = false;
    }

    onPointerActive() {
        if (this.options.interaction && this.props.render) {
            if (isMobile) {
                this.props.active = true;
            } else {
                this.textMaskRadiusTarget = 2 * this.maskMaxRadius;
                this.particleMaskRadiusTarget = 2 * this.maskMaxRadius;
            }
        }
    }

    offPointerActive() {
        if (this.options.interaction && this.props.render) {
            if (isMobile) {
                this.props.active = false;
            } else {
                this.props.active = true;
                this.textMaskRadiusTarget = this.maskMaxRadius;
                this.particleMaskRadiusTarget = this.maskMaxRadius;
            }
        }
    }

    onActivateDelay() {
        this.particleMaskRadiusTarget = this.maskMaxRadius;
        this.isActiveDelay = true;
        gsap.killTweensOf(this.tweens, {lineScale: true});
        gsap.to(this.tweens,  {
            duration: 2.5,
            lineScale: 1,
            ease: "easeOutExpo",
            delay: .3
        });
    }

    animateInFill() {
        const uniforms = this.text.material.uniforms;
        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, {
            duration: 1,
            value: 1,
            ease: "easeOutExpo"
        });
        gsap.killTweensOf([uniforms.uOutlineMaskProgress]);
        gsap.to(uniforms.uOutlineMaskProgress,  {
            duration: 1,
            value: 1,
            ease: "easeOutExpo"
        });
    }

    animateOutFill() {
        const uniforms = this.text.material.uniforms;
        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, {
            duration: 1,
            value: .05,
            ease: "easeOutExpo"
        });
        gsap.killTweensOf([uniforms.uOutlineMaskProgress]);
        gsap.to(uniforms.uOutlineMaskProgress, {
            duration: 1,
            value: .5,
            ease: "easeOutExpo"
        });
    }

    explode() {
        this.textMaskRadiusTarget = 5 * this.maskMaxRadius;
        this.particleMaskRadiusTarget = 5 * this.maskMaxRadius;
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
        //this.material.uniforms.time.value = this.time;
        // if(this.materialText) {
        //     this.materialText.uniforms.time.value = this.time;
        // }

        this.whileRender();

        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}

new Sketch({
    dom: document.getElementById("container"),
    text: "Have a good day",
    align: "center",
    position: "center",
    lineHeight: .8,
    //layer: 1,
    interaction: true,
    animationDuration: 2,
    animationStagger: .05,
    lineWidth: .15,
    particlesPerGlyph: 16
});
