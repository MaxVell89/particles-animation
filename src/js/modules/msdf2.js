import vertex from '../modules/shader/msdf/vertex.glsl';
import fragment from '../modules/shader/msdf/fragment.glsl';
var assign = require('object-assign');

import gradientTexture from '../../img/font/gradient.png';

module.exports = function createMSDFShader(opt) {
    opt = opt || {};
    var opacity = "number" == typeof opt.opacity ? opt.opacity : 1,
        color = opt.color,
        map = opt.map,
        pixelRatio = opt.pixelRatio,
        lineWidth = "number" == typeof opt.lineWidth ? opt.lineWidth : .2;

    delete opt.pixelRatio;
    delete opt.map;
    delete opt.color;
    delete opt.opacity;
    delete opt.lineWidth;

    return assign({
        uniforms: {
            opacity: {type: "f", value: opacity},
            msdfMap: {type: "t", value: map || new THREE.Texture},
            color: {type: "c", value: new THREE.Color(color)},
            lineWidth: {value: lineWidth},
            gradientMap: {value: new THREE.TextureLoader().load(gradientTexture)},
            uOutlineMaskProgress: {value: 0.5},
            uLineGradientProgress: {value: 0},
            uFillProgress: {value: 0},
            uCircleRadius: {value: 0},
            uMousePosNorm: {value: [0, 0]},
            uViewport: {value: [0, 0]},
            uTime: {value: 0},
            uPixelRatio: {value: pixelRatio}
        },
        vertexShader: vertex,
        fragmentShader: fragment
    }, opt);
}