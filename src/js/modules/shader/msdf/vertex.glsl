#version 300 es
#define attribute in
#define varying out
//#define texture2D texture
attribute vec2 uv;
attribute vec4 position;
attribute float progress;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;
varying float vProgress;

void main() {
    vUv = uv;
    vProgress = progress;

    gl_Position = projectionMatrix * modelViewMatrix * position;
}
