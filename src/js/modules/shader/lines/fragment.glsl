varying float vVisible;
varying float vAlpha;

void main() {
    vec3 color = vec3(1.0);
    float alpha = vVisible * vAlpha;

    gl_FragColor = vec4(color, alpha);
}