shader_type spatial;
render_mode unshaded;

varying vec2 ground;

void vertex() {
	ground = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	float bank = smoothstep(0.0, 0.13, min(UV.x, 1.0 - UV.x));
	float ripple = sin(ground.y * 13.0 + TIME * 1.9 + sin(ground.x * 5.0));
	float highlight = smoothstep(0.94, 1.0, ripple) * smoothstep(0.15, 0.85, sin(ground.x * 5.7 + ground.y));
	ALBEDO = mix(vec3(0.30, 0.56, 0.48), vec3(0.13, 0.39, 0.43), bank) + vec3(highlight * 0.13);
}
