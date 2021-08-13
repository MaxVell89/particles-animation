//uniform float uTime;
//uniform float uProgress;
uniform float uScale;

//varying vec2 vUv;
varying float vVisible;
varying float vAlpha;

attribute vec4 aOptions;
attribute vec4 aConnectionPoints;
attribute vec4 aPointsIndex;

#define PI 3.1415926538

float toRadians(float deg) {
    return deg * (3.141592653589793 / 180.0);
}

// transforms the 'blueprint' geometry with instance attributes
vec3 transform( inout vec3 position, vec3 T, vec4 R, vec3 S ) {
    //applies the scale
    position *= S;
    //computes the rotation where R is a (vec4) quaternion
    position += 2.0 * cross( R.xyz, cross( R.xyz, position ) + R.w * position );
    //translates the transformed 'blueprint'
    position += T;
    //return the transformed position
    return position;
}

vec4 quaternion(vec3 axis, float angle) {
    float halfAngle = angle/2.0;
    vec4 q = vec4(0.0);

    q.x = axis.x * sin(halfAngle);
    q.y = axis.y * sin(halfAngle);
    q.z = axis.z * sin(halfAngle);
    q.w = cos(halfAngle);

    return q;
}

vec4 quaternionMultiply(vec4 q1, vec4 q2)
{
    vec4 qr;
    qr.x = (q1.w * q2.x) + (q1.x * q2.w) + (q1.y * q2.z) - (q1.z * q2.y);
    qr.y = (q1.w * q2.y) - (q1.x * q2.z) + (q1.y * q2.w) + (q1.z * q2.x);
    qr.z = (q1.w * q2.z) + (q1.x * q2.y) - (q1.y * q2.x) + (q1.z * q2.w);
    qr.w = (q1.w * q2.w) - (q1.x * q2.x) - (q1.y * q2.y) - (q1.z * q2.z);
    return qr;
}

void main() {
    //vUv = uv;

    vec3 translation = vec3(0.0);
    vec4 rotation = vec4(0.0);
    vec3 scale = vec3(1.0);

    float randomVal = aOptions.x;
    float maxLength = aOptions.z;
    float x1 = aConnectionPoints.x;
    float x2 = aConnectionPoints.z;
    float y1 = aConnectionPoints.y;
    float y2 = aConnectionPoints.w;

    float x = (x1 + x2) / 2.0;
    float y = (y1 + y2) / 2.0;

    float scalex = distance(vec2(x1, y1), vec2(x2, y2));
    float scaley = 1.0;
    float selfRotation = atan(y2 - y1, x2 - x1);// + radians(90.0);
    // float lineLength = mix(50.0, maxLength, randomVal);
    // float inRange =  1.0 - step(lineLength, scalex);

    vec3 pos = position;

    translation.x += x;
    translation.y += y;
    scale.x = scalex * uScale;
    rotation = quaternion( vec3(0.0, 0.0, 1.0), selfRotation );

    pos = transform( pos, translation, rotation, scale );

    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 );

    vVisible = aOptions.y;
    vAlpha = aOptions.w;

    gl_Position *= vVisible;
}
