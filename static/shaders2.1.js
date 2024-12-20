// we all love shaders eh?
console.log("shaders loaded.");

const fsSource = `
varying lowp vec4 vColor;

void main() {
	gl_FragColor = vColor;
}
`
const debugVS = `
uniform vec4 uColor;
uniform vec3 uPos1;
uniform vec3 uPos2;
varying lowp vec4 vColor;
attribute float aID;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
	vColor = uColor;
	vec4 pos1 = vec4(uPos1.xyz, 1.0);
	vec4 pos2 = vec4(uPos2.xyz, 1.0);
	if (aID == 0.0) {
		gl_Position = uProjectionMatrix * uModelViewMatrix * pos1;
	} else {
		gl_Position = uProjectionMatrix * uModelViewMatrix * pos2;
	}
}
`
const lightVS_t4 = `
attribute vec4 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTexCoord1;
attribute vec2 aTexCoord2;
attribute vec2 aTexCoord3;
attribute vec2 aTexCoord4;
attribute vec4 aMixFactor;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPos;
uniform mat3 uLightingInfo; // 1st row is light direction, 2nd is color, 3rd is ambient light

varying highp vec2 texCoord1;
varying highp vec2 texCoord2;
varying highp vec2 texCoord3;
varying highp vec2 texCoord4;
varying highp vec4 mixFactor;
varying vec3 vPosition;
varying highp vec3 vLighting;

void main() {
	gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
	texCoord1 = aTexCoord1;
	texCoord2 = aTexCoord2;
	texCoord3 = aTexCoord3;
	texCoord4 = aTexCoord4;
	mixFactor = aMixFactor;
	vPosition = (uModelViewMatrix * aVertexPosition).xyz;
	highp float directional = clamp(dot(aVertexNormal, uLightingInfo[0]), 0.0, 1.5);
	vLighting = uLightingInfo[2] + (uLightingInfo[1] * directional * 0.65);
	float as = dot(aVertexNormal.xyz, vec3(1.0,0.0,0.0));
	// vLighting = vec3(as, as, as);
	gl_PointSize = 100.0;
}
`;
const lightVS = `
attribute vec4 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPos;
uniform mat3 uLightingInfo; // 1st row is light direction, 2nd is color, 3rd is ambient light

varying highp vec2 texCoord;
varying mediump vec3 vPosition;
varying highp vec3 vLighting;

void main() {
	gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
	texCoord = aTexCoord;
	vPosition = (uModelViewMatrix * aVertexPosition).xyz;
	highp float directional = max(dot(aVertexNormal, uLightingInfo[0]), 0.0);
	vLighting = uLightingInfo[2] + (uLightingInfo[1] * directional * 0.65);
	gl_PointSize = 100.0;
}
`;
const lightColorVS = `
attribute vec4 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec4 aColor;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPos;
uniform mat3 uLightingInfo; // 1st row is light direction, 2nd is color, 3rd is ambient light
uniform vec4 uFogColor;
uniform float uFogAmount;

varying lowp vec4 vColor;

void main() {
	gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;

	mediump float fogAmount = length(uModelViewMatrix * aVertexPosition) * 0.05 - 0.3;
	highp vec4 transformedNormal = vec4(aVertexNormal, 1.0);
	highp float directional = max(dot(transformedNormal.xyz, uLightingInfo[0]), 0.0);
	highp vec3 vLighting = uLightingInfo[2] + (uLightingInfo[1] * directional * 0.65);
	vColor = vec4(aColor.rgb * vLighting, aColor.a); // I really should mix it in the frag shader, but I'm trying to use fsSource so w h a t e v e r
	vColor = mix(vColor, uFogColor, clamp(fogAmount * uFogAmount, 0.0, 1.0));
}
`;
const lightColorTransfVS = `
attribute vec4 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec4 aColor;
attribute float aYRot; // rotate around (0,0,0)
attribute float aXRot;
attribute vec3 aTranslation; // translate da point

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPos;
uniform vec4 uFogColor;
uniform float uFogAmount;
uniform mat3 uLightingInfo; // 1st row is light direction, 2nd is color, 3rd is ambient light

varying lowp vec4 vColor;

vec4 rotateY(vec4 pos, float rads) {
	return vec4(pos[2] * sin(rads) + pos[0] * cos(rads),
		pos[1],
		pos[2] * cos(rads) - pos[0] * sin(rads), 1.0);
}

vec4 rotateX(vec4 pos, float rads) {
	return vec4(
		pos[0],
		pos[1] * cos(rads) - pos[2] * sin(rads),
		pos[1] * sin(rads) + pos[2] * cos(rads), 1.0
	);
}

void main() {
	vec4 transformed = rotateX(aVertexPosition, aXRot);
	transformed = rotateY(transformed, aYRot);
	transformed.xyz += aTranslation;
	gl_Position = uProjectionMatrix * uModelViewMatrix * transformed;

	mediump float fogAmount = length(uModelViewMatrix * transformed) * 0.05 - 0.3;
	highp vec4 transformedNormal = rotateY(vec4(aVertexNormal.xyz, 1.0), aYRot);
	transformedNormal = rotateX(transformedNormal, aXRot);
	highp float directional = max(dot(transformedNormal.xyz, uLightingInfo[0]), 0.0);
	highp vec3 vLighting = uLightingInfo[2] + (uLightingInfo[1] * directional * 0.65);
	vColor = vec4(aColor.rgb * vLighting, aColor.a); // I really should mix it in the frag shader, but I'm trying to use fsSource so w h a t e v e r
	vColor = mix(vColor, uFogColor, clamp(fogAmount * uFogAmount, 0.0, 1.0));
}
`;
const textureFS = `
precision mediump float;
varying highp vec2 texCoord;
varying highp vec3 vLighting;
uniform sampler2D uSampler;
uniform float uFogAmount;
uniform vec4 uFogColor;
varying mediump vec3 vPosition;
uniform float uAlphaAdj;

void main() {
	lowp vec4 col = texture2D(uSampler, texCoord);
	if (col.a < uAlphaAdj) {discard;}
	col = vec4(col.rgb * vLighting, col.a);
	float fogAmount = length(vPosition) * 0.05 - 0.3;
	col = mix(col, uFogColor, clamp(fogAmount * uFogAmount, 0.0, 1.0));
	gl_FragColor = col;
	if (col.a == 0.0) {
		discard;
	}
}
`

const textureFS_t4 = `
precision mediump float;
varying highp vec2 texCoord1;
varying highp vec2 texCoord2;
varying highp vec2 texCoord3;
varying highp vec2 texCoord4;
varying highp vec4 mixFactor;
varying highp vec3 vLighting;
uniform sampler2D uSampler1;
uniform sampler2D uSampler2;
uniform sampler2D uSampler3;
uniform sampler2D uSampler4;
uniform vec4 uFogColor;
uniform float uFogAmount;
varying vec3 vPosition;

void main() {
	float fogAmount = length(vPosition) * 0.05 - 0.3;
	highp vec4 mf = mixFactor;
	float sum = mf.x + mf.y + mf.z + mf.w;
	mf.x /= sum; mf.y /= sum; mf.z /= sum; mf.w /= sum;
	//if (gl_FragCoord.z < 0.0) {discard;}
	lowp vec4 col = vec4(texture2D(uSampler1, texCoord1) * mf.x + texture2D(uSampler2, texCoord2) * mf.y +
		texture2D(uSampler3, texCoord3) * mf.z + texture2D(uSampler4, texCoord4) * mf.w);
	col = vec4(col.rgb * vLighting, col.a);
	col = mix(col, uFogColor, clamp(fogAmount * uFogAmount, 0.0, 1.0));
	if (col.a == 0.0) {
		discard;
	} else {
		gl_FragColor = col;
	}
}
`
// 0.529, 0.808, 0.921, 1.0
const textureBillboardVS = /*not actually a texture*/`
attribute vec4 aBillboardPos;
attribute vec4 aColor;

uniform mat4 uProjectionMatrix;
uniform mat4 ubModelViewMatrix;

varying lowp vec4 vColor;
varying mediump float fogAmount;
varying lowp vec4 fogColor;
varying highp vec3 vLighting;

void main() {
	gl_Position = uProjectionMatrix * ubModelViewMatrix * aBillboardPos;
	vColor = aColor;
	fogAmount = 0.0;
	fogColor = vec4(0.0, 0.0, 0.0, 0.0);
	vLighting = vec3(1.0, 1.0, 1.0);
}
`;

const particleVS = `
attribute vec3 aParticleVelocity;
attribute vec3 aParticleCenterOffset;
attribute vec2 aParticleCorner;
attribute vec2 aParticleTexCoords;
attribute float aLifetime;

uniform vec3 uParticleEmitter;
uniform float uTime;
uniform float uStartTime;
uniform int uNumCycles;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying highp vec2 texCoord;
varying lowp float size;
varying vec3 vPosition;

void main() {
	if (
		(uTime - uStartTime) < aLifetime - mod(uStartTime, aLifetime)
		|| int((uTime - uStartTime) / aLifetime) > uNumCycles
	) {
		gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
		texCoord = vec2(1.0, 1.0);
		size = 0.0;
		return;
	}
	float time = mod(uTime, aLifetime);
	vec4 position = vec4(
		uParticleEmitter + aParticleCenterOffset + (time * aParticleVelocity), 1.0
	);
	vec3 rightVec = vec3(
      uModelViewMatrix[0].x, uModelViewMatrix[1].x, uModelViewMatrix[2].x
    );
	vec3 upVec = vec3(uModelViewMatrix[0].y, uModelViewMatrix[1].y, uModelViewMatrix[2].y);
	position.xyz += (rightVec * aParticleCorner.x) +
					(upVec * aParticleCorner.y);
	gl_Position = uProjectionMatrix * uModelViewMatrix * position;
	texCoord = aParticleTexCoords;
	size = (aLifetime - time) / aLifetime;
	vPosition = (uModelViewMatrix * position).xyz;
}
`;//uModelViewMatrix[0].y, uModelViewMatrix[1].y, uModelViewMatrix[2].y
const realBillboardVS = /*lmao*/`
attribute vec3 aCenterOffset;
attribute vec3 aCorner;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPos;
uniform mat3 uLightingInfo;

varying vec2 texCoord;
varying vec3 vPosition;
varying vec3 vLighting;

void main() {
	vec4 position = vec4(aCenterOffset, 1.0);
	vec3 right = vec3(uModelViewMatrix[0].x, uModelViewMatrix[1].x, uModelViewMatrix[2].x);
	vec3 up = vec3(uModelViewMatrix[0].y, uModelViewMatrix[1].y, uModelViewMatrix[2].y);
	position.xyz += (right * aCorner.x) + (up * aCorner.y);
	vPosition = (uModelViewMatrix * position).xyz;
	texCoord = aTexCoord;
	vLighting = uLightingInfo[2] + (uLightingInfo[1] * 0.5 * 0.65);
	gl_Position = uProjectionMatrix * uModelViewMatrix * position;
}
`;
const particleFS = `
precision mediump float;
varying highp vec2 texCoord;
varying highp vec3 vLighting;
varying vec3 vPosition;
uniform sampler2D uSampler;
uniform float uFogAmount;
uniform vec4 uFogColor;
varying lowp float size;

void main() {
	if (gl_FragCoord.z < 0.0) {discard;}
	lowp vec4 col = texture2D(uSampler, texCoord);
	col.a *= size;
	float fogAmount = length(vPosition) * 0.05 - 0.3;
	col = mix(col, uFogColor, clamp(fogAmount * uFogAmount, 0.0, 1.0));
	if (col.a == 0.0) {
		discard;
	} else {
		gl_FragColor = col;
	}
}
`
