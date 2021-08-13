attribute vec2 options;

uniform vec2 uMousePos;
uniform vec2 uBasePos;
uniform float uCircleRadius;
uniform float uPixelRatio;

varying float vVisible;
varying float vAlpha;

void main() {
    vec3 pos = position;

    vec2 posPlusBase = pos.xy + uBasePos;
    float distToMouse = distance(uMousePos, posPlusBase);
    vVisible = step(distToMouse, uCircleRadius * 1.2);
    vAlpha = options.y;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    gl_PointSize = options.x * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
}
