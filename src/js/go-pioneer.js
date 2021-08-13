import detectTouch from './libs/detectTouch';
import * as THREE from "three";
import {times, sortBy, flatten, shuffle, pick, range} from "lodash";
import gsap from 'gsap';
import {getRandom, getDistance, getRandom2, degToRad, clamp} from "./utils";
import particlesVertex from "./modules/shader/particles/vertex.glsl";
import particlesFragment from "./modules/shader/particles/fragment.glsl";
import linesVertex from "./modules/shader/lines/vertex.glsl";
import linesFragment from "./modules/shader/lines/fragment.glsl";

global.THREE = THREE;

const createGeometry = require('three-bmfont-text')
const MSDFShader = require('./modules/msdf');

//import font from '../fonts/manifold.json';
import font from './modules/font';
import fontTexture from '../fonts/manifold.png';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

const isMobile = detectTouch();
const planeGeometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1);
const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    //scale: (t = isMobile ? 1080 : 1920, e = isMobile ? 0 : .6, n = isMobile ? 2 : 1, Object(l.a)(window.innerWidth / t, e, n)),
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    uiPixelRatio: 2
};
const pointer = {position: [.5, .5], positionNorm: [.5, .5], active: false, click: 0};

export class SuperText {
    constructor(props) {
        this.dom = props.dom;

        this.options = {
            text: "Text",
            align: "left",
            position: "center",
            lineHeight: .8,
            layer: 1,
            interaction: true,
            animationDuration: 2,
            animationStagger: .05,
            lineWidth: .15,
            particlesPerGlyph: 6
        };

        this.props = {
            viewport: viewport,
            v: false,
            active: false,
            render: false,
            fontSize: 20,
            width: 200,
            height: 200,
            pointerActive: this.options.interaction && pointer.active,
        }

        new THREE.TextureLoader().load(fontTexture,(t) => {
            this.fontTexture = t;

            this.onSetup();
            this.render();
        });
    }

    onSetup() {
        this.tweens = {
            lineMaskProgress: 0,
            lineGradientProgress: 0,
            fillProgress: 0,
            lineScale: 0
        };
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

        this.setupWebgl();

        this.setupCircle();

        this.title = this.setupTitle(); // await?
        this.particleInstance = this.setupParticleSystem();
        this.lines = this.setupLines(); // await?
        this.props.pZ = 3;

        this.show();
    }

    setupWebgl() {
        this.scene = new THREE.Scene();

        this.container = this.dom;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(viewport.pixelRatio);
        this.renderer.setSize(viewport.width, viewport.height);
        this.renderer.setClearColor(0x333333, 1);

        this.container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.001,
            10000
        );
        this.camera.position.set(0, 0, 200);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    setupCircle() {
        const circleGeometry = new THREE.CircleGeometry(1, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({color: 16711680, transparent: true});
        circleMaterial.opacity = .5;
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);

        circleMesh.layers.set(this.options.layer);
        circleMesh.scale.multiplyScalar(this.textMaskRadius);
        circleMesh.position.z = .1;
        circleMesh.renderOrder = 1;
        this.scene.add(circleMesh);
        return circleMesh;
    }

    setupTitle() {
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
            lineWidth: this.options.lineWidth
        }));
        titleMaterial.type = 'TitleMaterial';

        const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
        titleMesh.rotation.x = degToRad(180);
        titleMesh.layers.set(this.options.layer);
        titleMesh.renderOrder = 50;
        this.scene.add(titleMesh);
        //e.abrupt("return", r);

        return titleMesh;
    }

    setupParticleSystem() {
        this.particles = [];
        const particlesGeometry = new THREE.BufferGeometry();
        let particleIndex = (this.title && this.title.geometry.layout.width) || (this.title && this.title.geometry.layout.height) || 0;
        const geometryLayout = this.title.geometry.layout;
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
        const pointsMaterial = new THREE.PointsMaterial({color: '#fff'});
        const points = new THREE.Points(particlesGeometry, pointsMaterial);

        this.scene.add(points);
        points.layers.set(this.options.layer);

        return points;
    }

    setupLines() {
        this.maxNumLinks = 150;
        this.links = [];

        for (let e = 0; e < this.maxNumLinks; e++) this.createLink();

        const linksCount = (isMobile || this.maxNumLinks);
        const lineGeometry = new THREE.InstancedBufferGeometry;
        lineGeometry.copy(planeGeometry);

        const aConnectionPoints = new THREE.InstancedBufferAttribute(new Float32Array(4 * linksCount), 4);
        const aConnectionPoints2 = new THREE.InstancedBufferAttribute(new Float32Array(4 * linksCount), 4);
        const aConnectionPoints3 = new THREE.InstancedBufferAttribute(new Float32Array(4 * linksCount), 4);
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
        lineGeometry.setAttribute("aConnectionPoints", aConnectionPoints);
        lineGeometry.setAttribute("aConnectionPoints2", aConnectionPoints2);
        lineGeometry.setAttribute("aConnectionPoints3", aConnectionPoints3);
        lineGeometry.setAttribute("aPointsIndex", aPointsIndex);
        lineGeometry.setAttribute("aOptions", aOptions);

        const lineMaterial = new THREE.Mesh(lineGeometry, new THREE.ShaderMaterial({
            uniforms: {uTime: {value: 0}, uProgress: {value: 0}, uScale: {value: 0}},
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            vertexShader: linesVertex,
            fragmentShader: linesFragment
        }));
        lineMaterial.material.type = "TitleLinesMaterial";
        lineMaterial.frustumCulled = false;
        lineMaterial.material.depthWrite = false;
        lineMaterial.layers.set(this.options.layer);
        this.scene.add(lineMaterial);
        return lineMaterial;
    }

    setFontSize() {
        this.updateTitle();
    }

    updateTitle() {
        const fontSizeRem = this.props.fontSize / this.baseFontSize;
        this.title.scale.setScalar(fontSizeRem);
        this.title.geometry.update({width: this.props.width / fontSizeRem});

        this.title.geometry.layout.glyphs.forEach((glyph, i) => {
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

        const n = this.title.geometry.layout.width / this.title.geometry.layout.height;
        const i = this.props.width / 2;
        const r = this.props.width / n / 2;

        switch (this.options.position) {
            case"top-left":
                this.title.position.set(0, 2 * -r, 0);
                break;
            case"bottom-left":
                this.title.position.set(0, 0, 0);
                break;
            default:
                this.title.position.set(-i, -r, 0)
        }

        this.lines && this.lines.position.copy(this.title.position);
        this.particleInstance && this.particleInstance.position.copy(this.title.position);
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

    updateBasePosition() {
        requestAnimationFrame(() => {
            const vector3 = new THREE.Vector3;
            this.particleInstance.updateMatrixWorld();
            vector3.setFromMatrixPosition(this.particleInstance.matrixWorld);
            this.textCenterPos = [vector3.x, vector3.y];
        })
    }

    onPointerActive() {
        if (this.options.interaction && this.props.render && this._visible) {
            if (isMobile) {
                this.props.active = true;
            } else {
                this.textMaskRadiusTarget = 2 * this.maskMaxRadius;
                this.particleMaskRadiusTarget = 2 * this.maskMaxRadius;
            }
        }
    }

    offPointerActive() {
        if (this.options.interaction && this.props.render && this._visible) {
            if (isMobile) {
                this.props.active = false;
            } else {
                this.props.active = true;
                this.textMaskRadiusTarget = this.maskMaxRadius;
                this.particleMaskRadiusTarget = this.maskMaxRadius;
            }
        }
    }

    explode() {
        this.textMaskRadiusTarget = 5 * this.maskMaxRadius, this.particleMaskRadiusTarget = 5 * this.maskMaxRadius;
    }

    updateProgressAttribute() {
        this.title.geometry.attributes.progress.array.set(
            flatten(this.letterPrArray.map(function (e) {
                return [e.pr, e.pr, e.pr, e.pr]
            }))
        );
        this.title.geometry.attributes.progress.needsUpdate = true;
    }

    show() {
        const options = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        const delay = options.delay || 0;
        const dur = options.dur || 1;
        const stagger = options.stagger || .01;
        const easeLetter = options.easeLetter || "easeOutSine";
        const fullDur = options.fillDur || 1;
        const fullDelay = options.fillDelay || .8;
        const uniforms = this.title.material.uniforms;

        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, fullDur, {
            value: 1,
            ease: "easeOutSine",
            delay: delay + fullDelay,
            onComplete: () => {
                if (!isMobile && this.options.interaction) {
                    this.props.active = true;
                }
            }
        });

        gsap.killTweensOf(this.letterPrArray);
        gsap.staggerTo(this.letterPrArray, dur, {
            pr: 1,
            delay: delay,
            ease: easeLetter,
            onStart: () => {
                this.props.render = true;
                this.props.v = true;
            },
            onUpdate: this.updateProgressAttribute
        }, stagger);
        this.updateBasePosition();
    }

    hide() {
        const options = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        const delay = options.delay || 0;
        const dur = options.dur || .3;
        const stagger = options.stagger || 0;
        const uniforms = this.title.material.uniforms;

        this.props.active = false;

        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, dur, {
            value: 0,
            ease: "easeOutSine",
            delay: delay
        });
        gsap.killTweensOf(this.letterPrArray);
        gsap.staggerTo(this.letterPrArray, dur, {
            pr: 0,
            ease: "easeOutSine",
            delay: delay,
            onUpdate: this.updateProgressAttribute,
            onComplete: () => {
                this.props.v = false;
                this.props.render = false;
            }
        }, stagger);
    }

    onActive() {
        this.textMaskRadiusTarget = this.maskMaxRadius;
        if (this.title) {
            const uniforms = this.title.material.uniforms;
            gsap.killTweensOf([uniforms.uOutlineMaskProgress, uniforms.uLineGradientProgress]);
            gsap.to(uniforms.uOutlineMaskProgress, 2.5, {
                value: .4,
                ease: "easeOutExpo",
                delay: 0
            });
        }
        gsap.delayedCall(.3, this.onActivateDelay);
    }

    onActivateDelay() {
        this.particleMaskRadiusTarget = this.maskMaxRadius;
        this.isActiveDelay = true;
        gsap.killTweensOf(this.tweens, {lineScale: true});
        gsap.to(this.tweens, 2.5, {
            lineScale: 1,
            ease: "easeOutExpo",
            delay: .3
        })
    }

    offActive() {
        this.isActiveDelay = false;
        this.textMaskRadiusTarget = 0.0001;
        this.particleMaskRadiusTarget = 0.0001;
        if (this.title) {
            const uniforms = this.title.material.uniforms;
            gsap.killTweensOf([uniforms.uOutlineMaskProgress, uniforms.uLineGradientProgress]);
            gsap.to(uniforms.uOutlineMaskProgress, 1.5, {
                value: 1,
                ease: "easeOutExpo",
                delay: 0
            });
        }
        gsap.killTweensOf(this.tweens, {lineScale: true});
        gsap.to(this.tweens, 1.5, {
            lineScale: 0,
            ease: "easeOutExpo",
            delay: 0
        });
        gsap.killDelayedCallsTo(this.onActivateDelay);
    }

    animateInFill() {
        const uniforms = this.title.material.uniforms;
        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, 1, {
            value: 1,
            ease: "easeOutExpo"
        });
        gsap.killTweensOf([uniforms.uOutlineMaskProgress]);
        gsap.to(uniforms.uOutlineMaskProgress, 1, {
            value: 1,
            ease: "easeOutExpo"
        });
    }

    animateOutFill() {
        const uniforms = this.title.material.uniforms;
        gsap.killTweensOf(uniforms.uFillProgress);
        gsap.to(uniforms.uFillProgress, 1, {
            value: .05,
            ease: "easeOutExpo"
        });
        gsap.killTweensOf([uniforms.uOutlineMaskProgress]);
        gsap.to(uniforms.uOutlineMaskProgress, 1, {
            value: .5,
            ease: "easeOutExpo"
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
        this.mouse[0] = clamp(this.mouseNorm[0], -width / 2, width / 2);
        this.mouse[1] = clamp(this.mouseNorm[1], height / 2, -height / 2);

        const u = this.props.pointerActive || .05;
        const l = this.props.pointerActive || .6;

        this.textMaskRadiusVel += (this.textMaskRadiusTarget - this.textMaskRadius) * u;
        this.textMaskRadiusVel *= l;
        this.textMaskRadius += this.textMaskRadiusVel;
        this.particleMaskRadiusVel += (this.particleMaskRadiusTarget - this.particleMaskRadius) * u;
        this.particleMaskRadiusVel *= l;
        this.particleMaskRadius += this.particleMaskRadiusVel;

        if (this.title) {
            this.title.material.uniforms.uCircleRadius.value = this.textMaskRadius;
            this.title.material.uniforms.uMousePosNorm.value = this.mouseNorm;
            this.title.material.uniforms.uTime.value = this.time;
        }

        if (this.circle) {
            this.circle.scale.set(this.textMaskRadius, this.textMaskRadius, this.textMaskRadius);
            const mouseX = this.mouse[0];
            const mouseY = this.mouse[1];
            this.circle.position.x = mouseX;
            this.circle.position.y = mouseY;
        }

        if (this.particleInstance) {
            this.particleInstance.material.uniforms.uCircleRadius.value = this.particleMaskRadius;
            this.particleInstance.material.uniforms.uMousePos.value = this.mouse;
            this.particleInstance.material.uniforms.uBasePos.value[0] = this.textCenterPos[0];
            this.particleInstance.material.uniforms.uBasePos.value[1] = this.textCenterPos[1];
            this.updateParticlePositions();
        }

        if (this.lines) {
            this.lines.material.uniforms.uScale.value = this.tweens.lineScale;
            this.updateLinePositions();
        }
    }

    updateParticlePositions() {
        const aPosition = this.particleInstance.geometry.getAttribute("position");

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

                if (particle.visible, baseDistanceToMouse < this.particleMaskRadius) {
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
            particle.pos[0] += particle.posVel[0], particle.pos[1] += particle.posVel[1];
            aPosition.setXYZ(t, particle.pos[0], particle.pos[1], particle.pos[2]);
            aPosition.needsUpdate = true;
        }
    }

    filterLinks() {
        this.links = this.links.filter((link) => {
            var n = getDistance(link.from.pos[0] + this.textCenterPos[0], link.from.pos[1] + this.textCenterPos[1], this.mouse[0], this.mouse[1]),
                i = getDistance(link.from.pos[0], link.from.pos[1], link.to.pos[0], link.to.pos[1]);
            return n < 1.01 * this.textMaskRadius && i < this.textMaskRadius * clamp(link.from.randomVal, .3, .7)
        })
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
                        alpha: clamp(foundParticle.randomVal * nearestNeighbour.randomVal, .2, 1)
                    });
                }
            }
        }
    }

    updateLinePositions() {
        this.filterLinks();

        if (this.links.length < this.maxNumLinks) {
            for (let e = 0; e < 5; e++) this.createLink();
        }

        const t = this.lines.geometry.getAttribute("aConnectionPoints");
        const n = (this.lines.geometry.getAttribute("aPointsIndex"), this.lines.geometry.getAttribute("aOptions"));

        for (let i = 0; i < t.count; i += 1) {
            if (i < this.links.length) {
                const link = this.links[i];
                n.setY(i, !0), n.setW(i, link.alpha), t.setXYZW(i, link.from.pos[0], link.from.pos[1], link.to.pos[0], link.to.pos[1]), t.needsUpdate = !0
            } else n.setY(i, !1);
            n.needsUpdate = true;
        }
    }

    setViewport() {
        const viewport = viewport;
        const width = viewport.width;
        const height = viewport.height;
        const scale = viewport.scale;
        const ratio = viewport.uiPixelRatio;

        this.maskMaxRadius = (isMobile ? 200 : 140) * scale;

        if (this.title) {
            this.title.material.uniforms.uViewport.value[0] = width * ratio;
            this.title.material.uniforms.uViewport.value[1] = height * ratio;
        }

        if (this.particleInstance) {
            this.particleInstance.material.uniforms.uViewport.value[0] = width * ratio;
            this.particleInstance.material.uniforms.uViewport.value[1] = height * ratio;

            const options = this.particleInstance.geometry.getAttribute("options");

            for (let a = 0; a < options.count; a += 1) {
                const s = (isMobile ? getRandom(3, 15) : getRandom(2, 10)) * scale;
                options.setX(a, s);
                options.needsUpdate = true;
            }
        }
    }

    render() {
        this.updateTitle();
        this.updateBasePosition();
        this.updateProgressAttribute();
        this.whileRender();

        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}