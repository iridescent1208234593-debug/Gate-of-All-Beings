shader_type spatial;
render_mode unshaded,cull_disabled,depth_prepass_alpha;
uniform sampler2D atlas : source_color,filter_linear;
uniform sampler2D mask_atlas : filter_nearest;
uniform sampler2D palette_tex : source_color,filter_nearest;
uniform float palette_row;
void vertex(){
 MODELVIEW_MATRIX=VIEW_MATRIX*mat4(INV_VIEW_MATRIX[0],INV_VIEW_MATRIX[1],INV_VIEW_MATRIX[2],MODEL_MATRIX[3]);
}
void fragment(){
 vec4 source=texture(atlas,UV);
 int part=int(round(texture(mask_atlas,UV+vec2(0.0,0.5)).r*255.0/8.0));
 vec4 tint=texture(palette_tex,vec2((float(part)+0.5)/32.0,palette_row));
 float fill=(part>=18 && part<=24) ? 1.0 : smoothstep(0.18,0.65,max(source.r,max(source.g,source.b)));
 ALBEDO=mix(source.rgb,tint.rgb,tint.a*fill);
 ALPHA=source.a;
 ALPHA_SCISSOR_THRESHOLD=0.02;
}
