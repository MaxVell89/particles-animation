uniform float uCircleRadius;
uniform vec2 uMousePos;
uniform vec2 uViewport;
uniform float uPixelRatio;

varying float vVisible;
varying float vAlpha;

float circle(vec2 _st, float _radius){
    float radius = _radius * 0.5;
    float dist = distance(_st, vec2(0.5));

    return 1.0 - smoothstep(radius, radius + 0.1, dist);
}

float createMask() {
    vec2 viewportUv = gl_FragCoord.xy / uViewport;
    float viewportAspect = uViewport.x / uViewport.y;

    vec2 mousePoint = vec2(uMousePos.x, 1.0 - uMousePos.y);
    float circleRadius = max(0.0, uCircleRadius / uViewport.x) * 2.0;

    vec2 shapeUv = viewportUv - mousePoint;
    shapeUv /= vec2(1.0, viewportAspect);
    shapeUv += mousePoint;

    float dist = distance(shapeUv, mousePoint);
    dist = smoothstep(circleRadius, circleRadius + 0.001, dist);
    return 1.0 - dist;
}

void main() {
    float circleMask = createMask();

    float alpha = circle(gl_PointCoord, 0.9) * vAlpha * vVisible; // * circleMask;

    gl_FragColor = vec4( vec3(1.0), alpha);
    //gl_FragColor = vec4( vec3(1.0), 1.0);
    // gl_FragColor = vec4( vec3(1.0,0.0,0.0), circleMask );
}
