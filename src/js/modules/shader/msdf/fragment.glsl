#version 300 es
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
//#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
//#define textureCube texture
//#define texture2DProj textureProj
//#define texture2DLodEXT textureLod
//#define texture2DProjLodEXT textureProjLod
//#define textureCubeLodEXT textureLod
//#define texture2DGradEXT textureGrad
//#define texture2DProjGradEXT textureProjGrad
//#define textureCubeGradEXT textureGrad
//precision highp float;
//precision highp int;

precision highp float;
uniform float opacity;
uniform vec3 color;
uniform sampler2D msdfMap;
uniform sampler2D gradientMap;
uniform float lineWidth;

varying vec2 vUv;
varying float vProgress;

uniform float uOutlineMaskProgress;
uniform float uLineGradientProgress;
uniform float uFillProgress;
uniform float uCircleRadius;
uniform vec2 uMousePosNorm;
uniform vec2 uViewport;
uniform float uPixelRatio;
uniform float uTime;

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float createCircle() {
    vec2 viewportUv = gl_FragCoord.xy / uViewport;
    float viewportAspect = uViewport.x / uViewport.y;

    vec2 mousePoint = vec2(uMousePosNorm.x, 1.0 - uMousePosNorm.y);
    float circleRadius = max(0.0, uCircleRadius / uViewport.x) * uPixelRatio;

    vec2 shapeUv = viewportUv - mousePoint;
    shapeUv /= vec2(1.0, viewportAspect);
    shapeUv += mousePoint;

    float dist = distance(shapeUv, mousePoint);
    dist = smoothstep(circleRadius, circleRadius + 0.001, dist);
    return dist;
}

float map(float value, float inMin, float inMax, float outMin, float outMax, bool clamped) {
    if (clamped) value = min(inMax, max(inMin, value));

    return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

void main() {
    float circleMask = createCircle();

    float lineProgress = uOutlineMaskProgress * vProgress;
    float fillProgress =  uFillProgress;
    // float fillProgress = map(vProgress, 0.5, 1.0, 0.0, 1.0, true);// * uFillProgress;

    float gradientTexture = texture2D(gradientMap, vUv).r;
    vec3 msdfSample = texture2D(msdfMap, vUv).rgb;
    float sigDist = median(msdfSample.r, msdfSample.g, msdfSample.b) - 0.5;

    float gradient = fract((gradientTexture + uTime * 0.5)  * 2.0);
    float border = fwidth(sigDist);

    float outline = smoothstep(-0., -0. + border, sigDist * 1.4);
    outline *= 1.0 - smoothstep(lineWidth - border, lineWidth, sigDist * 1.4);

    sigDist = sigDist / border;
    float fill = clamp(sigDist + 0.5, 0.0, 1.0) * circleMask;
    outline = clamp(outline, 0.0, 1.0) * vProgress;

    float step = 0.01;
    float start = smoothstep(0.0, step, gradient);
    float end = smoothstep(1.0 * lineProgress, (1.0 * lineProgress) - step, gradient);
    float mask = start * end;
    mask = max(0.1, mask);

    float alpha = outline * mask + fill * fillProgress;
    alpha = clamp(alpha, 0.0, 1.0);

    gl_FragColor = vec4(clamp(color.xyz, 0.0, 1.0), alpha);

    //gl_FragColor = vec4(circleMask, 0.0, 0.0, 1.0);

    //gl_FragColor.rgb += vec3(1.0,0.0,0.0);
    //gl_FragColor = vec4(vec3(1.0,0.0,0.0), 1.0);
}

