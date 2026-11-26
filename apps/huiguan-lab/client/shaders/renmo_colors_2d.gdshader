shader_type canvas_item;
uniform sampler2D palette_tex : filter_nearest;
varying vec4 draw_color;
void vertex(){draw_color=COLOR;}
void fragment(){
 vec4 source=texture(TEXTURE,UV);
 if(abs(draw_color.g-0.123)<0.002 && abs(draw_color.b-0.456)<0.002){
  int part=int(round(texture(TEXTURE,UV+vec2(0.0,0.5)).r*255.0/8.0));
  vec4 tint=texture(palette_tex,vec2((float(part)+0.5)/32.0,draw_color.r));
  float fill=(part>=18 && part<=24) ? 1.0 : smoothstep(0.18,0.65,max(source.r,max(source.g,source.b)));
  COLOR=vec4(mix(source.rgb,tint.rgb,tint.a*fill),source.a);
 }else{COLOR=source*draw_color;}
}
