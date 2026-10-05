var LXHGate=(()=>{var oo=Object.defineProperty;var pu=Object.getOwnPropertyDescriptor;var mu=Object.getOwnPropertyNames;var gu=Object.prototype.hasOwnProperty;var _u=(i,t)=>{for(var e in t)oo(i,e,{get:t[e],enumerable:!0})},xu=(i,t,e,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of mu(t))!gu.call(i,s)&&s!==e&&oo(i,s,{get:()=>t[s],enumerable:!(n=pu(t,s))||n.enumerable});return i};var yu=i=>xu(oo({},"__esModule",{value:!0}),i);var v0={};_u(v0,{DURATION:()=>su,GATE_FULLY_OPEN_AT:()=>Jl,GATE_OPEN_AT:()=>Zl,LXHGate:()=>au,THEMES:()=>io,createScene:()=>ru,hasWebGL:()=>$l});var Dc=0,jo=1,Uc=2;var zs=1,Fc=2,qi=3,Ln=0,De=1,Ae=2,_n=0,ci=1,Qo=2,tl=3,el=4,Oc=5;var Wn=100,Bc=101,zc=102,kc=103,Vc=104,Gc=200,Hc=201,Wc=202,Xc=203,br=204,Tr=205,qc=206,Yc=207,Zc=208,Jc=209,$c=210,Kc=211,jc=212,Qc=213,th=214,Er=0,Ar=1,wr=2,hi=3,Cr=4,Rr=5,Lr=6,Pr=7,oa=0,eh=1,nh=2,Ze=0,nl=1,il=2,sl=3,rl=4,al=5,ol=6,ll=7;var cl=300,Kn=301,fi=302,la=303,ca=304,ks=306,Ni=1e3,Ke=1001,Di=1002,Se=1003,ih=1004;var Vs=1005;var Ee=1006,ha=1007;var jn=1008;var Oe=1009,hl=1010,ul=1011,Yi=1012,ua=1013,rn=1014,an=1015,xn=1016,da=1017,fa=1018,Zi=1020,dl=35902,fl=35899,pl=1021,ml=1022,je=1023,fn=1026,Qn=1027,gl=1028,pa=1029,ti=1030,ma=1031;var ga=1033,Gs=33776,Hs=33777,Ws=33778,Xs=33779,_a=35840,xa=35841,ya=35842,va=35843,Ma=36196,Sa=37492,ba=37496,Ta=37488,Ea=37489,qs=37490,Aa=37491,wa=37808,Ca=37809,Ra=37810,La=37811,Pa=37812,Ia=37813,Na=37814,Da=37815,Ua=37816,Fa=37817,Oa=37818,Ba=37819,za=37820,ka=37821,Va=36492,Ga=36494,Ha=36495,Wa=36283,Xa=36284,Ys=36285,qa=36286;var ls=2300,Ir=2301,Sr=2302,Fo=2303,Oo=2400,Bo=2401,zo=2402;var sh=3200;var Ya=0,rh=1,Nn="",Te="srgb",cs="srgb-linear",hs="linear",ie="srgb";var oi=7680;var ko=519,ah=512,oh=513,lh=514,Za=515,ch=516,hh=517,Ja=518,uh=519,Vo=35044;var _l="300 es",nn=2e3,Ui=2001;function vu(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Mu(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function us(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function dh(){let i=us("canvas");return i.style.display="block",i}var ac={},Fi=null;function xl(...i){let t="THREE."+i.shift();Fi?Fi("log",t,...i):console.log(t,...i)}function fh(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Wt(...i){i=fh(i);let t="THREE."+i.shift();if(Fi)Fi("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function qt(...i){i=fh(i);let t="THREE."+i.shift();if(Fi)Fi("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function li(...i){let t=i.join(" ");t in ac||(ac[t]=!0,Wt(...i))}function ph(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var mh={[Er]:Ar,[wr]:Lr,[Cr]:Pr,[hi]:Rr,[Ar]:Er,[Lr]:wr,[Pr]:Cr,[Rr]:hi},pn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,t);t.target=null}}},Ce=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var lo=Math.PI/180,Nr=180/Math.PI;function Ji(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ce[i&255]+Ce[i>>8&255]+Ce[i>>16&255]+Ce[i>>24&255]+"-"+Ce[t&255]+Ce[t>>8&255]+"-"+Ce[t>>16&15|64]+Ce[t>>24&255]+"-"+Ce[e&63|128]+Ce[e>>8&255]+"-"+Ce[e>>16&255]+Ce[e>>24&255]+Ce[n&255]+Ce[n>>8&255]+Ce[n>>16&255]+Ce[n>>24&255]).toLowerCase()}function te(i,t,e){return Math.max(t,Math.min(e,i))}function Su(i,t){return(i%t+t)%t}function co(i,t,e){return(1-e)*i+e*t}function ts(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Ue(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Tl=class Tl{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=te(this.x,t.x,e.x),this.y=te(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=te(this.x,t,e),this.y=te(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(te(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(te(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,a=this.y-t.y;return this.x=r*n-a*s+t.x,this.y=r*s+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Tl.prototype.isVector2=!0;var yt=Tl,mn=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,a,o){let c=n[s+0],l=n[s+1],u=n[s+2],d=n[s+3],h=r[a+0],p=r[a+1],x=r[a+2],S=r[a+3];if(d!==S||c!==h||l!==p||u!==x){let g=c*h+l*p+u*x+d*S;g<0&&(h=-h,p=-p,x=-x,S=-S,g=-g);let f=1-o;if(g<.9995){let L=Math.acos(g),w=Math.sin(L);f=Math.sin(f*L)/w,o=Math.sin(o*L)/w,c=c*f+h*o,l=l*f+p*o,u=u*f+x*o,d=d*f+S*o}else{c=c*f+h*o,l=l*f+p*o,u=u*f+x*o,d=d*f+S*o;let L=1/Math.sqrt(c*c+l*l+u*u+d*d);c*=L,l*=L,u*=L,d*=L}}t[e]=c,t[e+1]=l,t[e+2]=u,t[e+3]=d}static multiplyQuaternionsFlat(t,e,n,s,r,a){let o=n[s],c=n[s+1],l=n[s+2],u=n[s+3],d=r[a],h=r[a+1],p=r[a+2],x=r[a+3];return t[e]=o*x+u*d+c*p-l*h,t[e+1]=c*x+u*h+l*d-o*p,t[e+2]=l*x+u*p+o*h-c*d,t[e+3]=u*x-o*d-c*h-l*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,a=t._order,o=Math.cos,c=Math.sin,l=o(n/2),u=o(s/2),d=o(r/2),h=c(n/2),p=c(s/2),x=c(r/2);switch(a){case"XYZ":this._x=h*u*d+l*p*x,this._y=l*p*d-h*u*x,this._z=l*u*x+h*p*d,this._w=l*u*d-h*p*x;break;case"YXZ":this._x=h*u*d+l*p*x,this._y=l*p*d-h*u*x,this._z=l*u*x-h*p*d,this._w=l*u*d+h*p*x;break;case"ZXY":this._x=h*u*d-l*p*x,this._y=l*p*d+h*u*x,this._z=l*u*x+h*p*d,this._w=l*u*d-h*p*x;break;case"ZYX":this._x=h*u*d-l*p*x,this._y=l*p*d+h*u*x,this._z=l*u*x-h*p*d,this._w=l*u*d+h*p*x;break;case"YZX":this._x=h*u*d+l*p*x,this._y=l*p*d+h*u*x,this._z=l*u*x-h*p*d,this._w=l*u*d-h*p*x;break;case"XZY":this._x=h*u*d-l*p*x,this._y=l*p*d-h*u*x,this._z=l*u*x+h*p*d,this._w=l*u*d+h*p*x;break;default:Wt("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],a=e[1],o=e[5],c=e[9],l=e[2],u=e[6],d=e[10],h=n+o+d;if(h>0){let p=.5/Math.sqrt(h+1);this._w=.25/p,this._x=(u-c)*p,this._y=(r-l)*p,this._z=(a-s)*p}else if(n>o&&n>d){let p=2*Math.sqrt(1+n-o-d);this._w=(u-c)/p,this._x=.25*p,this._y=(s+a)/p,this._z=(r+l)/p}else if(o>d){let p=2*Math.sqrt(1+o-n-d);this._w=(r-l)/p,this._x=(s+a)/p,this._y=.25*p,this._z=(c+u)/p}else{let p=2*Math.sqrt(1+d-n-o);this._w=(a-s)/p,this._x=(r+l)/p,this._y=(c+u)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(te(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=e._x,c=e._y,l=e._z,u=e._w;return this._x=n*u+a*o+s*l-r*c,this._y=s*u+a*c+r*o-n*l,this._z=r*u+a*l+n*c-s*o,this._w=a*u-n*o-s*c-r*l,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,a=t._w,o=this.dot(t);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let c=1-e;if(o<.9995){let l=Math.acos(o),u=Math.sin(l);c=Math.sin(c*l)/u,e=Math.sin(e*l)/u,this._x=this._x*c+n*e,this._y=this._y*c+s*e,this._z=this._z*c+r*e,this._w=this._w*c+a*e,this._onChangeCallback()}else this._x=this._x*c+n*e,this._y=this._y*c+s*e,this._z=this._z*c+r*e,this._w=this._w*c+a*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},El=class El{constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(oc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(oc.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,a=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,a=t.y,o=t.z,c=t.w,l=2*(a*s-o*n),u=2*(o*e-r*s),d=2*(r*n-a*e);return this.x=e+c*l+a*d-o*u,this.y=n+c*u+o*l-r*d,this.z=s+c*d+r*u-a*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=te(this.x,t.x,e.x),this.y=te(this.y,t.y,e.y),this.z=te(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=te(this.x,t,e),this.y=te(this.y,t,e),this.z=te(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(te(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,a=e.x,o=e.y,c=e.z;return this.x=s*c-r*o,this.y=r*a-n*c,this.z=n*o-s*a,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return ho.copy(this).projectOnVector(t),this.sub(ho)}reflect(t){return this.sub(ho.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(te(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};El.prototype.isVector3=!0;var W=El,ho=new W,oc=new mn,Al=class Al{constructor(t,e,n,s,r,a,o,c,l){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,c,l)}set(t,e,n,s,r,a,o,c,l){let u=this.elements;return u[0]=t,u[1]=s,u[2]=o,u[3]=e,u[4]=r,u[5]=c,u[6]=n,u[7]=a,u[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[3],c=n[6],l=n[1],u=n[4],d=n[7],h=n[2],p=n[5],x=n[8],S=s[0],g=s[3],f=s[6],L=s[1],w=s[4],v=s[7],R=s[2],A=s[5],N=s[8];return r[0]=a*S+o*L+c*R,r[3]=a*g+o*w+c*A,r[6]=a*f+o*v+c*N,r[1]=l*S+u*L+d*R,r[4]=l*g+u*w+d*A,r[7]=l*f+u*v+d*N,r[2]=h*S+p*L+x*R,r[5]=h*g+p*w+x*A,r[8]=h*f+p*v+x*N,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],u=t[8];return e*a*u-e*o*l-n*r*u+n*o*c+s*r*l-s*a*c}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],u=t[8],d=u*a-o*l,h=o*c-u*r,p=l*r-a*c,x=e*d+n*h+s*p;if(x===0)return this.set(0,0,0,0,0,0,0,0,0);let S=1/x;return t[0]=d*S,t[1]=(s*l-u*n)*S,t[2]=(o*n-s*a)*S,t[3]=h*S,t[4]=(u*e-s*c)*S,t[5]=(s*r-o*e)*S,t[6]=p*S,t[7]=(n*c-l*e)*S,t[8]=(a*e-n*r)*S,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,a,o){let c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*a+l*o)+a+t,-s*l,s*c,-s*(-l*a+c*o)+o+e,0,0,1),this}scale(t,e){return li("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(uo.makeScale(t,e)),this}rotate(t){return li("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(uo.makeRotation(-t)),this}translate(t,e){return li("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(uo.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}};Al.prototype.isMatrix3=!0;var Gt=Al,uo=new Gt,lc=new Gt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),cc=new Gt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function bu(){let i={enabled:!0,workingColorSpace:cs,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===ie&&(s.r=Rn(s.r),s.g=Rn(s.g),s.b=Rn(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===ie&&(s.r=Ii(s.r),s.g=Ii(s.g),s.b=Ii(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Nn?hs:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return li("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return li("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[cs]:{primaries:t,whitePoint:n,transfer:hs,toXYZ:lc,fromXYZ:cc,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Te},outputColorSpaceConfig:{drawingBufferColorSpace:Te}},[Te]:{primaries:t,whitePoint:n,transfer:ie,toXYZ:lc,fromXYZ:cc,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Te}}}),i}var ee=bu();function Rn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Ii(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var vi,Dr=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement=="undefined")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{vi===void 0&&(vi=us("canvas")),vi.width=t.width,vi.height=t.height;let s=vi.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=vi}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement!="undefined"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&t instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&t instanceof ImageBitmap){let e=us("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Rn(r[a]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Rn(e[n]/255)*255):e[n]=Rn(e[n]);return{data:e,width:t.width,height:t.height}}else return Wt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Tu=0,Oi=class{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Tu++}),this.uuid=Ji(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement!="undefined"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame!="undefined"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(fo(s[a].image)):r.push(fo(s[a]))}else r=fo(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function fo(i){return typeof HTMLImageElement!="undefined"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&i instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&i instanceof ImageBitmap?Dr.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Wt("Texture: Unable to serialize Texture."),{})}var Eu=0,po=new W,Ie=class i extends pn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=Ke,s=Ke,r=Ee,a=jn,o=je,c=Oe,l=i.DEFAULT_ANISOTROPY,u=Nn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Eu++}),this.uuid=Ji(),this.name="",this.source=new Oi(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new yt(0,0),this.repeat=new yt(1,1),this.center=new yt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Gt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(po).x}get height(){return this.source.getSize(po).y}get depth(){return this.source.getSize(po).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Wt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Wt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==cl)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Ni:t.x=t.x-Math.floor(t.x);break;case Ke:t.x=t.x<0?0:1;break;case Di:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Ni:t.y=t.y-Math.floor(t.y);break;case Ke:t.y=t.y<0?0:1;break;case Di:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};Ie.DEFAULT_IMAGE=null;Ie.DEFAULT_MAPPING=cl;Ie.DEFAULT_ANISOTROPY=1;var wl=class wl{constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*e+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*e+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*e+a[7]*n+a[11]*s+a[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,c=t.elements,l=c[0],u=c[4],d=c[8],h=c[1],p=c[5],x=c[9],S=c[2],g=c[6],f=c[10];if(Math.abs(u-h)<.01&&Math.abs(d-S)<.01&&Math.abs(x-g)<.01){if(Math.abs(u+h)<.1&&Math.abs(d+S)<.1&&Math.abs(x+g)<.1&&Math.abs(l+p+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let w=(l+1)/2,v=(p+1)/2,R=(f+1)/2,A=(u+h)/4,N=(d+S)/4,y=(x+g)/4;return w>v&&w>R?w<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(w),s=A/n,r=N/n):v>R?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=A/s,r=y/s):R<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(R),n=N/r,s=y/r),this.set(n,s,r,e),this}let L=Math.sqrt((g-x)*(g-x)+(d-S)*(d-S)+(h-u)*(h-u));return Math.abs(L)<.001&&(L=1),this.x=(g-x)/L,this.y=(d-S)/L,this.z=(h-u)/L,this.w=Math.acos((l+p+f-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=te(this.x,t.x,e.x),this.y=te(this.y,t.y,e.y),this.z=te(this.z,t.z,e.z),this.w=te(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=te(this.x,t,e),this.y=te(this.y,t,e),this.z=te(this.z,t,e),this.w=te(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(te(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};wl.prototype.isVector4=!0;var de=wl,Ur=class extends pn{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ee,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new de(0,0,t,e),this.scissorTest=!1,this.viewport=new de(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new Ie(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Ee,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new Oi(s)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},He=class extends Ur{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},ds=class extends Ie{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Se,this.minFilter=Se,this.wrapR=Ke,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Fr=class extends Ie{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Se,this.minFilter=Se,this.wrapR=Ke,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var aa=class aa{constructor(t,e,n,s,r,a,o,c,l,u,d,h,p,x,S,g){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,a,o,c,l,u,d,h,p,x,S,g)}set(t,e,n,s,r,a,o,c,l,u,d,h,p,x,S,g){let f=this.elements;return f[0]=t,f[4]=e,f[8]=n,f[12]=s,f[1]=r,f[5]=a,f[9]=o,f[13]=c,f[2]=l,f[6]=u,f[10]=d,f[14]=h,f[3]=p,f[7]=x,f[11]=S,f[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new aa().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/Mi.setFromMatrixColumn(t,0).length(),r=1/Mi.setFromMatrixColumn(t,1).length(),a=1/Mi.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,a=Math.cos(n),o=Math.sin(n),c=Math.cos(s),l=Math.sin(s),u=Math.cos(r),d=Math.sin(r);if(t.order==="XYZ"){let h=a*u,p=a*d,x=o*u,S=o*d;e[0]=c*u,e[4]=-c*d,e[8]=l,e[1]=p+x*l,e[5]=h-S*l,e[9]=-o*c,e[2]=S-h*l,e[6]=x+p*l,e[10]=a*c}else if(t.order==="YXZ"){let h=c*u,p=c*d,x=l*u,S=l*d;e[0]=h+S*o,e[4]=x*o-p,e[8]=a*l,e[1]=a*d,e[5]=a*u,e[9]=-o,e[2]=p*o-x,e[6]=S+h*o,e[10]=a*c}else if(t.order==="ZXY"){let h=c*u,p=c*d,x=l*u,S=l*d;e[0]=h-S*o,e[4]=-a*d,e[8]=x+p*o,e[1]=p+x*o,e[5]=a*u,e[9]=S-h*o,e[2]=-a*l,e[6]=o,e[10]=a*c}else if(t.order==="ZYX"){let h=a*u,p=a*d,x=o*u,S=o*d;e[0]=c*u,e[4]=x*l-p,e[8]=h*l+S,e[1]=c*d,e[5]=S*l+h,e[9]=p*l-x,e[2]=-l,e[6]=o*c,e[10]=a*c}else if(t.order==="YZX"){let h=a*c,p=a*l,x=o*c,S=o*l;e[0]=c*u,e[4]=S-h*d,e[8]=x*d+p,e[1]=d,e[5]=a*u,e[9]=-o*u,e[2]=-l*u,e[6]=p*d+x,e[10]=h-S*d}else if(t.order==="XZY"){let h=a*c,p=a*l,x=o*c,S=o*l;e[0]=c*u,e[4]=-d,e[8]=l*u,e[1]=h*d+S,e[5]=a*u,e[9]=p*d-x,e[2]=x*d-p,e[6]=o*u,e[10]=S*d+h}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Au,t,wu)}lookAt(t,e,n){let s=this.elements;return ze.subVectors(t,e),ze.lengthSq()===0&&(ze.z=1),ze.normalize(),On.crossVectors(n,ze),On.lengthSq()===0&&(Math.abs(n.z)===1?ze.x+=1e-4:ze.z+=1e-4,ze.normalize(),On.crossVectors(n,ze)),On.normalize(),tr.crossVectors(ze,On),s[0]=On.x,s[4]=tr.x,s[8]=ze.x,s[1]=On.y,s[5]=tr.y,s[9]=ze.y,s[2]=On.z,s[6]=tr.z,s[10]=ze.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,a=n[0],o=n[4],c=n[8],l=n[12],u=n[1],d=n[5],h=n[9],p=n[13],x=n[2],S=n[6],g=n[10],f=n[14],L=n[3],w=n[7],v=n[11],R=n[15],A=s[0],N=s[4],y=s[8],C=s[12],z=s[1],O=s[5],k=s[9],lt=s[13],ot=s[2],J=s[6],it=s[10],Y=s[14],V=s[3],pt=s[7],mt=s[11],vt=s[15];return r[0]=a*A+o*z+c*ot+l*V,r[4]=a*N+o*O+c*J+l*pt,r[8]=a*y+o*k+c*it+l*mt,r[12]=a*C+o*lt+c*Y+l*vt,r[1]=u*A+d*z+h*ot+p*V,r[5]=u*N+d*O+h*J+p*pt,r[9]=u*y+d*k+h*it+p*mt,r[13]=u*C+d*lt+h*Y+p*vt,r[2]=x*A+S*z+g*ot+f*V,r[6]=x*N+S*O+g*J+f*pt,r[10]=x*y+S*k+g*it+f*mt,r[14]=x*C+S*lt+g*Y+f*vt,r[3]=L*A+w*z+v*ot+R*V,r[7]=L*N+w*O+v*J+R*pt,r[11]=L*y+w*k+v*it+R*mt,r[15]=L*C+w*lt+v*Y+R*vt,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],a=t[1],o=t[5],c=t[9],l=t[13],u=t[2],d=t[6],h=t[10],p=t[14],x=t[3],S=t[7],g=t[11],f=t[15],L=c*p-l*h,w=o*p-l*d,v=o*h-c*d,R=a*p-l*u,A=a*h-c*u,N=a*d-o*u;return e*(S*L-g*w+f*v)-n*(x*L-g*R+f*A)+s*(x*w-S*R+f*N)-r*(x*v-S*A+g*N)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],a=t[5],o=t[9],c=t[2],l=t[6],u=t[10];return e*(a*u-o*l)-n*(r*u-o*c)+s*(r*l-a*c)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],a=t[4],o=t[5],c=t[6],l=t[7],u=t[8],d=t[9],h=t[10],p=t[11],x=t[12],S=t[13],g=t[14],f=t[15],L=e*o-n*a,w=e*c-s*a,v=e*l-r*a,R=n*c-s*o,A=n*l-r*o,N=s*l-r*c,y=u*S-d*x,C=u*g-h*x,z=u*f-p*x,O=d*g-h*S,k=d*f-p*S,lt=h*f-p*g,ot=L*lt-w*k+v*O+R*z-A*C+N*y;if(ot===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let J=1/ot;return t[0]=(o*lt-c*k+l*O)*J,t[1]=(s*k-n*lt-r*O)*J,t[2]=(S*N-g*A+f*R)*J,t[3]=(h*A-d*N-p*R)*J,t[4]=(c*z-a*lt-l*C)*J,t[5]=(e*lt-s*z+r*C)*J,t[6]=(g*v-x*N-f*w)*J,t[7]=(u*N-h*v+p*w)*J,t[8]=(a*k-o*z+l*y)*J,t[9]=(n*z-e*k-r*y)*J,t[10]=(x*A-S*v+f*L)*J,t[11]=(d*v-u*A-p*L)*J,t[12]=(o*C-a*O-c*y)*J,t[13]=(e*O-n*C+s*y)*J,t[14]=(S*w-x*R-g*L)*J,t[15]=(u*R-d*w+h*L)*J,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,a=t.x,o=t.y,c=t.z,l=r*a,u=r*o;return this.set(l*a+n,l*o-s*c,l*c+s*o,0,l*o+s*c,u*o+n,u*c-s*a,0,l*c-s*o,u*c+s*a,r*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,a){return this.set(1,n,r,0,t,1,a,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,a=e._y,o=e._z,c=e._w,l=r+r,u=a+a,d=o+o,h=r*l,p=r*u,x=r*d,S=a*u,g=a*d,f=o*d,L=c*l,w=c*u,v=c*d,R=n.x,A=n.y,N=n.z;return s[0]=(1-(S+f))*R,s[1]=(p+v)*R,s[2]=(x-w)*R,s[3]=0,s[4]=(p-v)*A,s[5]=(1-(h+f))*A,s[6]=(g+L)*A,s[7]=0,s[8]=(x+w)*N,s[9]=(g-L)*N,s[10]=(1-(h+S))*N,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let a=Mi.set(s[0],s[1],s[2]).length(),o=Mi.set(s[4],s[5],s[6]).length(),c=Mi.set(s[8],s[9],s[10]).length();r<0&&(a=-a),Qe.copy(this);let l=1/a,u=1/o,d=1/c;return Qe.elements[0]*=l,Qe.elements[1]*=l,Qe.elements[2]*=l,Qe.elements[4]*=u,Qe.elements[5]*=u,Qe.elements[6]*=u,Qe.elements[8]*=d,Qe.elements[9]*=d,Qe.elements[10]*=d,e.setFromRotationMatrix(Qe),n.x=a,n.y=o,n.z=c,this}makePerspective(t,e,n,s,r,a,o=nn,c=!1){let l=this.elements,u=2*r/(e-t),d=2*r/(n-s),h=(e+t)/(e-t),p=(n+s)/(n-s),x,S;if(c)x=r/(a-r),S=a*r/(a-r);else if(o===nn)x=-(a+r)/(a-r),S=-2*a*r/(a-r);else if(o===Ui)x=-a/(a-r),S=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return l[0]=u,l[4]=0,l[8]=h,l[12]=0,l[1]=0,l[5]=d,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=x,l[14]=S,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,a,o=nn,c=!1){let l=this.elements,u=2/(e-t),d=2/(n-s),h=-(e+t)/(e-t),p=-(n+s)/(n-s),x,S;if(c)x=1/(a-r),S=a/(a-r);else if(o===nn)x=-2/(a-r),S=-(a+r)/(a-r);else if(o===Ui)x=-1/(a-r),S=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return l[0]=u,l[4]=0,l[8]=0,l[12]=h,l[1]=0,l[5]=d,l[9]=0,l[13]=p,l[2]=0,l[6]=0,l[10]=x,l[14]=S,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}};aa.prototype.isMatrix4=!0;var ue=aa,Mi=new W,Qe=new ue,Au=new W(0,0,0),wu=new W(1,1,1),On=new W,tr=new W,ze=new W,hc=new ue,uc=new mn,Pn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],a=s[4],o=s[8],c=s[1],l=s[5],u=s[9],d=s[2],h=s[6],p=s[10];switch(e){case"XYZ":this._y=Math.asin(te(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,p),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(h,l),this._z=0);break;case"YXZ":this._x=Math.asin(-te(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-d,r),this._z=0);break;case"ZXY":this._x=Math.asin(te(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-a,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-te(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(h,p),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-a,l));break;case"YZX":this._z=Math.asin(te(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-u,l),this._y=Math.atan2(-d,r)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-te(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(h,l),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,p),this._y=0);break;default:Wt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return hc.makeRotationFromQuaternion(t),this.setFromRotationMatrix(hc,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return uc.setFromEuler(this),this.setFromQuaternion(uc,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Pn.DEFAULT_ORDER="XYZ";var fs=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Cu=0,dc=new W,Si=new mn,bn=new ue,er=new W,es=new W,Ru=new W,Lu=new mn,fc=new W(1,0,0),pc=new W(0,1,0),mc=new W(0,0,1),gc={type:"added"},Pu={type:"removed"},bi={type:"childadded",child:null},mo={type:"childremoved",child:null},Ne=class i extends pn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Cu++}),this.uuid=Ji(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new W,e=new Pn,n=new mn,s=new W(1,1,1);function r(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ue},normalMatrix:{value:new Gt}}),this.matrix=new ue,this.matrixWorld=new ue,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new fs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Si.setFromAxisAngle(t,e),this.quaternion.multiply(Si),this}rotateOnWorldAxis(t,e){return Si.setFromAxisAngle(t,e),this.quaternion.premultiply(Si),this}rotateX(t){return this.rotateOnAxis(fc,t)}rotateY(t){return this.rotateOnAxis(pc,t)}rotateZ(t){return this.rotateOnAxis(mc,t)}translateOnAxis(t,e){return dc.copy(t).applyQuaternion(this.quaternion),this.position.add(dc.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(fc,t)}translateY(t){return this.translateOnAxis(pc,t)}translateZ(t){return this.translateOnAxis(mc,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(bn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?er.copy(t):er.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),es.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?bn.lookAt(es,er,this.up):bn.lookAt(er,es,this.up),this.quaternion.setFromRotationMatrix(bn),s&&(bn.extractRotation(s.matrixWorld),Si.setFromRotationMatrix(bn),this.quaternion.premultiply(Si.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(qt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(gc),bi.child=t,this.dispatchEvent(bi),bi.child=null):qt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Pu),mo.child=t,this.dispatchEvent(mo),mo.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),bn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),bn.multiply(t.parent.matrixWorld)),t.applyMatrix4(bn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(gc),bi.child=t,this.dispatchEvent(bi),bi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(es,t,Ru),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(es,Lu,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let c=o.shapes;if(Array.isArray(c))for(let l=0,u=c.length;l<u;l++){let d=c[l];r(t.shapes,d)}else r(t.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(r(t.materials,this.material[c]));s.material=o}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){let c=this.animations[o];s.animations.push(r(t.animations,c))}}if(e){let o=a(t.geometries),c=a(t.materials),l=a(t.textures),u=a(t.images),d=a(t.shapes),h=a(t.skeletons),p=a(t.animations),x=a(t.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),u.length>0&&(n.images=u),d.length>0&&(n.shapes=d),h.length>0&&(n.skeletons=h),p.length>0&&(n.animations=p),x.length>0&&(n.nodes=x)}return n.object=s,n;function a(o){let c=[];for(let l in o){let u=o[l];delete u.metadata,c.push(u)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}};Ne.DEFAULT_UP=new W(0,1,0);Ne.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ne.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var dn=class extends Ne{constructor(){super(),this.isGroup=!0,this.type="Group"}},Iu={type:"move"},Bi=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new dn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new dn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new W,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new W),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new dn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new W,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new W,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,a=null,o=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){a=!0;for(let S of t.hand.values()){let g=e.getJointPose(S,n),f=this._getHandJoint(l,S);g!==null&&(f.matrix.fromArray(g.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=g.radius),f.visible=g!==null}let u=l.joints["index-finger-tip"],d=l.joints["thumb-tip"],h=u.position.distanceTo(d.position),p=.02,x=.005;l.inputState.pinching&&h>p+x?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&h<=p-x&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1,c.eventsEnabled&&c.dispatchEvent({type:"gripUpdated",data:t,target:this})));o!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Iu)))}return o!==null&&(o.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new dn;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},gh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Bn={h:0,s:0,l:0},nr={h:0,s:0,l:0};function go(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Kt=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Te){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ee.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=ee.workingColorSpace){return this.r=t,this.g=e,this.b=n,ee.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=ee.workingColorSpace){if(t=Su(t,1),e=te(e,0,1),n=te(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,a=2*n-r;this.r=go(a,r,t+1/3),this.g=go(a,r,t),this.b=go(a,r,t-1/3)}return ee.colorSpaceToWorking(this,s),this}setStyle(t,e=Te){function n(r){r!==void 0&&parseFloat(r)<1&&Wt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Wt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(r,16),e);Wt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Te){let n=gh[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Wt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Rn(t.r),this.g=Rn(t.g),this.b=Rn(t.b),this}copyLinearToSRGB(t){return this.r=Ii(t.r),this.g=Ii(t.g),this.b=Ii(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Te){return ee.workingToColorSpace(Re.copy(this),t),Math.round(te(Re.r*255,0,255))*65536+Math.round(te(Re.g*255,0,255))*256+Math.round(te(Re.b*255,0,255))}getHexString(t=Te){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ee.workingColorSpace){ee.workingToColorSpace(Re.copy(this),e);let n=Re.r,s=Re.g,r=Re.b,a=Math.max(n,s,r),o=Math.min(n,s,r),c,l,u=(o+a)/2;if(o===a)c=0,l=0;else{let d=a-o;switch(l=u<=.5?d/(a+o):d/(2-a-o),a){case n:c=(s-r)/d+(s<r?6:0);break;case s:c=(r-n)/d+2;break;case r:c=(n-s)/d+4;break}c/=6}return t.h=c,t.s=l,t.l=u,t}getRGB(t,e=ee.workingColorSpace){return ee.workingToColorSpace(Re.copy(this),e),t.r=Re.r,t.g=Re.g,t.b=Re.b,t}getStyle(t=Te){ee.workingToColorSpace(Re.copy(this),t);let e=Re.r,n=Re.g,s=Re.b;return t!==Te?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Bn),this.setHSL(Bn.h+t,Bn.s+e,Bn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Bn),t.getHSL(nr);let n=co(Bn.h,nr.h,e),s=co(Bn.s,nr.s,e),r=co(Bn.l,nr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Re=new Kt;Kt.NAMES=gh;var ps=class extends Ne{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pn,this.environmentIntensity=1,this.environmentRotation=new Pn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}},tn=new W,Tn=new W,_o=new W,En=new W,Ti=new W,Ei=new W,_c=new W,xo=new W,yo=new W,vo=new W,Mo=new de,So=new de,bo=new de,Hn=class i{constructor(t=new W,e=new W,n=new W){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),tn.subVectors(t,e),s.cross(tn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){tn.subVectors(s,e),Tn.subVectors(n,e),_o.subVectors(t,e);let a=tn.dot(tn),o=tn.dot(Tn),c=tn.dot(_o),l=Tn.dot(Tn),u=Tn.dot(_o),d=a*l-o*o;if(d===0)return r.set(0,0,0),null;let h=1/d,p=(l*c-o*u)*h,x=(a*u-o*c)*h;return r.set(1-p-x,x,p)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,En)===null?!1:En.x>=0&&En.y>=0&&En.x+En.y<=1}static getInterpolation(t,e,n,s,r,a,o,c){return this.getBarycoord(t,e,n,s,En)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,En.x),c.addScaledVector(a,En.y),c.addScaledVector(o,En.z),c)}static getInterpolatedAttribute(t,e,n,s,r,a){return Mo.setScalar(0),So.setScalar(0),bo.setScalar(0),Mo.fromBufferAttribute(t,e),So.fromBufferAttribute(t,n),bo.fromBufferAttribute(t,s),a.setScalar(0),a.addScaledVector(Mo,r.x),a.addScaledVector(So,r.y),a.addScaledVector(bo,r.z),a}static isFrontFacing(t,e,n,s){return tn.subVectors(n,e),Tn.subVectors(t,e),tn.cross(Tn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return tn.subVectors(this.c,this.b),Tn.subVectors(this.a,this.b),tn.cross(Tn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,a,o;Ti.subVectors(s,n),Ei.subVectors(r,n),xo.subVectors(t,n);let c=Ti.dot(xo),l=Ei.dot(xo);if(c<=0&&l<=0)return e.copy(n);yo.subVectors(t,s);let u=Ti.dot(yo),d=Ei.dot(yo);if(u>=0&&d<=u)return e.copy(s);let h=c*d-u*l;if(h<=0&&c>=0&&u<=0)return a=c/(c-u),e.copy(n).addScaledVector(Ti,a);vo.subVectors(t,r);let p=Ti.dot(vo),x=Ei.dot(vo);if(x>=0&&p<=x)return e.copy(r);let S=p*l-c*x;if(S<=0&&l>=0&&x<=0)return o=l/(l-x),e.copy(n).addScaledVector(Ei,o);let g=u*x-p*d;if(g<=0&&d-u>=0&&p-x>=0)return _c.subVectors(r,s),o=(d-u)/(d-u+(p-x)),e.copy(s).addScaledVector(_c,o);let f=1/(g+S+h);return a=S*f,o=h*f,e.copy(n).addScaledVector(Ti,a).addScaledVector(Ei,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},Xn=class{constructor(t=new W(1/0,1/0,1/0),e=new W(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(en.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(en.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=en.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,en):en.fromBufferAttribute(r,a),en.applyMatrix4(t.matrixWorld),this.expandByPoint(en);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ir.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ir.copy(n.boundingBox)),ir.applyMatrix4(t.matrixWorld),this.union(ir)}let s=t.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,en),en.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(ns),sr.subVectors(this.max,ns),Ai.subVectors(t.a,ns),wi.subVectors(t.b,ns),Ci.subVectors(t.c,ns),zn.subVectors(wi,Ai),kn.subVectors(Ci,wi),ii.subVectors(Ai,Ci);let e=[0,-zn.z,zn.y,0,-kn.z,kn.y,0,-ii.z,ii.y,zn.z,0,-zn.x,kn.z,0,-kn.x,ii.z,0,-ii.x,-zn.y,zn.x,0,-kn.y,kn.x,0,-ii.y,ii.x,0];return!To(e,Ai,wi,Ci,sr)||(e=[1,0,0,0,1,0,0,0,1],!To(e,Ai,wi,Ci,sr))?!1:(rr.crossVectors(zn,kn),e=[rr.x,rr.y,rr.z],To(e,Ai,wi,Ci,sr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,en).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(en).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(An[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),An[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),An[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),An[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),An[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),An[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),An[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),An[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(An),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},An=[new W,new W,new W,new W,new W,new W,new W,new W],en=new W,ir=new Xn,Ai=new W,wi=new W,Ci=new W,zn=new W,kn=new W,ii=new W,ns=new W,sr=new W,rr=new W,si=new W;function To(i,t,e,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){si.fromArray(i,r);let o=s.x*Math.abs(si.x)+s.y*Math.abs(si.y)+s.z*Math.abs(si.z),c=t.dot(si),l=e.dot(si),u=n.dot(si);if(Math.max(-Math.max(c,l,u),Math.min(c,l,u))>o)return!1}return!0}var xe=new W,ar=new yt,Nu=0,Ge=class extends pn{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Nu++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Vo,this.updateRanges=[],this.gpuType=an,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)ar.fromBufferAttribute(this,e),ar.applyMatrix3(t),this.setXY(e,ar.x,ar.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyMatrix3(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyMatrix4(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyNormalMatrix(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.transformDirection(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=ts(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ue(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=ts(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ue(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=ts(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ue(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=ts(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ue(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=ts(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ue(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ue(e,this.array),n=Ue(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Ue(e,this.array),n=Ue(n,this.array),s=Ue(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Ue(e,this.array),n=Ue(n,this.array),s=Ue(s,this.array),r=Ue(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Vo&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}};var ms=class extends Ge{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var gs=class extends Ge{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var oe=class extends Ge{constructor(t,e,n){super(new Float32Array(t),e,n)}},Du=new Xn,is=new W,Eo=new W,zi=class{constructor(t=new W,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Du.setFromPoints(t).getCenter(n);let s=0;for(let r=0,a=t.length;r<a;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;is.subVectors(t,this.center);let e=is.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(is,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Eo.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(is.copy(t.center).add(Eo)),this.expandByPoint(is.copy(t.center).sub(Eo))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Uu=0,$e=new ue,Ao=new Ne,Ri=new W,ke=new Xn,ss=new Xn,Me=new W,Le=class i extends pn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Uu++}),this.uuid=Ji(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(vu(t)?gs:ms)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Gt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return $e.makeRotationFromQuaternion(t),this.applyMatrix4($e),this}rotateX(t){return $e.makeRotationX(t),this.applyMatrix4($e),this}rotateY(t){return $e.makeRotationY(t),this.applyMatrix4($e),this}rotateZ(t){return $e.makeRotationZ(t),this.applyMatrix4($e),this}translate(t,e,n){return $e.makeTranslation(t,e,n),this.applyMatrix4($e),this}scale(t,e,n){return $e.makeScale(t,e,n),this.applyMatrix4($e),this}lookAt(t){return Ao.lookAt(t),Ao.updateMatrix(),this.applyMatrix4(Ao.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ri).negate(),this.translate(Ri.x,Ri.y,Ri.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let a=t[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new oe(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Wt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Xn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){qt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new W(-1/0,-1/0,-1/0),new W(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];ke.setFromBufferAttribute(r),this.morphTargetsRelative?(Me.addVectors(this.boundingBox.min,ke.min),this.boundingBox.expandByPoint(Me),Me.addVectors(this.boundingBox.max,ke.max),this.boundingBox.expandByPoint(Me)):(this.boundingBox.expandByPoint(ke.min),this.boundingBox.expandByPoint(ke.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&qt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new zi);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){qt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new W,1/0);return}if(t){let n=this.boundingSphere.center;if(ke.setFromBufferAttribute(t),e)for(let r=0,a=e.length;r<a;r++){let o=e[r];ss.setFromBufferAttribute(o),this.morphTargetsRelative?(Me.addVectors(ke.min,ss.min),ke.expandByPoint(Me),Me.addVectors(ke.max,ss.max),ke.expandByPoint(Me)):(ke.expandByPoint(ss.min),ke.expandByPoint(ss.max))}ke.getCenter(n);let s=0;for(let r=0,a=t.count;r<a;r++)Me.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Me));if(e)for(let r=0,a=e.length;r<a;r++){let o=e[r],c=this.morphTargetsRelative;for(let l=0,u=o.count;l<u;l++)Me.fromBufferAttribute(o,l),c&&(Ri.fromBufferAttribute(t,l),Me.add(Ri)),s=Math.max(s,n.distanceToSquared(Me))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&qt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){qt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Ge(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],c=[];for(let y=0;y<n.count;y++)o[y]=new W,c[y]=new W;let l=new W,u=new W,d=new W,h=new yt,p=new yt,x=new yt,S=new W,g=new W;function f(y,C,z){l.fromBufferAttribute(n,y),u.fromBufferAttribute(n,C),d.fromBufferAttribute(n,z),h.fromBufferAttribute(r,y),p.fromBufferAttribute(r,C),x.fromBufferAttribute(r,z),u.sub(l),d.sub(l),p.sub(h),x.sub(h);let O=1/(p.x*x.y-x.x*p.y);isFinite(O)&&(S.copy(u).multiplyScalar(x.y).addScaledVector(d,-p.y).multiplyScalar(O),g.copy(d).multiplyScalar(p.x).addScaledVector(u,-x.x).multiplyScalar(O),o[y].add(S),o[C].add(S),o[z].add(S),c[y].add(g),c[C].add(g),c[z].add(g))}let L=this.groups;L.length===0&&(L=[{start:0,count:t.count}]);for(let y=0,C=L.length;y<C;++y){let z=L[y],O=z.start,k=z.count;for(let lt=O,ot=O+k;lt<ot;lt+=3)f(t.getX(lt+0),t.getX(lt+1),t.getX(lt+2))}let w=new W,v=new W,R=new W,A=new W;function N(y){R.fromBufferAttribute(s,y),A.copy(R);let C=o[y];w.copy(C),w.sub(R.multiplyScalar(R.dot(C))).normalize(),v.crossVectors(A,C);let O=v.dot(c[y])<0?-1:1;a.setXYZW(y,w.x,w.y,w.z,O)}for(let y=0,C=L.length;y<C;++y){let z=L[y],O=z.start,k=z.count;for(let lt=O,ot=O+k;lt<ot;lt+=3)N(t.getX(lt+0)),N(t.getX(lt+1)),N(t.getX(lt+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new Ge(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let h=0,p=n.count;h<p;h++)n.setXYZ(h,0,0,0);let s=new W,r=new W,a=new W,o=new W,c=new W,l=new W,u=new W,d=new W;if(t)for(let h=0,p=t.count;h<p;h+=3){let x=t.getX(h+0),S=t.getX(h+1),g=t.getX(h+2);s.fromBufferAttribute(e,x),r.fromBufferAttribute(e,S),a.fromBufferAttribute(e,g),u.subVectors(a,r),d.subVectors(s,r),u.cross(d),o.fromBufferAttribute(n,x),c.fromBufferAttribute(n,S),l.fromBufferAttribute(n,g),o.add(u),c.add(u),l.add(u),n.setXYZ(x,o.x,o.y,o.z),n.setXYZ(S,c.x,c.y,c.z),n.setXYZ(g,l.x,l.y,l.z)}else for(let h=0,p=e.count;h<p;h+=3)s.fromBufferAttribute(e,h+0),r.fromBufferAttribute(e,h+1),a.fromBufferAttribute(e,h+2),u.subVectors(a,r),d.subVectors(s,r),u.cross(d),n.setXYZ(h+0,u.x,u.y,u.z),n.setXYZ(h+1,u.x,u.y,u.z),n.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Me.fromBufferAttribute(t,e),Me.normalize(),t.setXYZ(e,Me.x,Me.y,Me.z)}toNonIndexed(){function t(o,c){let l=o.array,u=o.itemSize,d=o.normalized,h=new l.constructor(c.length*u),p=0,x=0;for(let S=0,g=c.length;S<g;S++){o.isInterleavedBufferAttribute?p=c[S]*o.data.stride+o.offset:p=c[S]*u;for(let f=0;f<u;f++)h[x++]=l[p++]}return new Ge(h,u,d)}if(this.index===null)return Wt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let o in s){let c=s[o],l=t(c,n);e.setAttribute(o,l)}let r=this.morphAttributes;for(let o in r){let c=[],l=r[o];for(let u=0,d=l.length;u<d;u++){let h=l[u],p=t(h,n);c.push(p)}e.morphAttributes[o]=c}e.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,c=a.length;o<c;o++){let l=a[o];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let c in n){let l=n[c];t.data.attributes[c]=l.toJSON(t.data)}let s={},r=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],u=[];for(let d=0,h=l.length;d<h;d++){let p=l[d];u.push(p.toJSON(t.data))}u.length>0&&(s[c]=u,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let l in s){let u=s[l];this.setAttribute(l,u.clone(e))}let r=t.morphAttributes;for(let l in r){let u=[],d=r[l];for(let h=0,p=d.length;h<p;h++)u.push(d[h].clone(e));this.morphAttributes[l]=u}this.morphTargetsRelative=t.morphTargetsRelative;let a=t.groups;for(let l=0,u=a.length;l<u;l++){let d=a[l];this.addGroup(d.start,d.count,d.materialIndex)}let o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());let c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Fu=0,qn=class extends pn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Fu++}),this.uuid=Ji(),this.name="",this.type="Material",this.blending=ci,this.side=Ln,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=br,this.blendDst=Tr,this.blendEquation=Wn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Kt(0,0,0),this.blendAlpha=0,this.depthFunc=hi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ko,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=oi,this.stencilZFail=oi,this.stencilZPass=oi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Wt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Wt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ci&&(n.blending=this.blending),this.side!==Ln&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==br&&(n.blendSrc=this.blendSrc),this.blendDst!==Tr&&(n.blendDst=this.blendDst),this.blendEquation!==Wn&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==hi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ko&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==oi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==oi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==oi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let a=[];for(let o in r){let c=r[o];delete c.metadata,a.push(c)}return a}if(e){let r=s(t.textures),a=s(t.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Kt().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new yt().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new yt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var wn=new W,wo=new W,or=new W,Vn=new W,Co=new W,lr=new W,Ro=new W,Or=class{constructor(t=new W,e=new W(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,wn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=wn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(wn.copy(this.origin).addScaledVector(this.direction,e),wn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){wo.copy(t).add(e).multiplyScalar(.5),or.copy(e).sub(t).normalize(),Vn.copy(this.origin).sub(wo);let r=t.distanceTo(e)*.5,a=-this.direction.dot(or),o=Vn.dot(this.direction),c=-Vn.dot(or),l=Vn.lengthSq(),u=Math.abs(1-a*a),d,h,p,x;if(u>0)if(d=a*c-o,h=a*o-c,x=r*u,d>=0)if(h>=-x)if(h<=x){let S=1/u;d*=S,h*=S,p=d*(d+a*h+2*o)+h*(a*d+h+2*c)+l}else h=r,d=Math.max(0,-(a*h+o)),p=-d*d+h*(h+2*c)+l;else h=-r,d=Math.max(0,-(a*h+o)),p=-d*d+h*(h+2*c)+l;else h<=-x?(d=Math.max(0,-(-a*r+o)),h=d>0?-r:Math.min(Math.max(-r,-c),r),p=-d*d+h*(h+2*c)+l):h<=x?(d=0,h=Math.min(Math.max(-r,-c),r),p=h*(h+2*c)+l):(d=Math.max(0,-(a*r+o)),h=d>0?r:Math.min(Math.max(-r,-c),r),p=-d*d+h*(h+2*c)+l);else h=a>0?-r:r,d=Math.max(0,-(a*h+o)),p=-d*d+h*(h+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,d),s&&s.copy(wo).addScaledVector(or,h),p}intersectSphere(t,e){wn.subVectors(t.center,this.origin);let n=wn.dot(this.direction),s=wn.dot(wn)-n*n,r=t.radius*t.radius;if(s>r)return null;let a=Math.sqrt(r-s),o=n-a,c=n+a;return c<0?null:o<0?this.at(c,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,a,o,c,l=1/this.direction.x,u=1/this.direction.y,d=1/this.direction.z,h=this.origin;return l>=0?(n=(t.min.x-h.x)*l,s=(t.max.x-h.x)*l):(n=(t.max.x-h.x)*l,s=(t.min.x-h.x)*l),u>=0?(r=(t.min.y-h.y)*u,a=(t.max.y-h.y)*u):(r=(t.max.y-h.y)*u,a=(t.min.y-h.y)*u),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),d>=0?(o=(t.min.z-h.z)*d,c=(t.max.z-h.z)*d):(o=(t.max.z-h.z)*d,c=(t.min.z-h.z)*d),n>c||o>s)||((o>n||n!==n)&&(n=o),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,wn)!==null}intersectTriangle(t,e,n,s,r){Co.subVectors(e,t),lr.subVectors(n,t),Ro.crossVectors(Co,lr);let a=this.direction.dot(Ro),o;if(a>0){if(s)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Vn.subVectors(this.origin,t);let c=o*this.direction.dot(lr.crossVectors(Vn,lr));if(c<0)return null;let l=o*this.direction.dot(Co.cross(Vn));if(l<0||c+l>a)return null;let u=-o*Vn.dot(Ro);return u<0?null:this.at(u/a,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},We=class extends qn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Kt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=oa,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},xc=new ue,ri=new Or,cr=new zi,yc=new W,hr=new W,ur=new W,dr=new W,Lo=new W,fr=new W,vc=new W,pr=new W,be=class extends Ne{constructor(t=new Le,e=new We){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){let o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let o=this.morphTargetInfluences;if(r&&o){fr.set(0,0,0);for(let c=0,l=r.length;c<l;c++){let u=o[c],d=r[c];u!==0&&(Lo.fromBufferAttribute(d,t),a?fr.addScaledVector(Lo,u):fr.addScaledVector(Lo.sub(e),u))}e.add(fr)}return e}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),cr.copy(n.boundingSphere),cr.applyMatrix4(r),ri.copy(t.ray).recast(t.near),!(cr.containsPoint(ri.origin)===!1&&(ri.intersectSphere(cr,yc)===null||ri.origin.distanceToSquared(yc)>(t.far-t.near)**2))&&(xc.copy(r).invert(),ri.copy(t.ray).applyMatrix4(xc),!(n.boundingBox!==null&&ri.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,ri)))}_computeIntersections(t,e,n){let s,r=this.geometry,a=this.material,o=r.index,c=r.attributes.position,l=r.attributes.uv,u=r.attributes.uv1,d=r.attributes.normal,h=r.groups,p=r.drawRange;if(o!==null)if(Array.isArray(a))for(let x=0,S=h.length;x<S;x++){let g=h[x],f=a[g.materialIndex],L=Math.max(g.start,p.start),w=Math.min(o.count,Math.min(g.start+g.count,p.start+p.count));for(let v=L,R=w;v<R;v+=3){let A=o.getX(v),N=o.getX(v+1),y=o.getX(v+2);s=mr(this,f,t,n,l,u,d,A,N,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=g.materialIndex,e.push(s))}}else{let x=Math.max(0,p.start),S=Math.min(o.count,p.start+p.count);for(let g=x,f=S;g<f;g+=3){let L=o.getX(g),w=o.getX(g+1),v=o.getX(g+2);s=mr(this,a,t,n,l,u,d,L,w,v),s&&(s.faceIndex=Math.floor(g/3),e.push(s))}}else if(c!==void 0)if(Array.isArray(a))for(let x=0,S=h.length;x<S;x++){let g=h[x],f=a[g.materialIndex],L=Math.max(g.start,p.start),w=Math.min(c.count,Math.min(g.start+g.count,p.start+p.count));for(let v=L,R=w;v<R;v+=3){let A=v,N=v+1,y=v+2;s=mr(this,f,t,n,l,u,d,A,N,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=g.materialIndex,e.push(s))}}else{let x=Math.max(0,p.start),S=Math.min(c.count,p.start+p.count);for(let g=x,f=S;g<f;g+=3){let L=g,w=g+1,v=g+2;s=mr(this,a,t,n,l,u,d,L,w,v),s&&(s.faceIndex=Math.floor(g/3),e.push(s))}}}};function Ou(i,t,e,n,s,r,a,o){let c;if(t.side===De?c=n.intersectTriangle(a,r,s,!0,o):c=n.intersectTriangle(s,r,a,t.side===Ln,o),c===null)return null;pr.copy(o),pr.applyMatrix4(i.matrixWorld);let l=e.ray.origin.distanceTo(pr);return l<e.near||l>e.far?null:{distance:l,point:pr.clone(),object:i}}function mr(i,t,e,n,s,r,a,o,c,l){i.getVertexPosition(o,hr),i.getVertexPosition(c,ur),i.getVertexPosition(l,dr);let u=Ou(i,t,e,n,hr,ur,dr,vc);if(u){let d=new W;Hn.getBarycoord(vc,hr,ur,dr,d),s&&(u.uv=Hn.getInterpolatedAttribute(s,o,c,l,d,new yt)),r&&(u.uv1=Hn.getInterpolatedAttribute(r,o,c,l,d,new yt)),a&&(u.normal=Hn.getInterpolatedAttribute(a,o,c,l,d,new W),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));let h={a:o,b:c,c:l,normal:new W,materialIndex:0};Hn.getNormal(hr,ur,dr,h.normal),u.face=h,u.barycoord=d}return u}var Br=class extends Ie{constructor(t=null,e=1,n=1,s,r,a,o,c,l=Se,u=Se,d,h){super(null,a,o,c,l,u,s,r,d,h),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Po=new W,Bu=new W,zu=new Gt,un=class{constructor(t=new W(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Po.subVectors(n,e).cross(Bu.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Po),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let a=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:e.copy(t.start).addScaledVector(s,a)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||zu.getNormalMatrix(t),s=this.coplanarPoint(Po).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}},ai=new zi,ku=new yt(.5,.5),gr=new W,ki=class{constructor(t=new un,e=new un,n=new un,s=new un,r=new un,a=new un){this.planes=[t,e,n,s,r,a]}set(t,e,n,s,r,a){let o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=nn,n=!1){let s=this.planes,r=t.elements,a=r[0],o=r[1],c=r[2],l=r[3],u=r[4],d=r[5],h=r[6],p=r[7],x=r[8],S=r[9],g=r[10],f=r[11],L=r[12],w=r[13],v=r[14],R=r[15];if(s[0].setComponents(l-a,p-u,f-x,R-L).normalize(),s[1].setComponents(l+a,p+u,f+x,R+L).normalize(),s[2].setComponents(l+o,p+d,f+S,R+w).normalize(),s[3].setComponents(l-o,p-d,f-S,R-w).normalize(),n)s[4].setComponents(c,h,g,v).normalize(),s[5].setComponents(l-c,p-h,f-g,R-v).normalize();else if(s[4].setComponents(l-c,p-h,f-g,R-v).normalize(),e===nn)s[5].setComponents(l+c,p+h,f+g,R+v).normalize();else if(e===Ui)s[5].setComponents(c,h,g,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),ai.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),ai.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(ai)}intersectsSprite(t){ai.center.set(0,0,0);let e=ku.distanceTo(t.center);return ai.radius=.7071067811865476+e,ai.applyMatrix4(t.matrixWorld),this.intersectsSphere(ai)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(gr.x=s.normal.x>0?t.max.x:t.min.x,gr.y=s.normal.y>0?t.max.y:t.min.y,gr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(gr)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var _s=class extends Ie{constructor(t=[],e=Kn,n,s,r,a,o,c,l,u){super(t,e,n,s,r,a,o,c,l,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},xs=class extends Ie{constructor(t,e,n,s,r,a,o,c,l){super(t,e,n,s,r,a,o,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}};var In=class extends Ie{constructor(t,e,n=rn,s,r,a,o=Se,c=Se,l,u=fn,d=1){if(u!==fn&&u!==Qn)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:t,height:e,depth:d};super(h,s,r,a,o,c,u,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Oi(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}},zr=class extends In{constructor(t,e=rn,n=Kn,s,r,a=Se,o=Se,c,l=fn){let u={width:t,height:t,depth:1},d=[u,u,u,u,u,u];super(t,t,e,n,s,r,a,o,c,l),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},ys=class extends Ie{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Vi=class i extends Le{constructor(t=1,e=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};let o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);let c=[],l=[],u=[],d=[],h=0,p=0;x("z","y","x",-1,-1,n,e,t,a,r,0),x("z","y","x",1,-1,n,e,-t,a,r,1),x("x","z","y",1,1,t,n,e,s,a,2),x("x","z","y",1,-1,t,n,-e,s,a,3),x("x","y","z",1,-1,t,e,n,s,r,4),x("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new oe(l,3)),this.setAttribute("normal",new oe(u,3)),this.setAttribute("uv",new oe(d,2));function x(S,g,f,L,w,v,R,A,N,y,C){let z=v/N,O=R/y,k=v/2,lt=R/2,ot=A/2,J=N+1,it=y+1,Y=0,V=0,pt=new W;for(let mt=0;mt<it;mt++){let vt=mt*O-lt;for(let Ct=0;Ct<J;Ct++){let Xt=Ct*z-k;pt[S]=Xt*L,pt[g]=vt*w,pt[f]=ot,l.push(pt.x,pt.y,pt.z),pt[S]=0,pt[g]=0,pt[f]=A>0?1:-1,u.push(pt.x,pt.y,pt.z),d.push(Ct/N),d.push(1-mt/y),Y+=1}}for(let mt=0;mt<y;mt++)for(let vt=0;vt<N;vt++){let Ct=h+vt+J*mt,Xt=h+vt+J*(mt+1),Jt=h+(vt+1)+J*(mt+1),Yt=h+(vt+1)+J*mt;c.push(Ct,Xt,Yt),c.push(Xt,Jt,Yt),V+=6}o.addGroup(p,V,C),p+=V,h+=Y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var vs=class i extends Le{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);let r=[],a=[],o=[],c=[],l=new W,u=new yt;a.push(0,0,0),o.push(0,0,1),c.push(.5,.5);for(let d=0,h=3;d<=e;d++,h+=3){let p=n+d/e*s;l.x=t*Math.cos(p),l.y=t*Math.sin(p),a.push(l.x,l.y,l.z),o.push(0,0,1),u.x=(a[h]/t+1)/2,u.y=(a[h+1]/t+1)/2,c.push(u.x,u.y)}for(let d=1;d<=e;d++)r.push(d,d+1,0);this.setIndex(r),this.setAttribute("position",new oe(a,3)),this.setAttribute("normal",new oe(o,3)),this.setAttribute("uv",new oe(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.segments,t.thetaStart,t.thetaLength)}};var Xe=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Wt("Curve: .getPoint() not implemented.")}getPointAt(t,e){let n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){let e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],n,s=this.getPoint(0),r=0;e.push(0);for(let a=1;a<=t;a++)n=this.getPoint(a/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let n=this.getLengths(),s=0,r=n.length,a;e?a=e:a=t*n[r-1];let o=0,c=r-1,l;for(;o<=c;)if(s=Math.floor(o+(c-o)/2),l=n[s]-a,l<0)o=s+1;else if(l>0)c=s-1;else{c=s;break}if(s=c,n[s]===a)return s/(r-1);let u=n[s],h=n[s+1]-u,p=(a-u)/h;return(s+p)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let a=this.getPoint(s),o=this.getPoint(r),c=e||(a.isVector2?new yt:new W);return c.copy(o).sub(a).normalize(),c}getTangentAt(t,e){let n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e=!1){let n=new W,s=[],r=[],a=[],o=new W,c=new ue;for(let p=0;p<=t;p++){let x=p/t;s[p]=this.getTangentAt(x,new W)}r[0]=new W,a[0]=new W;let l=Number.MAX_VALUE,u=Math.abs(s[0].x),d=Math.abs(s[0].y),h=Math.abs(s[0].z);u<=l&&(l=u,n.set(1,0,0)),d<=l&&(l=d,n.set(0,1,0)),h<=l&&n.set(0,0,1),o.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],o),a[0].crossVectors(s[0],r[0]);for(let p=1;p<=t;p++){if(r[p]=r[p-1].clone(),a[p]=a[p-1].clone(),o.crossVectors(s[p-1],s[p]),o.length()>Number.EPSILON){o.normalize();let x=Math.acos(te(s[p-1].dot(s[p]),-1,1));r[p].applyMatrix4(c.makeRotationAxis(o,x))}a[p].crossVectors(s[p],r[p])}if(e===!0){let p=Math.acos(te(r[0].dot(r[t]),-1,1));p/=t,s[0].dot(o.crossVectors(r[0],r[t]))>0&&(p=-p);for(let x=1;x<=t;x++)r[x].applyMatrix4(c.makeRotationAxis(s[x],p*x)),a[x].crossVectors(s[x],r[x])}return{tangents:s,normals:r,binormals:a}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Gi=class extends Xe{constructor(t=0,e=0,n=1,s=1,r=0,a=Math.PI*2,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=a,this.aClockwise=o,this.aRotation=c}getPoint(t,e=new yt){let n=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,a=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(a?r=0:r=s),this.aClockwise===!0&&!a&&(r===s?r=-s:r=r-s);let o=this.aStartAngle+t*r,c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let u=Math.cos(this.aRotation),d=Math.sin(this.aRotation),h=c-this.aX,p=l-this.aY;c=h*u-p*d+this.aX,l=h*d+p*u+this.aY}return n.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},kr=class extends Gi{constructor(t,e,n,s,r,a){super(t,e,n,n,s,r,a),this.isArcCurve=!0,this.type="ArcCurve"}};function yl(){let i=0,t=0,e=0,n=0;function s(r,a,o,c){i=r,t=o,e=-3*r+3*a-2*o-c,n=2*r-2*a+o+c}return{initCatmullRom:function(r,a,o,c,l){s(a,o,l*(o-r),l*(c-a))},initNonuniformCatmullRom:function(r,a,o,c,l,u,d){let h=(a-r)/l-(o-r)/(l+u)+(o-a)/u,p=(o-a)/u-(c-a)/(u+d)+(c-o)/d;h*=u,p*=u,s(a,o,h,p)},calc:function(r){let a=r*r,o=a*r;return i+t*r+e*a+n*o}}}var Mc=new W,Sc=new W,Io=new yl,No=new yl,Do=new yl,Vr=class extends Xe{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new W){let n=e,s=this.points,r=s.length,a=(r-(this.closed?0:1))*t,o=Math.floor(a),c=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/r)+1)*r:c===0&&o===r-1&&(o=r-2,c=1);let l,u;this.closed||o>0?l=s[(o-1)%r]:(Sc.subVectors(s[0],s[1]).add(s[0]),l=Sc);let d=s[o%r],h=s[(o+1)%r];if(this.closed||o+2<r?u=s[(o+2)%r]:(Mc.subVectors(s[r-1],s[r-2]).add(s[r-1]),u=Mc),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,x=Math.pow(l.distanceToSquared(d),p),S=Math.pow(d.distanceToSquared(h),p),g=Math.pow(h.distanceToSquared(u),p);S<1e-4&&(S=1),x<1e-4&&(x=S),g<1e-4&&(g=S),Io.initNonuniformCatmullRom(l.x,d.x,h.x,u.x,x,S,g),No.initNonuniformCatmullRom(l.y,d.y,h.y,u.y,x,S,g),Do.initNonuniformCatmullRom(l.z,d.z,h.z,u.z,x,S,g)}else this.curveType==="catmullrom"&&(Io.initCatmullRom(l.x,d.x,h.x,u.x,this.tension),No.initCatmullRom(l.y,d.y,h.y,u.y,this.tension),Do.initCatmullRom(l.z,d.z,h.z,u.z,this.tension));return n.set(Io.calc(c),No.calc(c),Do.calc(c)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new W().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function bc(i,t,e,n,s){let r=(n-t)*.5,a=(s-e)*.5,o=i*i,c=i*o;return(2*e-2*n+r+a)*c+(-3*e+3*n-2*r-a)*o+r*i+e}function Vu(i,t){let e=1-i;return e*e*t}function Gu(i,t){return 2*(1-i)*i*t}function Hu(i,t){return i*i*t}function as(i,t,e,n){return Vu(i,t)+Gu(i,e)+Hu(i,n)}function Wu(i,t){let e=1-i;return e*e*e*t}function Xu(i,t){let e=1-i;return 3*e*e*i*t}function qu(i,t){return 3*(1-i)*i*i*t}function Yu(i,t){return i*i*i*t}function os(i,t,e,n,s){return Wu(i,t)+Xu(i,e)+qu(i,n)+Yu(i,s)}var Ms=class extends Xe{constructor(t=new yt,e=new yt,n=new yt,s=new yt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new yt){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(os(t,s.x,r.x,a.x,o.x),os(t,s.y,r.y,a.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Gr=class extends Xe{constructor(t=new W,e=new W,n=new W,s=new W){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new W){let n=e,s=this.v0,r=this.v1,a=this.v2,o=this.v3;return n.set(os(t,s.x,r.x,a.x,o.x),os(t,s.y,r.y,a.y,o.y),os(t,s.z,r.z,a.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},Ss=class extends Xe{constructor(t=new yt,e=new yt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new yt){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new yt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Hr=class extends Xe{constructor(t=new W,e=new W){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new W){let n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new W){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},bs=class extends Xe{constructor(t=new yt,e=new yt,n=new yt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new yt){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(as(t,s.x,r.x,a.x),as(t,s.y,r.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Wr=class extends Xe{constructor(t=new W,e=new W,n=new W){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new W){let n=e,s=this.v0,r=this.v1,a=this.v2;return n.set(as(t,s.x,r.x,a.x),as(t,s.y,r.y,a.y),as(t,s.z,r.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Ts=class extends Xe{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new yt){let n=e,s=this.points,r=(s.length-1)*t,a=Math.floor(r),o=r-a,c=s[a===0?a:a-1],l=s[a],u=s[a>s.length-2?s.length-1:a+1],d=s[a>s.length-3?s.length-1:a+2];return n.set(bc(o,c.x,l.x,u.x,d.x),bc(o,c.y,l.y,u.y,d.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){let s=t.points[e];this.points.push(new yt().fromArray(s))}return this}},Go=Object.freeze({__proto__:null,ArcCurve:kr,CatmullRomCurve3:Vr,CubicBezierCurve:Ms,CubicBezierCurve3:Gr,EllipseCurve:Gi,LineCurve:Ss,LineCurve3:Hr,QuadraticBezierCurve:bs,QuadraticBezierCurve3:Wr,SplineCurve:Ts}),Xr=class extends Xe{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Go[n](e,t))}return this}getPoint(t,e){let n=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=n){let a=s[r]-n,o=this.curves[r],c=o.getLength(),l=c===0?0:1-a/c;return o.getPointAt(l,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],n;for(let s=0,r=this.curves;s<r.length;s++){let a=r[s],o=a.isEllipseCurve?t*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?t*a.points.length:t,c=a.getPoints(o);for(let l=0;l<c.length;l++){let u=c[l];n&&n.equals(u)||(e.push(u),n=u)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){let s=t.curves[e];this.curves.push(new Go[s.type]().fromJSON(s))}return this}},gn=class extends Xr{constructor(t){super(),this.type="Path",this.currentPoint=new yt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let n=new Ss(this.currentPoint.clone(),new yt(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){let r=new bs(this.currentPoint.clone(),new yt(t,e),new yt(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,a){let o=new Ms(this.currentPoint.clone(),new yt(t,e),new yt(n,s),new yt(r,a));return this.curves.push(o),this.currentPoint.set(r,a),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),n=new Ts(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,a){let o=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(t+o,e+c,n,s,r,a),this}absarc(t,e,n,s,r,a){return this.absellipse(t,e,n,n,s,r,a),this}ellipse(t,e,n,s,r,a,o,c){let l=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(t+l,e+u,n,s,r,a,o,c),this}absellipse(t,e,n,s,r,a,o,c){let l=new Gi(t,e,n,s,r,a,o,c);if(this.curves.length>0){let d=l.getPoint(0);d.equals(this.currentPoint)||this.lineTo(d.x,d.y)}this.curves.push(l);let u=l.getPoint(1);return this.currentPoint.copy(u),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Hi=class extends gn{constructor(t){super(t),this.uuid=Ji(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){let s=t.holes[e];this.holes.push(new gn().fromJSON(s))}return this}};function Zu(i,t,e=2){let n=t&&t.length,s=n?t[0]*e:i.length,r=_h(i,0,s,e,!0),a=[];if(!r||r.next===r.prev)return a;let o,c,l;if(n&&(r=Qu(i,t,r,e)),i.length>80*e){o=i[0],c=i[1];let u=o,d=c;for(let h=e;h<s;h+=e){let p=i[h],x=i[h+1];p<o&&(o=p),x<c&&(c=x),p>u&&(u=p),x>d&&(d=x)}l=Math.max(u-o,d-c),l=l!==0?32767/l:0}return Es(r,a,e,o,c,l,0),a}function _h(i,t,e,n,s){let r;if(s===hd(i,t,e,n)>0)for(let a=t;a<e;a+=n)r=Tc(a/n|0,i[a],i[a+1],r);else for(let a=e-n;a>=t;a-=n)r=Tc(a/n|0,i[a],i[a+1],r);return r&&Wi(r,r.next)&&(ws(r),r=r.next),r}function ui(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Wi(e,e.next)||fe(e.prev,e,e.next)===0)){if(ws(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Es(i,t,e,n,s,r,a){if(!i)return;!a&&r&&sd(i,n,s,r);let o=i;for(;i.prev!==i.next;){let c=i.prev,l=i.next;if(r?$u(i,n,s,r):Ju(i)){t.push(c.i,i.i,l.i),ws(i),i=l.next,o=l.next;continue}if(i=l,i===o){a?a===1?(i=Ku(ui(i),t),Es(i,t,e,n,s,r,2)):a===2&&ju(i,t,e,n,s,r):Es(ui(i),t,e,n,s,r,1);break}}}function Ju(i){let t=i.prev,e=i,n=i.next;if(fe(t,e,n)>=0)return!1;let s=t.x,r=e.x,a=n.x,o=t.y,c=e.y,l=n.y,u=Math.min(s,r,a),d=Math.min(o,c,l),h=Math.max(s,r,a),p=Math.max(o,c,l),x=n.next;for(;x!==t;){if(x.x>=u&&x.x<=h&&x.y>=d&&x.y<=p&&rs(s,o,r,c,a,l,x.x,x.y)&&fe(x.prev,x,x.next)>=0)return!1;x=x.next}return!0}function $u(i,t,e,n){let s=i.prev,r=i,a=i.next;if(fe(s,r,a)>=0)return!1;let o=s.x,c=r.x,l=a.x,u=s.y,d=r.y,h=a.y,p=Math.min(o,c,l),x=Math.min(u,d,h),S=Math.max(o,c,l),g=Math.max(u,d,h),f=Ho(p,x,t,e,n),L=Ho(S,g,t,e,n),w=i.prevZ,v=i.nextZ;for(;w&&w.z>=f&&v&&v.z<=L;){if(w.x>=p&&w.x<=S&&w.y>=x&&w.y<=g&&w!==s&&w!==a&&rs(o,u,c,d,l,h,w.x,w.y)&&fe(w.prev,w,w.next)>=0||(w=w.prevZ,v.x>=p&&v.x<=S&&v.y>=x&&v.y<=g&&v!==s&&v!==a&&rs(o,u,c,d,l,h,v.x,v.y)&&fe(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;w&&w.z>=f;){if(w.x>=p&&w.x<=S&&w.y>=x&&w.y<=g&&w!==s&&w!==a&&rs(o,u,c,d,l,h,w.x,w.y)&&fe(w.prev,w,w.next)>=0)return!1;w=w.prevZ}for(;v&&v.z<=L;){if(v.x>=p&&v.x<=S&&v.y>=x&&v.y<=g&&v!==s&&v!==a&&rs(o,u,c,d,l,h,v.x,v.y)&&fe(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Ku(i,t){let e=i;do{let n=e.prev,s=e.next.next;!Wi(n,s)&&yh(n,e,e.next,s)&&As(n,s)&&As(s,n)&&(t.push(n.i,e.i,s.i),ws(e),ws(e.next),e=i=s),e=e.next}while(e!==i);return ui(e)}function ju(i,t,e,n,s,r){let a=i;do{let o=a.next.next;for(;o!==a.prev;){if(a.i!==o.i&&od(a,o)){let c=vh(a,o);a=ui(a,a.next),c=ui(c,c.next),Es(a,t,e,n,s,r,0),Es(c,t,e,n,s,r,0);return}o=o.next}a=a.next}while(a!==i)}function Qu(i,t,e,n){let s=[];for(let r=0,a=t.length;r<a;r++){let o=t[r]*n,c=r<a-1?t[r+1]*n:i.length,l=_h(i,o,c,n,!1);l===l.next&&(l.steiner=!0),s.push(ad(l))}s.sort(td);for(let r=0;r<s.length;r++)e=ed(s[r],e);return e}function td(i,t){let e=i.x-t.x;if(e===0&&(e=i.y-t.y,e===0)){let n=(i.next.y-i.y)/(i.next.x-i.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=n-s}return e}function ed(i,t){let e=nd(i,t);if(!e)return t;let n=vh(e,i);return ui(n,n.next),ui(e,e.next)}function nd(i,t){let e=t,n=i.x,s=i.y,r=-1/0,a;if(Wi(i,e))return e;do{if(Wi(i,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let d=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=n&&d>r&&(r=d,a=e.x<e.next.x?e:e.next,d===n))return a}e=e.next}while(e!==t);if(!a)return null;let o=a,c=a.x,l=a.y,u=1/0;e=a;do{if(n>=e.x&&e.x>=c&&n!==e.x&&xh(s<l?n:r,s,c,l,s<l?r:n,s,e.x,e.y)){let d=Math.abs(s-e.y)/(n-e.x);As(e,i)&&(d<u||d===u&&(e.x>a.x||e.x===a.x&&id(a,e)))&&(a=e,u=d)}e=e.next}while(e!==o);return a}function id(i,t){return fe(i.prev,i,t.prev)<0&&fe(t.next,i,i.next)<0}function sd(i,t,e,n){let s=i;do s.z===0&&(s.z=Ho(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,rd(s)}function rd(i){let t,e=1;do{let n=i,s;i=null;let r=null;for(t=0;n;){t++;let a=n,o=0;for(let l=0;l<e&&(o++,a=a.nextZ,!!a);l++);let c=e;for(;o>0||c>0&&a;)o!==0&&(c===0||!a||n.z<=a.z)?(s=n,n=n.nextZ,o--):(s=a,a=a.nextZ,c--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;n=a}r.nextZ=null,e*=2}while(t>1);return i}function Ho(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function ad(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function xh(i,t,e,n,s,r,a,o){return(s-a)*(t-o)>=(i-a)*(r-o)&&(i-a)*(n-o)>=(e-a)*(t-o)&&(e-a)*(r-o)>=(s-a)*(n-o)}function rs(i,t,e,n,s,r,a,o){return!(i===a&&t===o)&&xh(i,t,e,n,s,r,a,o)}function od(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!ld(i,t)&&(As(i,t)&&As(t,i)&&cd(i,t)&&(fe(i.prev,i,t.prev)||fe(i,t.prev,t))||Wi(i,t)&&fe(i.prev,i,i.next)>0&&fe(t.prev,t,t.next)>0)}function fe(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Wi(i,t){return i.x===t.x&&i.y===t.y}function yh(i,t,e,n){let s=xr(fe(i,t,e)),r=xr(fe(i,t,n)),a=xr(fe(e,n,i)),o=xr(fe(e,n,t));return!!(s!==r&&a!==o||s===0&&_r(i,e,t)||r===0&&_r(i,n,t)||a===0&&_r(e,i,n)||o===0&&_r(e,t,n))}function _r(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function xr(i){return i>0?1:i<0?-1:0}function ld(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&yh(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function As(i,t){return fe(i.prev,i,i.next)<0?fe(i,t,i.next)>=0&&fe(i,i.prev,t)>=0:fe(i,t,i.prev)<0||fe(i,i.next,t)<0}function cd(i,t){let e=i,n=!1,s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function vh(i,t){let e=Wo(i.i,i.x,i.y),n=Wo(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function Tc(i,t,e,n){let s=Wo(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function ws(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Wo(i,t,e){return{i,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function hd(i,t,e,n){let s=0;for(let r=t,a=e-n;r<e;r+=n)s+=(i[a]-i[r])*(i[r+1]+i[a+1]),a=r;return s}var Xo=class{static triangulate(t,e,n=2){return Zu(t,e,n)}},Ve=class i{static area(t){let e=t.length,n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return i.area(t)<0}static triangulateShape(t,e){let n=[],s=[],r=[];Ec(t),Ac(n,t);let a=t.length;e.forEach(Ec);for(let c=0;c<e.length;c++)s.push(a),a+=e[c].length,Ac(n,e[c]);let o=Xo.triangulate(n,s);for(let c=0;c<o.length;c+=3)r.push(o.slice(c,c+3));return r}};function Ec(i){let t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function Ac(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}var Cs=class i extends Le{constructor(t=new Hi([new yt(.5,.5),new yt(-.5,.5),new yt(-.5,-.5),new yt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let n=this,s=[],r=[];for(let o=0,c=t.length;o<c;o++){let l=t[o];a(l)}this.setAttribute("position",new oe(s,3)),this.setAttribute("uv",new oe(r,2)),this.computeVertexNormals();function a(o){let c=[],l=e.curveSegments!==void 0?e.curveSegments:12,u=e.steps!==void 0?e.steps:1,d=e.depth!==void 0?e.depth:1,h=e.bevelEnabled!==void 0?e.bevelEnabled:!0,p=e.bevelThickness!==void 0?e.bevelThickness:.2,x=e.bevelSize!==void 0?e.bevelSize:p-.1,S=e.bevelOffset!==void 0?e.bevelOffset:0,g=e.bevelSegments!==void 0?e.bevelSegments:3,f=e.extrudePath,L=e.UVGenerator!==void 0?e.UVGenerator:ud,w,v=!1,R,A,N,y;if(f){w=f.getSpacedPoints(u),v=!0,h=!1;let T=f.isCatmullRomCurve3?f.closed:!1;R=f.computeFrenetFrames(u,T),A=new W,N=new W,y=new W}h||(g=0,p=0,x=0,S=0);let C=o.extractPoints(l),z=C.shape,O=C.holes;if(!Ve.isClockWise(z)){z=z.reverse();for(let T=0,F=O.length;T<F;T++){let I=O[T];Ve.isClockWise(I)&&(O[T]=I.reverse())}}function lt(T){let I=10000000000000001e-36,$=T[0];for(let K=1;K<=T.length;K++){let rt=K%T.length,gt=T[rt],_t=gt.x-$.x,H=gt.y-$.y,m=_t*_t+H*H,j=Math.max(Math.abs(gt.x),Math.abs(gt.y),Math.abs($.x),Math.abs($.y)),ft=I*j*j;if(m<=ft){T.splice(rt,1),K--;continue}$=gt}}lt(z),O.forEach(lt);let ot=O.length,J=z;for(let T=0;T<ot;T++){let F=O[T];z=z.concat(F)}function it(T,F,I){return F||qt("ExtrudeGeometry: vec does not exist"),T.clone().addScaledVector(F,I)}let Y=z.length;function V(T,F,I){let $,K,rt,gt=T.x-F.x,_t=T.y-F.y,H=I.x-T.x,m=I.y-T.y,j=gt*gt+_t*_t,ft=gt*m-_t*H;if(Math.abs(ft)>Number.EPSILON){let b=Math.sqrt(j),_=Math.sqrt(H*H+m*m),U=F.x-_t/b,Z=F.y+gt/b,st=I.x-m/_,Mt=I.y+H/_,St=((st-U)*m-(Mt-Z)*H)/(gt*m-_t*H);$=U+gt*St-T.x,K=Z+_t*St-T.y;let at=$*$+K*K;if(at<=2)return new yt($,K);rt=Math.sqrt(at/2)}else{let b=!1;gt>Number.EPSILON?H>Number.EPSILON&&(b=!0):gt<-Number.EPSILON?H<-Number.EPSILON&&(b=!0):Math.sign(_t)===Math.sign(m)&&(b=!0),b?($=-_t,K=gt,rt=Math.sqrt(j)):($=gt,K=_t,rt=Math.sqrt(j/2))}return new yt($/rt,K/rt)}let pt=[];for(let T=0,F=J.length,I=F-1,$=T+1;T<F;T++,I++,$++)I===F&&(I=0),$===F&&($=0),pt[T]=V(J[T],J[I],J[$]);let mt=[],vt,Ct=pt.concat();for(let T=0,F=ot;T<F;T++){let I=O[T];vt=[];for(let $=0,K=I.length,rt=K-1,gt=$+1;$<K;$++,rt++,gt++)rt===K&&(rt=0),gt===K&&(gt=0),vt[$]=V(I[$],I[rt],I[gt]);mt.push(vt),Ct=Ct.concat(vt)}let Xt;if(g===0)Xt=Ve.triangulateShape(J,O);else{let T=[],F=[];for(let I=0;I<g;I++){let $=I/g,K=p*Math.cos($*Math.PI/2),rt=x*Math.sin($*Math.PI/2)+S;for(let gt=0,_t=J.length;gt<_t;gt++){let H=it(J[gt],pt[gt],rt);P(H.x,H.y,-K),$===0&&T.push(H)}for(let gt=0,_t=ot;gt<_t;gt++){let H=O[gt];vt=mt[gt];let m=[];for(let j=0,ft=H.length;j<ft;j++){let b=it(H[j],vt[j],rt);P(b.x,b.y,-K),$===0&&m.push(b)}$===0&&F.push(m)}}Xt=Ve.triangulateShape(T,F)}let Jt=Xt.length,Yt=x+S;for(let T=0;T<Y;T++){let F=h?it(z[T],Ct[T],Yt):z[T];v?(N.copy(R.normals[0]).multiplyScalar(F.x),A.copy(R.binormals[0]).multiplyScalar(F.y),y.copy(w[0]).add(N).add(A),P(y.x,y.y,y.z)):P(F.x,F.y,0)}for(let T=1;T<=u;T++)for(let F=0;F<Y;F++){let I=h?it(z[F],Ct[F],Yt):z[F];v?(N.copy(R.normals[T]).multiplyScalar(I.x),A.copy(R.binormals[T]).multiplyScalar(I.y),y.copy(w[T]).add(N).add(A),P(y.x,y.y,y.z)):P(I.x,I.y,d/u*T)}for(let T=g-1;T>=0;T--){let F=T/g,I=p*Math.cos(F*Math.PI/2),$=x*Math.sin(F*Math.PI/2)+S;for(let K=0,rt=J.length;K<rt;K++){let gt=it(J[K],pt[K],$);P(gt.x,gt.y,d+I)}for(let K=0,rt=O.length;K<rt;K++){let gt=O[K];vt=mt[K];for(let _t=0,H=gt.length;_t<H;_t++){let m=it(gt[_t],vt[_t],$);v?P(m.x,m.y+w[u-1].y,w[u-1].x+I):P(m.x,m.y,d+I)}}}ct(),X();function ct(){let T=s.length/3;if(h){let F=0,I=Y*F;for(let $=0;$<Jt;$++){let K=Xt[$];E(K[2]+I,K[1]+I,K[0]+I)}F=u+g*2,I=Y*F;for(let $=0;$<Jt;$++){let K=Xt[$];E(K[0]+I,K[1]+I,K[2]+I)}}else{for(let F=0;F<Jt;F++){let I=Xt[F];E(I[2],I[1],I[0])}for(let F=0;F<Jt;F++){let I=Xt[F];E(I[0]+Y*u,I[1]+Y*u,I[2]+Y*u)}}n.addGroup(T,s.length/3-T,0)}function X(){let T=s.length/3,F=0;D(J,F),F+=J.length;for(let I=0,$=O.length;I<$;I++){let K=O[I];D(K,F),F+=K.length}n.addGroup(T,s.length/3-T,1)}function D(T,F){let I=T.length;for(;--I>=0;){let $=I,K=I-1;K<0&&(K=T.length-1);for(let rt=0,gt=u+g*2;rt<gt;rt++){let _t=Y*rt,H=Y*(rt+1),m=F+$+_t,j=F+K+_t,ft=F+K+H,b=F+$+H;B(m,j,ft,b)}}}function P(T,F,I){c.push(T),c.push(F),c.push(I)}function E(T,F,I){et(T),et(F),et(I);let $=s.length/3,K=L.generateTopUV(n,s,$-3,$-2,$-1);ut(K[0]),ut(K[1]),ut(K[2])}function B(T,F,I,$){et(T),et(F),et($),et(F),et(I),et($);let K=s.length/3,rt=L.generateSideWallUV(n,s,K-6,K-3,K-2,K-1);ut(rt[0]),ut(rt[1]),ut(rt[3]),ut(rt[1]),ut(rt[2]),ut(rt[3])}function et(T){s.push(c[T*3+0]),s.push(c[T*3+1]),s.push(c[T*3+2])}function ut(T){r.push(T.x),r.push(T.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return dd(e,n,t)}static fromJSON(t,e){let n=[];for(let r=0,a=t.shapes.length;r<a;r++){let o=e[t.shapes[r]];n.push(o)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new Go[s.type]().fromJSON(s)),new i(n,t.options)}},ud={generateTopUV:function(i,t,e,n,s){let r=t[e*3],a=t[e*3+1],o=t[n*3],c=t[n*3+1],l=t[s*3],u=t[s*3+1];return[new yt(r,a),new yt(o,c),new yt(l,u)]},generateSideWallUV:function(i,t,e,n,s,r){let a=t[e*3],o=t[e*3+1],c=t[e*3+2],l=t[n*3],u=t[n*3+1],d=t[n*3+2],h=t[s*3],p=t[s*3+1],x=t[s*3+2],S=t[r*3],g=t[r*3+1],f=t[r*3+2];return Math.abs(o-u)<Math.abs(a-l)?[new yt(a,1-c),new yt(l,1-d),new yt(h,1-x),new yt(S,1-f)]:[new yt(o,1-c),new yt(u,1-d),new yt(p,1-x),new yt(g,1-f)]}};function dd(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){let r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var Rs=class i extends Le{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,a=e/2,o=Math.floor(n),c=Math.floor(s),l=o+1,u=c+1,d=t/o,h=e/c,p=[],x=[],S=[],g=[];for(let f=0;f<u;f++){let L=f*h-a;for(let w=0;w<l;w++){let v=w*d-r;x.push(v,-L,0),S.push(0,0,1),g.push(w/o),g.push(1-f/c)}}for(let f=0;f<c;f++)for(let L=0;L<o;L++){let w=L+l*f,v=L+l*(f+1),R=L+1+l*(f+1),A=L+1+l*f;p.push(w,v,A),p.push(v,R,A)}this.setIndex(p),this.setAttribute("position",new oe(x,3)),this.setAttribute("normal",new oe(S,3)),this.setAttribute("uv",new oe(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var Ls=class i extends Le{constructor(t=new Hi([new yt(0,.5),new yt(-.5,-.5),new yt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};let n=[],s=[],r=[],a=[],o=0,c=0;if(Array.isArray(t)===!1)l(t);else for(let u=0;u<t.length;u++)l(t[u]),this.addGroup(o,c,u),o+=c,c=0;this.setIndex(n),this.setAttribute("position",new oe(s,3)),this.setAttribute("normal",new oe(r,3)),this.setAttribute("uv",new oe(a,2));function l(u){let d=s.length/3,h=u.extractPoints(e),p=h.shape,x=h.holes;Ve.isClockWise(p)===!1&&(p=p.reverse());for(let g=0,f=x.length;g<f;g++){let L=x[g];Ve.isClockWise(L)===!0&&(x[g]=L.reverse())}let S=Ve.triangulateShape(p,x);for(let g=0,f=x.length;g<f;g++){let L=x[g];p=p.concat(L)}for(let g=0,f=p.length;g<f;g++){let L=p[g];s.push(L.x,L.y,0),r.push(0,0,1),a.push(L.x,L.y)}for(let g=0,f=S.length;g<f;g++){let L=S[g],w=L[0]+d,v=L[1]+d,R=L[2]+d;n.push(w,v,R),c+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes;return fd(e,t)}static fromJSON(t,e){let n=[];for(let s=0,r=t.shapes.length;s<r;s++){let a=e[t.shapes[s]];n.push(a)}return new i(n,t.curveSegments)}};function fd(i,t){if(t.shapes=[],Array.isArray(i))for(let e=0,n=i.length;e<n;e++){let s=i[e];t.shapes.push(s.uuid)}else t.shapes.push(i.uuid);return t}var Ps=class i extends Le{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let c=Math.min(a+o,Math.PI),l=0,u=[],d=new W,h=new W,p=[],x=[],S=[],g=[];for(let f=0;f<=n;f++){let L=[],w=f/n,v=a+w*o,R=t*Math.cos(v),A=Math.sqrt(t*t-R*R),N=0;f===0&&a===0?N=.5/e:f===n&&c===Math.PI&&(N=-.5/e);for(let y=0;y<=e;y++){let C=y/e,z=s+C*r;d.x=-A*Math.cos(z),d.y=R,d.z=A*Math.sin(z),x.push(d.x,d.y,d.z),h.copy(d).normalize(),S.push(h.x,h.y,h.z),g.push(C+N,1-w),L.push(l++)}u.push(L)}for(let f=0;f<n;f++)for(let L=0;L<e;L++){let w=u[f][L+1],v=u[f][L],R=u[f+1][L],A=u[f+1][L+1];(f!==0||a>0)&&p.push(w,v,A),(f!==n-1||c<Math.PI)&&p.push(v,R,A)}this.setIndex(p),this.setAttribute("position",new oe(x,3)),this.setAttribute("normal",new oe(S,3)),this.setAttribute("uv",new oe(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function pi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(wc(s))s.isRenderTargetTexture?(Wt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(wc(s[0])){let r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Pe(i){let t={};for(let e=0;e<i.length;e++){let n=pi(i[e]);for(let s in n)t[s]=n[s]}return t}function wc(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function pd(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function vl(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ee.workingColorSpace}var Mh={clone:pi,merge:Pe},md=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,gd=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,qe=class extends qn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=md,this.fragmentShader=gd,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=pi(t.uniforms),this.uniformsGroups=pd(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let a=this.uniforms[s].value;a&&a.isTexture?e.uniforms[s]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[s]={type:"m4",value:a.toArray()}:e.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Kt().setHex(s.value);break;case"v2":this.uniforms[n].value=new yt().fromArray(s.value);break;case"v3":this.uniforms[n].value=new W().fromArray(s.value);break;case"v4":this.uniforms[n].value=new de().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Gt().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ue().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},qr=class extends qe{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}};var Is=class extends qn{constructor(t){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Kt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Kt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ya,this.normalScale=new yt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=oa,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.envMapIntensity=t.envMapIntensity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},Yr=class extends qn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=sh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},Zr=class extends qn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function yr(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}var Yn=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let a;e:{i:if(!(t<s)){for(let o=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(r=s,s=e[++n],t<s)break t}a=e.length;break e}if(!(t>=r)){let o=e[1];t<o&&(n=2,r=o);for(let c=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===c)break;if(s=r,r=e[--n-1],t>=r)break t}a=n,n=0;break e}break n}for(;n<a;){let o=n+a>>>1;t<e[o]?a=o:n=o+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let a=0;a!==s;++a)e[a]=n[r+a];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Jr=class extends Yn{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Oo,endingEnd:Oo}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,a=t+1,o=s[r],c=s[a];if(o===void 0)switch(this.getSettings_().endingStart){case Bo:r=t,o=2*e-n;break;case zo:r=s.length-2,o=e+s[r]-s[r+1];break;default:r=t,o=n}if(c===void 0)switch(this.getSettings_().endingEnd){case Bo:a=t,c=2*n-e;break;case zo:a=1,c=n+s[1]-s[0];break;default:a=t-1,c=e}let l=(n-e)*.5,u=this.valueSize;this._weightPrev=l/(e-o),this._weightNext=l/(c-n),this._offsetPrev=r*u,this._offsetNext=a*u}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,u=this._offsetPrev,d=this._offsetNext,h=this._weightPrev,p=this._weightNext,x=(n-e)/(s-e),S=x*x,g=S*x,f=-h*g+2*h*S-h*x,L=(1+h)*g+(-1.5-2*h)*S+(-.5+h)*x+1,w=(-1-p)*g+(1.5+p)*S+.5*x,v=p*g-p*S;for(let R=0;R!==o;++R)r[R]=f*a[u+R]+L*a[l+R]+w*a[c+R]+v*a[d+R];return r}},$r=class extends Yn{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,u=(n-e)/(s-e),d=1-u;for(let h=0;h!==o;++h)r[h]=a[l+h]*d+a[c+h]*u;return r}},Kr=class extends Yn{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},jr=class extends Yn{interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=t*o,l=c-o,u=this.inTangents,d=this.outTangents;if(!u||!d){let x=(n-e)/(s-e),S=1-x;for(let g=0;g!==o;++g)r[g]=a[l+g]*S+a[c+g]*x;return r}let h=o*2,p=t-1;for(let x=0;x!==o;++x){let S=a[l+x],g=a[c+x],f=p*h+x*2,L=d[f],w=d[f+1],v=t*h+x*2,R=u[v],A=u[v+1],N=(n-e)/(s-e),y,C,z,O,k;for(let lt=0;lt<8;lt++){y=N*N,C=y*N,z=1-N,O=z*z,k=O*z;let J=k*e+3*O*N*L+3*z*y*R+C*s-n;if(Math.abs(J)<1e-10)break;let it=3*O*(L-e)+6*z*N*(R-L)+3*y*(s-R);if(Math.abs(it)<1e-10)break;N=N-J/it,N=Math.max(0,Math.min(1,N))}r[x]=k*S+3*O*N*w+3*z*y*A+C*g}return r}},Ye=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=yr(e,this.TimeBufferType),this.values=yr(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:yr(t.times,Array),values:yr(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s)}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new Kr(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new $r(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Jr(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new jr(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case ls:e=this.InterpolantFactoryMethodDiscrete;break;case Ir:e=this.InterpolantFactoryMethodLinear;break;case Sr:e=this.InterpolantFactoryMethodSmooth;break;case Fo:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Wt("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ls;case this.InterpolantFactoryMethodLinear:return Ir;case this.InterpolantFactoryMethodSmooth:return Sr;case this.InterpolantFactoryMethodBezier:return Fo}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t}return this}trim(t,e){let n=this.times,s=n.length,r=0,a=s-1;for(;r!==s&&n[r]<t;)++r;for(;a!==-1&&n[a]>e;)--a;if(++a,r!==0||a!==s){r>=a&&(a=Math.max(a,1),r=a-1);let o=this.getValueSize();this.times=n.slice(r,a),this.values=this.values.slice(r*o,a*o)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(qt("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(qt("KeyframeTrack: Track is empty.",this),t=!1);let a=null;for(let o=0;o!==r;o++){let c=n[o];if(typeof c=="number"&&isNaN(c)){qt("KeyframeTrack: Time is not a valid number.",this,o,c),t=!1;break}if(a!==null&&a>c){qt("KeyframeTrack: Out of order keys.",this,o,c,a),t=!1;break}a=c}if(s!==void 0&&Mu(s))for(let o=0,c=s.length;o!==c;++o){let l=s[o];if(isNaN(l)){qt("KeyframeTrack: Value is not a valid number.",this,o,l),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Sr,r=t.length-1,a=1;for(let o=1;o<r;++o){let c=!1,l=t[o],u=t[o+1];if(l!==u&&(o!==1||l!==t[0]))if(s)c=!0;else{let d=o*n,h=d-n,p=d+n;for(let x=0;x!==n;++x){let S=e[d+x];if(S!==e[h+x]||S!==e[p+x]){c=!0;break}}}if(c){if(o!==a){t[a]=t[o];let d=o*n,h=a*n;for(let p=0;p!==n;++p)e[h+p]=e[d+p]}++a}}if(r>0){t[a]=t[r];for(let o=r*n,c=a*n,l=0;l!==n;++l)e[c+l]=e[o+l];++a}return a!==t.length?(this.times=t.slice(0,a),this.values=e.slice(0,a*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,s}};Ye.prototype.ValueTypeName="";Ye.prototype.TimeBufferType=Float32Array;Ye.prototype.ValueBufferType=Float32Array;Ye.prototype.DefaultInterpolation=Ir;var Zn=class extends Ye{constructor(t,e,n){super(t,e,n)}};Zn.prototype.ValueTypeName="bool";Zn.prototype.ValueBufferType=Array;Zn.prototype.DefaultInterpolation=ls;Zn.prototype.InterpolantFactoryMethodLinear=void 0;Zn.prototype.InterpolantFactoryMethodSmooth=void 0;var Qr=class extends Ye{constructor(t,e,n,s){super(t,e,n,s)}};Qr.prototype.ValueTypeName="color";var ta=class extends Ye{constructor(t,e,n,s){super(t,e,n,s)}};ta.prototype.ValueTypeName="number";var ea=class extends Yn{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,a=this.sampleValues,o=this.valueSize,c=(n-e)/(s-e),l=t*o;for(let u=l+o;l!==u;l+=4)mn.slerpFlat(r,0,a,l-o,a,l,c);return r}},Ns=class extends Ye{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new ea(this.times,this.values,this.getValueSize(),t)}};Ns.prototype.ValueTypeName="quaternion";Ns.prototype.InterpolantFactoryMethodSmooth=void 0;var Jn=class extends Ye{constructor(t,e,n){super(t,e,n)}};Jn.prototype.ValueTypeName="string";Jn.prototype.ValueBufferType=Array;Jn.prototype.DefaultInterpolation=ls;Jn.prototype.InterpolantFactoryMethodLinear=void 0;Jn.prototype.InterpolantFactoryMethodSmooth=void 0;var na=class extends Ye{constructor(t,e,n,s){super(t,e,n,s)}};na.prototype.ValueTypeName="vector";var qo={enabled:!1,files:{},add:function(i,t){this.enabled!==!1&&(Cc(i)||(this.files[i]=t))},get:function(i){if(this.enabled!==!1&&!Cc(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function Cc(i){try{let t=i.slice(i.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch{return!1}}var ia=class{constructor(t,e,n){let s=this,r=!1,a=0,o=0,c,l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(u){o++,r===!1&&s.onStart!==void 0&&s.onStart(u,a,o),r=!0},this.itemEnd=function(u){a++,s.onProgress!==void 0&&s.onProgress(u,a,o),a===o&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return u=u.normalize("NFC"),c?c(u):u},this.setURLModifier=function(u){return c=u,this},this.addHandler=function(u,d){return l.push(u,d),this},this.removeHandler=function(u){let d=l.indexOf(u);return d!==-1&&l.splice(d,2),this},this.getHandler=function(u){for(let d=0,h=l.length;d<h;d+=2){let p=l[d],x=l[d+1];if(p.global&&(p.lastIndex=0),p.test(u))return x}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Sh=new ia,di=class{constructor(t){this.manager=t!==void 0?t:Sh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};di.DEFAULT_MATERIAL_NAME="__DEFAULT";var Cn={},Yo=class extends Error{constructor(t,e){super(t),this.response=e}},Ds=class extends di{constructor(t){super(t),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(t,e,n,s){t===void 0&&(t=""),this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);let r=qo.get(`file:${t}`);if(r!==void 0){this.manager.itemStart(t),setTimeout(()=>{e&&e(r),this.manager.itemEnd(t)},0);return}if(Cn[t]!==void 0){Cn[t].push({onLoad:e,onProgress:n,onError:s});return}Cn[t]=[],Cn[t].push({onLoad:e,onProgress:n,onError:s});let a=new Request(t,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,c=this.responseType;fetch(a).then(l=>{if(l.status===200||l.status===0){if(l.status===0&&Wt("FileLoader: HTTP Status 0 received."),typeof ReadableStream=="undefined"||l.body===void 0||l.body.getReader===void 0)return l;let u=Cn[t],d=l.body.getReader(),h=l.headers.get("X-File-Size")||l.headers.get("Content-Length"),p=h?parseInt(h):0,x=p!==0,S=0,g=new ReadableStream({start(f){L();function L(){d.read().then(({done:w,value:v})=>{if(w)f.close();else{S+=v.byteLength;let R=new ProgressEvent("progress",{lengthComputable:x,loaded:S,total:p});for(let A=0,N=u.length;A<N;A++){let y=u[A];y.onProgress&&y.onProgress(R)}f.enqueue(v),L()}},w=>{f.error(w)})}}});return new Response(g)}else throw new Yo(`fetch for "${l.url}" responded with ${l.status}: ${l.statusText}`,l)}).then(l=>{switch(c){case"arraybuffer":return l.arrayBuffer();case"blob":return l.blob();case"document":return l.text().then(u=>new DOMParser().parseFromString(u,o));case"json":return l.json();default:if(o==="")return l.text();{let d=/charset="?([^;"\s]*)"?/i.exec(o),h=d&&d[1]?d[1].toLowerCase():void 0,p=new TextDecoder(h);return l.arrayBuffer().then(x=>p.decode(x))}}}).then(l=>{qo.add(`file:${t}`,l);let u=Cn[t];delete Cn[t];for(let d=0,h=u.length;d<h;d++){let p=u[d];p.onLoad&&p.onLoad(l)}}).catch(l=>{let u=Cn[t];if(u===void 0)throw this.manager.itemError(t),l;delete Cn[t];for(let d=0,h=u.length;d<h;d++){let p=u[d];p.onError&&p.onError(l)}this.manager.itemError(t)}).finally(()=>{this.manager.itemEnd(t)}),this.manager.itemStart(t)}setResponseType(t){return this.responseType=t,this}setMimeType(t){return this.mimeType=t,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Us=class extends Ne{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Kt(t),this.intensity=e}dispose(){this.dispatchEvent({type:"dispose"})}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}};var Uo=new ue,Rc=new W,Lc=new W,Zo=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new yt(512,512),this.mapType=Oe,this.map=null,this.mapPass=null,this.matrix=new ue,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ki,this._frameExtents=new yt(1,1),this._viewportCount=1,this._viewports=[new de(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera,n=this.matrix;Rc.setFromMatrixPosition(t.matrixWorld),e.position.copy(Rc),Lc.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Lc),e.updateMatrixWorld(),Uo.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Uo,e.coordinateSystem,e.reversedDepth),e.coordinateSystem===Ui||e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Uo)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},vr=new W,Mr=new mn,hn=new W,Fs=class extends Ne{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ue,this.projectionMatrix=new ue,this.projectionMatrixInverse=new ue,this.coordinateSystem=nn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(vr,Mr,hn),hn.x===1&&hn.y===1&&hn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(vr,Mr,hn.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(vr,Mr,hn),hn.x===1&&hn.y===1&&hn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(vr,Mr,hn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Gn=new W,Pc=new yt,Ic=new yt,Fe=class extends Fs{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Nr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(lo*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Nr*2*Math.atan(Math.tan(lo*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){Gn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Gn.x,Gn.y).multiplyScalar(-t/Gn.z),Gn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Gn.x,Gn.y).multiplyScalar(-t/Gn.z)}getViewSize(t,e){return this.getViewBounds(t,Pc,Ic),e.subVectors(Ic,Pc)}setViewOffset(t,e,n,s,r,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(lo*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,a=this.view;if(this.view!==null&&this.view.enabled){let c=a.fullWidth,l=a.fullHeight;r+=a.offsetX*s/c,e-=a.offsetY*n/l,s*=a.width/c,n*=a.height/l}let o=this.filmOffset;o!==0&&(r+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var $n=class extends Fs{constructor(t=-1,e=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,a=n+t,o=s+e,c=s-e;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,a=r+l*this.view.width,o-=u*this.view.offsetY,c=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},Jo=class extends Zo{constructor(){super(new $n(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Os=class extends Us{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ne.DEFAULT_UP),this.updateMatrix(),this.target=new Ne,this.shadow=new Jo}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}},Bs=class extends Us{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var Li=-90,Pi=1,sa=class extends Ne{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Fe(Li,Pi,t,e);s.layers=this.layers,this.add(s);let r=new Fe(Li,Pi,t,e);r.layers=this.layers,this.add(r);let a=new Fe(Li,Pi,t,e);a.layers=this.layers,this.add(a);let o=new Fe(Li,Pi,t,e);o.layers=this.layers,this.add(o);let c=new Fe(Li,Pi,t,e);c.layers=this.layers,this.add(c);let l=new Fe(Li,Pi,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,a,o,c]=e;for(let l of e)this.remove(l);if(t===nn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Ui)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,a,o,c,l,u]=this.children,d=t.getRenderTarget(),h=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),x=t.xr.enabled;t.xr.enabled=!1;let S=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let g=!1;t.isWebGLRenderer===!0?g=t.state.buffers.depth.getReversed():g=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,2,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,3,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),t.setRenderTarget(n,4,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),n.texture.generateMipmaps=S,t.setRenderTarget(n,5,s),g&&t.autoClear===!1&&t.clearDepth(),t.render(e,u),t.setRenderTarget(d,h,p),t.xr.enabled=x,n.texture.needsPMREMUpdate=!0}},ra=class extends Fe{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var Ml="\\[\\]\\.:\\/",_d=new RegExp("["+Ml+"]","g"),Sl="[^"+Ml+"]",xd="[^"+Ml.replace("\\.","")+"]",yd=/((?:WC+[\/:])*)/.source.replace("WC",Sl),vd=/(WCOD+)?/.source.replace("WCOD",xd),Md=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Sl),Sd=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Sl),bd=new RegExp("^"+yd+vd+Md+Sd+"$"),Td=["material","materials","bones","map"],$o=class{constructor(t,e,n){let s=n||he.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},he=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(_d,"")}static parseTrackName(t){let e=bd.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);Td.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let a=0;a<r.length;a++){let o=r[a];if(o.name===e||o.uuid===e)return o;let c=n(o.children);if(c)return c}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Wt("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let l=e.objectIndex;switch(n){case"materials":if(!t.material){qt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){qt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){qt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let u=0;u<t.length;u++)if(t[u].name===l){l=u;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){qt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){qt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){qt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(l!==void 0){if(t[l]===void 0){qt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[l]}}let a=t[s];if(a===void 0){let l=e.nodeName;qt("PropertyBinding: Trying to update property for track: "+l+"."+s+" but it wasn't found.",t);return}let o=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?o=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){qt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){qt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}c=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=r}else a.fromArray!==void 0&&a.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(c=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=s;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};he.Composite=$o;he.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};he.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};he.prototype.GetterByBindingType=[he.prototype._getValue_direct,he.prototype._getValue_array,he.prototype._getValue_arrayElement,he.prototype._getValue_toArray];he.prototype.SetterByBindingTypeAndVersioning=[[he.prototype._setValue_direct,he.prototype._setValue_direct_setNeedsUpdate,he.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[he.prototype._setValue_array,he.prototype._setValue_array_setNeedsUpdate,he.prototype._setValue_array_setMatrixWorldNeedsUpdate],[he.prototype._setValue_arrayElement,he.prototype._setValue_arrayElement_setNeedsUpdate,he.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[he.prototype._setValue_fromArray,he.prototype._setValue_fromArray_setNeedsUpdate,he.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var S0=new Float32Array(1);var Cl=class Cl{constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};Cl.prototype.isMatrix2=!0;var Ko=Cl,Nc=new yt,Xi=class{constructor(t=new yt(1/0,1/0),e=new yt(-1/0,-1/0)){this.isBox2=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=Nc.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(t){return this.isEmpty()?t.set(0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Nc).distanceTo(t)}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}};var sn=class{constructor(){this.type="ShapePath",this.color=new Kt,this.subPaths=[],this.currentPath=null,this.userData={}}moveTo(t,e){return this.currentPath=new gn,this.subPaths.push(this.currentPath),this.currentPath.moveTo(t,e),this}lineTo(t,e){return this.currentPath.lineTo(t,e),this}quadraticCurveTo(t,e,n,s){return this.currentPath.quadraticCurveTo(t,e,n,s),this}bezierCurveTo(t,e,n,s,r,a){return this.currentPath.bezierCurveTo(t,e,n,s,r,a),this}splineThru(t){return this.currentPath.splineThru(t),this}toShapes(){function t(c,l){let u=!1,d=l.length;for(let h=0,p=d-1;h<d;p=h++){let x=l[h],S=l[p];x.y>c.y!=S.y>c.y&&c.x<(S.x-x.x)*(c.y-x.y)/(S.y-x.y)+x.x&&(u=!u)}return u}function e(c,l){let u=l.getCenter(new yt);if(t(u,c))return u;let d=u.y,h=[],p=c.length;for(let x=0;x<p;x++){let S=c[x],g=c[(x+1)%p];if(S.y>d!=g.y>d){let f=S.x+(d-S.y)*(g.x-S.x)/(g.y-S.y);h.push(f)}}return h.length>1&&(h.sort((x,S)=>x-S),u.x=(h[0]+h[1])/2),u}let n=this.userData.style&&this.userData.style.fillRule||"nonzero";n!=="nonzero"&&n!=="evenodd"&&(Wt('Fill-rule "'+n+'" is not supported, falling back to "nonzero".'),n="nonzero");let s=n==="nonzero"?(c=>c!==0):(c=>(c&1)!==0),r=[];for(let c of this.subPaths){let l=c.getPoints();if(l.length<3)continue;let u=Ve.area(l);if(u===0)continue;let d=new Xi;for(let h=0;h<l.length;h++)d.expandByPoint(l[h]);r.push({subPath:c,points:l,boundingBox:d,interiorPoint:e(l,d),absArea:Math.abs(u),winding:u<0?-1:1,container:null,exclude:!1,role:null})}r.sort((c,l)=>l.absArea-c.absArea);for(let c=0;c<r.length;c++){let l=r[c],u=0;for(let d=c-1;d>=0;d--){let h=r[d];if(h.boundingBox.containsBox(l.boundingBox)&&t(l.interiorPoint,h.points)){l.container=h.exclude?h.container:h,u=h.winding,l.winding+=u;break}}s(l.winding)===s(u)&&(l.exclude=!0)}for(let c of r)c.exclude||(c.role=c.container===null||c.container.role==="hole"?"outer":"hole");let a=[],o=new Map;for(let c of r){if(c.exclude||c.role!=="outer")continue;let l=new Hi;l.curves=c.subPath.curves,a.push(l),o.set(c,l)}for(let c of r){if(c.exclude||c.role!=="hole")continue;let l=o.get(c.container);if(!l)continue;let u=new gn;u.curves=c.subPath.curves,l.holes.push(u)}return a}};function bl(i,t,e,n){let s=Ed(n);switch(e){case pl:return i*t;case gl:return i*t/s.components*s.byteLength;case pa:return i*t/s.components*s.byteLength;case ti:return i*t*2/s.components*s.byteLength;case ma:return i*t*2/s.components*s.byteLength;case ml:return i*t*3/s.components*s.byteLength;case je:return i*t*4/s.components*s.byteLength;case ga:return i*t*4/s.components*s.byteLength;case Gs:case Hs:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Ws:case Xs:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case xa:case va:return Math.max(i,16)*Math.max(t,8)/4;case _a:case ya:return Math.max(i,8)*Math.max(t,8)/2;case Ma:case Sa:case Ta:case Ea:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case ba:case qs:case Aa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case wa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ca:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Ra:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case La:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Pa:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Ia:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case Na:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Da:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case Ua:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Fa:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case Oa:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Ba:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case za:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case ka:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Va:case Ga:case Ha:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Wa:case Xa:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Ys:case qa:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Ed(i){switch(i){case Oe:case hl:return{byteLength:1,components:1};case Yi:case ul:case xn:return{byteLength:2,components:1};case da:case fa:return{byteLength:2,components:4};case rn:case ua:case an:return{byteLength:4,components:1};case dl:case fl:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window!="undefined"&&(window.__THREE__?Wt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function Xh(){let i=null,t=!1,e=null,n=null;function s(r,a){e(r,a),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function wd(i){let t=new WeakMap;function e(o,c){let l=o.array,u=o.usage,d=l.byteLength,h=i.createBuffer();i.bindBuffer(c,h),i.bufferData(c,l,u),o.onUploadCallback();let p;if(l instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array!="undefined"&&l instanceof Float16Array)p=i.HALF_FLOAT;else if(l instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)p=i.SHORT;else if(l instanceof Uint32Array)p=i.UNSIGNED_INT;else if(l instanceof Int32Array)p=i.INT;else if(l instanceof Int8Array)p=i.BYTE;else if(l instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:h,type:p,bytesPerElement:l.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,c,l){let u=c.array,d=c.updateRanges;if(i.bindBuffer(l,o),d.length===0)i.bufferSubData(l,0,u);else{d.sort((p,x)=>p.start-x.start);let h=0;for(let p=1;p<d.length;p++){let x=d[h],S=d[p];S.start<=x.start+x.count+1?x.count=Math.max(x.count,S.start+S.count-x.start):(++h,d[h]=S)}d.length=h+1;for(let p=0,x=d.length;p<x;p++){let S=d[p];i.bufferSubData(l,S.start*u.BYTES_PER_ELEMENT,u,S.start,S.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);let c=t.get(o);c&&(i.deleteBuffer(c.buffer),t.delete(o))}function a(o,c){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let u=t.get(o);(!u||u.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let l=t.get(o);if(l===void 0)t.set(o,e(o,c));else if(l.version<o.version){if(l.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,o,c),l.version=o.version}}return{get:s,remove:r,update:a}}var Cd=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Rd=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Ld=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Pd=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Id=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Nd=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Dd=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ud=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Fd=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Od=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Bd=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,zd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,kd=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Vd=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Gd=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Hd=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Wd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Xd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,qd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Yd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Zd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Jd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,$d=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Kd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,jd=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Qd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,tf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ef=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,nf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,sf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,rf="gl_FragColor = linearToOutputTexel( gl_FragColor );",af=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,of=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,lf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,cf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,hf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,uf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,df=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,ff=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,pf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,mf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gf=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,_f=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,xf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,yf=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,vf=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Mf=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Sf=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,bf=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Tf=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Ef=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Af=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,wf=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Cf=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Rf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Lf=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Pf=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,If=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Nf=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Df=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Uf=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ff=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Of=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Bf=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,zf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,kf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Vf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Gf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Hf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Wf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Xf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,qf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Yf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Zf=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Jf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,$f=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Kf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,jf=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Qf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,tp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,ep=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,np=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ip=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,sp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,rp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,ap=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,op=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,lp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,cp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,hp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,up=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,dp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,fp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,pp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,mp=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,gp=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,_p=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,xp=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,yp=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,vp=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Mp=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Sp=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,bp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Tp=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ep=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ap=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,wp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Cp=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Rp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Lp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Pp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Ip=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Np=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Dp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Up=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Fp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Op=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Bp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,zp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,kp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Vp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Gp=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Hp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Wp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,qp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Yp=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Zp=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,$p=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Kp=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jp=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Qp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,tm=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,em=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,nm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,im=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,sm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,rm=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,am=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,om=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,lm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,jt={alphahash_fragment:Cd,alphahash_pars_fragment:Rd,alphamap_fragment:Ld,alphamap_pars_fragment:Pd,alphatest_fragment:Id,alphatest_pars_fragment:Nd,aomap_fragment:Dd,aomap_pars_fragment:Ud,batching_pars_vertex:Fd,batching_vertex:Od,begin_vertex:Bd,beginnormal_vertex:zd,bsdfs:kd,iridescence_fragment:Vd,bumpmap_pars_fragment:Gd,clipping_planes_fragment:Hd,clipping_planes_pars_fragment:Wd,clipping_planes_pars_vertex:Xd,clipping_planes_vertex:qd,color_fragment:Yd,color_pars_fragment:Zd,color_pars_vertex:Jd,color_vertex:$d,common:Kd,cube_uv_reflection_fragment:jd,defaultnormal_vertex:Qd,displacementmap_pars_vertex:tf,displacementmap_vertex:ef,emissivemap_fragment:nf,emissivemap_pars_fragment:sf,colorspace_fragment:rf,colorspace_pars_fragment:af,envmap_fragment:of,envmap_common_pars_fragment:lf,envmap_pars_fragment:cf,envmap_pars_vertex:hf,envmap_physical_pars_fragment:Mf,envmap_vertex:uf,fog_vertex:df,fog_pars_vertex:ff,fog_fragment:pf,fog_pars_fragment:mf,gradientmap_pars_fragment:gf,lightmap_pars_fragment:_f,lights_lambert_fragment:xf,lights_lambert_pars_fragment:yf,lights_pars_begin:vf,lights_toon_fragment:Sf,lights_toon_pars_fragment:bf,lights_phong_fragment:Tf,lights_phong_pars_fragment:Ef,lights_physical_fragment:Af,lights_physical_pars_fragment:wf,lights_fragment_begin:Cf,lights_fragment_maps:Rf,lights_fragment_end:Lf,lightprobes_pars_fragment:Pf,logdepthbuf_fragment:If,logdepthbuf_pars_fragment:Nf,logdepthbuf_pars_vertex:Df,logdepthbuf_vertex:Uf,map_fragment:Ff,map_pars_fragment:Of,map_particle_fragment:Bf,map_particle_pars_fragment:zf,metalnessmap_fragment:kf,metalnessmap_pars_fragment:Vf,morphinstance_vertex:Gf,morphcolor_vertex:Hf,morphnormal_vertex:Wf,morphtarget_pars_vertex:Xf,morphtarget_vertex:qf,normal_fragment_begin:Yf,normal_fragment_maps:Zf,normal_pars_fragment:Jf,normal_pars_vertex:$f,normal_vertex:Kf,normalmap_pars_fragment:jf,clearcoat_normal_fragment_begin:Qf,clearcoat_normal_fragment_maps:tp,clearcoat_pars_fragment:ep,iridescence_pars_fragment:np,opaque_fragment:ip,packing:sp,premultiplied_alpha_fragment:rp,project_vertex:ap,dithering_fragment:op,dithering_pars_fragment:lp,roughnessmap_fragment:cp,roughnessmap_pars_fragment:hp,shadowmap_pars_fragment:up,shadowmap_pars_vertex:dp,shadowmap_vertex:fp,shadowmask_pars_fragment:pp,skinbase_vertex:mp,skinning_pars_vertex:gp,skinning_vertex:_p,skinnormal_vertex:xp,specularmap_fragment:yp,specularmap_pars_fragment:vp,tonemapping_fragment:Mp,tonemapping_pars_fragment:Sp,transmission_fragment:bp,transmission_pars_fragment:Tp,uv_pars_fragment:Ep,uv_pars_vertex:Ap,uv_vertex:wp,worldpos_vertex:Cp,background_vert:Rp,background_frag:Lp,backgroundCube_vert:Pp,backgroundCube_frag:Ip,cube_vert:Np,cube_frag:Dp,depth_vert:Up,depth_frag:Fp,distance_vert:Op,distance_frag:Bp,equirect_vert:zp,equirect_frag:kp,linedashed_vert:Vp,linedashed_frag:Gp,meshbasic_vert:Hp,meshbasic_frag:Wp,meshlambert_vert:Xp,meshlambert_frag:qp,meshmatcap_vert:Yp,meshmatcap_frag:Zp,meshnormal_vert:Jp,meshnormal_frag:$p,meshphong_vert:Kp,meshphong_frag:jp,meshphysical_vert:Qp,meshphysical_frag:tm,meshtoon_vert:em,meshtoon_frag:nm,points_vert:im,points_frag:sm,shadow_vert:rm,shadow_frag:am,sprite_vert:om,sprite_frag:lm},Lt={common:{diffuse:{value:new Kt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Gt},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Gt}},envmap:{envMap:{value:null},envMapRotation:{value:new Gt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Gt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Gt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Gt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Gt},normalScale:{value:new yt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Gt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Gt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Gt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Gt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Kt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new W},probesMax:{value:new W},probesResolution:{value:new W}},points:{diffuse:{value:new Kt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0},uvTransform:{value:new Gt}},sprite:{diffuse:{value:new Kt(16777215)},opacity:{value:1},center:{value:new yt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Gt},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0}}},vn={basic:{uniforms:Pe([Lt.common,Lt.specularmap,Lt.envmap,Lt.aomap,Lt.lightmap,Lt.fog]),vertexShader:jt.meshbasic_vert,fragmentShader:jt.meshbasic_frag},lambert:{uniforms:Pe([Lt.common,Lt.specularmap,Lt.envmap,Lt.aomap,Lt.lightmap,Lt.emissivemap,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,Lt.fog,Lt.lights,{emissive:{value:new Kt(0)},envMapIntensity:{value:1}}]),vertexShader:jt.meshlambert_vert,fragmentShader:jt.meshlambert_frag},phong:{uniforms:Pe([Lt.common,Lt.specularmap,Lt.envmap,Lt.aomap,Lt.lightmap,Lt.emissivemap,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,Lt.fog,Lt.lights,{emissive:{value:new Kt(0)},specular:{value:new Kt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:jt.meshphong_vert,fragmentShader:jt.meshphong_frag},standard:{uniforms:Pe([Lt.common,Lt.envmap,Lt.aomap,Lt.lightmap,Lt.emissivemap,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,Lt.roughnessmap,Lt.metalnessmap,Lt.fog,Lt.lights,{emissive:{value:new Kt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag},toon:{uniforms:Pe([Lt.common,Lt.aomap,Lt.lightmap,Lt.emissivemap,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,Lt.gradientmap,Lt.fog,Lt.lights,{emissive:{value:new Kt(0)}}]),vertexShader:jt.meshtoon_vert,fragmentShader:jt.meshtoon_frag},matcap:{uniforms:Pe([Lt.common,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,Lt.fog,{matcap:{value:null}}]),vertexShader:jt.meshmatcap_vert,fragmentShader:jt.meshmatcap_frag},points:{uniforms:Pe([Lt.points,Lt.fog]),vertexShader:jt.points_vert,fragmentShader:jt.points_frag},dashed:{uniforms:Pe([Lt.common,Lt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jt.linedashed_vert,fragmentShader:jt.linedashed_frag},depth:{uniforms:Pe([Lt.common,Lt.displacementmap]),vertexShader:jt.depth_vert,fragmentShader:jt.depth_frag},normal:{uniforms:Pe([Lt.common,Lt.bumpmap,Lt.normalmap,Lt.displacementmap,{opacity:{value:1}}]),vertexShader:jt.meshnormal_vert,fragmentShader:jt.meshnormal_frag},sprite:{uniforms:Pe([Lt.sprite,Lt.fog]),vertexShader:jt.sprite_vert,fragmentShader:jt.sprite_frag},background:{uniforms:{uvTransform:{value:new Gt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jt.background_vert,fragmentShader:jt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Gt}},vertexShader:jt.backgroundCube_vert,fragmentShader:jt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jt.cube_vert,fragmentShader:jt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jt.equirect_vert,fragmentShader:jt.equirect_frag},distance:{uniforms:Pe([Lt.common,Lt.displacementmap,{referencePosition:{value:new W},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jt.distance_vert,fragmentShader:jt.distance_frag},shadow:{uniforms:Pe([Lt.lights,Lt.fog,{color:{value:new Kt(0)},opacity:{value:1}}]),vertexShader:jt.shadow_vert,fragmentShader:jt.shadow_frag}};vn.physical={uniforms:Pe([vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Gt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Gt},clearcoatNormalScale:{value:new yt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Gt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Gt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Gt},sheen:{value:0},sheenColor:{value:new Kt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Gt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Gt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Gt},transmissionSamplerSize:{value:new yt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Gt},attenuationDistance:{value:0},attenuationColor:{value:new Kt(0)},specularColor:{value:new Kt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Gt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Gt},anisotropyVector:{value:new yt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Gt}}]),vertexShader:jt.meshphysical_vert,fragmentShader:jt.meshphysical_frag};var $a={r:0,b:0,g:0},cm=new ue,qh=new Gt;qh.set(-1,0,0,0,1,0,0,0,1);function hm(i,t,e,n,s,r){let a=new Kt(0),o=s===!0?0:1,c,l,u=null,d=0,h=null;function p(L){let w=L.isScene===!0?L.background:null;if(w&&w.isTexture){let v=L.backgroundBlurriness>0;w=t.get(w,v)}return w}function x(L){let w=!1,v=p(L);v===null?g(a,o):v&&v.isColor&&(g(v,1),w=!0);let R=i.xr.getEnvironmentBlendMode();R==="additive"?e.buffers.color.setClear(0,0,0,1,r):R==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||w)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function S(L,w){let v=p(w);v&&(v.isCubeTexture||v.mapping===ks)?(l===void 0&&(l=new be(new Vi(1,1,1),new qe({name:"BackgroundCubeMaterial",uniforms:pi(vn.backgroundCube.uniforms),vertexShader:vn.backgroundCube.vertexShader,fragmentShader:vn.backgroundCube.fragmentShader,side:De,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(R,A,N){this.matrixWorld.copyPosition(N.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(l)),l.material.uniforms.envMap.value=v,l.material.uniforms.backgroundBlurriness.value=w.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(cm.makeRotationFromEuler(w.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(qh),l.material.toneMapped=ee.getTransfer(v.colorSpace)!==ie,(u!==v||d!==v.version||h!==i.toneMapping)&&(l.material.needsUpdate=!0,u=v,d=v.version,h=i.toneMapping),l.layers.enableAll(),L.unshift(l,l.geometry,l.material,0,0,null)):v&&v.isTexture&&(c===void 0&&(c=new be(new Rs(2,2),new qe({name:"BackgroundMaterial",uniforms:pi(vn.background.uniforms),vertexShader:vn.background.vertexShader,fragmentShader:vn.background.fragmentShader,side:Ln,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(c)),c.material.uniforms.t2D.value=v,c.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,c.material.toneMapped=ee.getTransfer(v.colorSpace)!==ie,v.matrixAutoUpdate===!0&&v.updateMatrix(),c.material.uniforms.uvTransform.value.copy(v.matrix),(u!==v||d!==v.version||h!==i.toneMapping)&&(c.material.needsUpdate=!0,u=v,d=v.version,h=i.toneMapping),c.layers.enableAll(),L.unshift(c,c.geometry,c.material,0,0,null))}function g(L,w){L.getRGB($a,vl(i)),e.buffers.color.setClear($a.r,$a.g,$a.b,w,r)}function f(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(L,w=1){a.set(L),o=w,g(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(L){o=L,g(a,o)},render:x,addToRenderList:S,dispose:f}}function um(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=h(null),r=s,a=!1;function o(O,k,lt,ot,J){let it=!1,Y=d(O,ot,lt,k);r!==Y&&(r=Y,l(r.object)),it=p(O,ot,lt,J),it&&x(O,ot,lt,J),J!==null&&t.update(J,i.ELEMENT_ARRAY_BUFFER),(it||a)&&(a=!1,v(O,k,lt,ot),J!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(J).buffer))}function c(){return i.createVertexArray()}function l(O){return i.bindVertexArray(O)}function u(O){return i.deleteVertexArray(O)}function d(O,k,lt,ot){let J=ot.wireframe===!0,it=n[k.id];it===void 0&&(it={},n[k.id]=it);let Y=O.isInstancedMesh===!0?O.id:0,V=it[Y];V===void 0&&(V={},it[Y]=V);let pt=V[lt.id];pt===void 0&&(pt={},V[lt.id]=pt);let mt=pt[J];return mt===void 0&&(mt=h(c()),pt[J]=mt),mt}function h(O){let k=[],lt=[],ot=[];for(let J=0;J<e;J++)k[J]=0,lt[J]=0,ot[J]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:k,enabledAttributes:lt,attributeDivisors:ot,object:O,attributes:{},index:null}}function p(O,k,lt,ot){let J=r.attributes,it=k.attributes,Y=0,V=lt.getAttributes();for(let pt in V)if(V[pt].location>=0){let vt=J[pt],Ct=it[pt];if(Ct===void 0&&(pt==="instanceMatrix"&&O.instanceMatrix&&(Ct=O.instanceMatrix),pt==="instanceColor"&&O.instanceColor&&(Ct=O.instanceColor)),vt===void 0||vt.attribute!==Ct||Ct&&vt.data!==Ct.data)return!0;Y++}return r.attributesNum!==Y||r.index!==ot}function x(O,k,lt,ot){let J={},it=k.attributes,Y=0,V=lt.getAttributes();for(let pt in V)if(V[pt].location>=0){let vt=it[pt];vt===void 0&&(pt==="instanceMatrix"&&O.instanceMatrix&&(vt=O.instanceMatrix),pt==="instanceColor"&&O.instanceColor&&(vt=O.instanceColor));let Ct={};Ct.attribute=vt,vt&&vt.data&&(Ct.data=vt.data),J[pt]=Ct,Y++}r.attributes=J,r.attributesNum=Y,r.index=ot}function S(){let O=r.newAttributes;for(let k=0,lt=O.length;k<lt;k++)O[k]=0}function g(O){f(O,0)}function f(O,k){let lt=r.newAttributes,ot=r.enabledAttributes,J=r.attributeDivisors;lt[O]=1,ot[O]===0&&(i.enableVertexAttribArray(O),ot[O]=1),J[O]!==k&&(i.vertexAttribDivisor(O,k),J[O]=k)}function L(){let O=r.newAttributes,k=r.enabledAttributes;for(let lt=0,ot=k.length;lt<ot;lt++)k[lt]!==O[lt]&&(i.disableVertexAttribArray(lt),k[lt]=0)}function w(O,k,lt,ot,J,it,Y){Y===!0?i.vertexAttribIPointer(O,k,lt,J,it):i.vertexAttribPointer(O,k,lt,ot,J,it)}function v(O,k,lt,ot){S();let J=ot.attributes,it=lt.getAttributes(),Y=k.defaultAttributeValues;for(let V in it){let pt=it[V];if(pt.location>=0){let mt=J[V];if(mt===void 0&&(V==="instanceMatrix"&&O.instanceMatrix&&(mt=O.instanceMatrix),V==="instanceColor"&&O.instanceColor&&(mt=O.instanceColor)),mt!==void 0){let vt=mt.normalized,Ct=mt.itemSize,Xt=t.get(mt);if(Xt===void 0)continue;let Jt=Xt.buffer,Yt=Xt.type,ct=Xt.bytesPerElement,X=Yt===i.INT||Yt===i.UNSIGNED_INT||mt.gpuType===ua;if(mt.isInterleavedBufferAttribute){let D=mt.data,P=D.stride,E=mt.offset;if(D.isInstancedInterleavedBuffer){for(let B=0;B<pt.locationSize;B++)f(pt.location+B,D.meshPerAttribute);O.isInstancedMesh!==!0&&ot._maxInstanceCount===void 0&&(ot._maxInstanceCount=D.meshPerAttribute*D.count)}else for(let B=0;B<pt.locationSize;B++)g(pt.location+B);i.bindBuffer(i.ARRAY_BUFFER,Jt);for(let B=0;B<pt.locationSize;B++)w(pt.location+B,Ct/pt.locationSize,Yt,vt,P*ct,(E+Ct/pt.locationSize*B)*ct,X)}else{if(mt.isInstancedBufferAttribute){for(let D=0;D<pt.locationSize;D++)f(pt.location+D,mt.meshPerAttribute);O.isInstancedMesh!==!0&&ot._maxInstanceCount===void 0&&(ot._maxInstanceCount=mt.meshPerAttribute*mt.count)}else for(let D=0;D<pt.locationSize;D++)g(pt.location+D);i.bindBuffer(i.ARRAY_BUFFER,Jt);for(let D=0;D<pt.locationSize;D++)w(pt.location+D,Ct/pt.locationSize,Yt,vt,Ct*ct,Ct/pt.locationSize*D*ct,X)}}else if(Y!==void 0){let vt=Y[V];if(vt!==void 0)switch(vt.length){case 2:i.vertexAttrib2fv(pt.location,vt);break;case 3:i.vertexAttrib3fv(pt.location,vt);break;case 4:i.vertexAttrib4fv(pt.location,vt);break;default:i.vertexAttrib1fv(pt.location,vt)}}}}L()}function R(){C();for(let O in n){let k=n[O];for(let lt in k){let ot=k[lt];for(let J in ot){let it=ot[J];for(let Y in it)u(it[Y].object),delete it[Y];delete ot[J]}}delete n[O]}}function A(O){if(n[O.id]===void 0)return;let k=n[O.id];for(let lt in k){let ot=k[lt];for(let J in ot){let it=ot[J];for(let Y in it)u(it[Y].object),delete it[Y];delete ot[J]}}delete n[O.id]}function N(O){for(let k in n){let lt=n[k];for(let ot in lt){let J=lt[ot];if(J[O.id]===void 0)continue;let it=J[O.id];for(let Y in it)u(it[Y].object),delete it[Y];delete J[O.id]}}}function y(O){for(let k in n){let lt=n[k],ot=O.isInstancedMesh===!0?O.id:0,J=lt[ot];if(J!==void 0){for(let it in J){let Y=J[it];for(let V in Y)u(Y[V].object),delete Y[V];delete J[it]}delete lt[ot],Object.keys(lt).length===0&&delete n[k]}}}function C(){z(),a=!0,r!==s&&(r=s,l(r.object))}function z(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:C,resetDefaultState:z,dispose:R,releaseStatesOfGeometry:A,releaseStatesOfObject:y,releaseStatesOfProgram:N,initAttributes:S,enableAttribute:g,disableUnusedAttributes:L}}function dm(i,t,e){let n;function s(c){n=c}function r(c,l){i.drawArrays(n,c,l),e.update(l,n,1)}function a(c,l,u){u!==0&&(i.drawArraysInstanced(n,c,l,u),e.update(l,n,u))}function o(c,l,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,l,0,u);let h=0;for(let p=0;p<u;p++)h+=l[p];e.update(h,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function fm(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let N=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(N.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(N){return!(N!==je&&n.convert(N)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(N){let y=N===xn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(N!==Oe&&n.convert(N)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&N!==an&&!y)}function c(N){if(N==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";N="mediump"}return N==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=e.precision!==void 0?e.precision:"highp",u=c(l);u!==l&&(Wt("WebGLRenderer:",l,"not supported, using",u,"instead."),l=u);let d=e.logarithmicDepthBuffer===!0,h=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&h===!1&&Wt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),S=i.getParameter(i.MAX_TEXTURE_SIZE),g=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),f=i.getParameter(i.MAX_VERTEX_ATTRIBS),L=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),w=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),R=i.getParameter(i.MAX_SAMPLES),A=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:a,textureTypeReadable:o,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:h,maxTextures:p,maxVertexTextures:x,maxTextureSize:S,maxCubemapSize:g,maxAttributes:f,maxVertexUniforms:L,maxVaryings:w,maxFragmentUniforms:v,maxSamples:R,samples:A}}function pm(i){let t=this,e=null,n=0,s=!1,r=!1,a=new un,o=new Gt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(d,h){let p=d.length!==0||h||n!==0||s;return s=h,n=d.length,p},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(d,h){e=u(d,h,0)},this.setState=function(d,h,p){let x=d.clippingPlanes,S=d.clipIntersection,g=d.clipShadows,f=i.get(d);if(!s||x===null||x.length===0||r&&!g)r?u(null):l();else{let L=r?0:n,w=L*4,v=f.clippingState||null;c.value=v,v=u(x,h,w,p);for(let R=0;R!==w;++R)v[R]=e[R];f.clippingState=v,this.numIntersection=S?this.numPlanes:0,this.numPlanes+=L}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function u(d,h,p,x){let S=d!==null?d.length:0,g=null;if(S!==0){if(g=c.value,x!==!0||g===null){let f=p+S*4,L=h.matrixWorldInverse;o.getNormalMatrix(L),(g===null||g.length<f)&&(g=new Float32Array(f));for(let w=0,v=p;w!==S;++w,v+=4)a.copy(d[w]).applyMatrix4(L,o),a.normal.toArray(g,v),g[v+3]=a.constant}c.value=g,c.needsUpdate=!0}return t.numPlanes=S,t.numIntersection=0,g}}var ei=4,bh=[.125,.215,.35,.446,.526,.582],mi=20,mm=256,Zs=new $n,Th=new Kt,Rl=null,Ll=0,Pl=0,Il=!1,gm=new W,ja=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:a=256,position:o=gm}=r;Rl=this._renderer.getRenderTarget(),Ll=this._renderer.getActiveCubeFace(),Pl=this._renderer.getActiveMipmapLevel(),Il=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(t,n,s,c,o),e>0&&this._blur(c,0,0,e),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=wh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ah(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(Rl,Ll,Pl),this._renderer.xr.enabled=Il,t.scissorTest=!1,$i(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Kn||t.mapping===fi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Rl=this._renderer.getRenderTarget(),Ll=this._renderer.getActiveCubeFace(),Pl=this._renderer.getActiveMipmapLevel(),Il=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Ee,minFilter:Ee,generateMipmaps:!1,type:xn,format:je,colorSpace:cs,depthBuffer:!1},s=Eh(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Eh(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=_m(r)),this._blurMaterial=ym(r,t,e),this._ggxMaterial=xm(r,t,e)}return s}_compileMaterial(t){let e=new be(new Le,t);this._renderer.compile(e,Zs)}_sceneToCubeUV(t,e,n,s,r){let c=new Fe(90,1,e,n),l=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],d=this._renderer,h=d.autoClear,p=d.toneMapping;d.getClearColor(Th),d.toneMapping=Ze,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(s),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new be(new Vi,new We({name:"PMREM.Background",side:De,depthWrite:!1,depthTest:!1})));let S=this._backgroundBox,g=S.material,f=!1,L=t.background;L?L.isColor&&(g.color.copy(L),t.background=null,f=!0):(g.color.copy(Th),f=!0);for(let w=0;w<6;w++){let v=w%3;v===0?(c.up.set(0,l[w],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x+u[w],r.y,r.z)):v===1?(c.up.set(0,0,l[w]),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y+u[w],r.z)):(c.up.set(0,l[w],0),c.position.set(r.x,r.y,r.z),c.lookAt(r.x,r.y,r.z+u[w]));let R=this._cubeSize;$i(s,v*R,w>2?R:0,R,R),d.setRenderTarget(s),f&&d.render(S,c),d.render(t,c)}d.toneMapping=p,d.autoClear=h,t.background=L}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===Kn||t.mapping===fi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=wh()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ah());let r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;let o=r.uniforms;o.envMap.value=t;let c=this._cubeSize;$i(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(a,Zs)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let c=a.uniforms,l=n/(this._lodMeshes.length-1),u=e/(this._lodMeshes.length-1),d=Math.sqrt(l*l-u*u),h=0+l*1.25,p=d*h,{_lodMax:x}=this,S=this._sizeLods[n],g=3*S*(n>x-ei?n-x+ei:0),f=4*(this._cubeSize-S);c.envMap.value=t.texture,c.roughness.value=p,c.mipInt.value=x-e,$i(r,g,f,3*S,2*S),s.setRenderTarget(r),s.render(o,Zs),c.envMap.value=r.texture,c.roughness.value=0,c.mipInt.value=x-n,$i(t,g,f,3*S,2*S),s.setRenderTarget(t),s.render(o,Zs)}_blur(t,e,n,s,r){let a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,s,"latitudinal",r),this._halfBlur(a,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,a,o){let c=this._renderer,l=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&qt("blur direction must be either latitudinal or longitudinal!");let u=3,d=this._lodMeshes[s];d.material=l;let h=l.uniforms,p=this._sizeLods[n]-1,x=isFinite(r)?Math.PI/(2*p):2*Math.PI/(2*mi-1),S=r/x,g=isFinite(r)?1+Math.floor(u*S):mi;g>mi&&Wt(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${mi}`);let f=[],L=0;for(let N=0;N<mi;++N){let y=N/S,C=Math.exp(-y*y/2);f.push(C),N===0?L+=C:N<g&&(L+=2*C)}for(let N=0;N<f.length;N++)f[N]=f[N]/L;h.envMap.value=t.texture,h.samples.value=g,h.weights.value=f,h.latitudinal.value=a==="latitudinal",o&&(h.poleAxis.value=o);let{_lodMax:w}=this;h.dTheta.value=x,h.mipInt.value=w-n;let v=this._sizeLods[s],R=3*v*(s>w-ei?s-w+ei:0),A=4*(this._cubeSize-v);$i(e,R,A,3*v,2*v),c.setRenderTarget(e),c.render(d,Zs)}};function _m(i){let t=[],e=[],n=[],s=i,r=i-ei+1+bh.length;for(let a=0;a<r;a++){let o=Math.pow(2,s);t.push(o);let c=1/o;a>i-ei?c=bh[a-i+ei-1]:a===0&&(c=0),e.push(c);let l=1/(o-2),u=-l,d=1+l,h=[u,u,d,u,d,d,u,u,d,d,u,d],p=6,x=6,S=3,g=2,f=1,L=new Float32Array(S*x*p),w=new Float32Array(g*x*p),v=new Float32Array(f*x*p);for(let A=0;A<p;A++){let N=A%3*2/3-1,y=A>2?0:-1,C=[N,y,0,N+2/3,y,0,N+2/3,y+1,0,N,y,0,N+2/3,y+1,0,N,y+1,0];L.set(C,S*x*A),w.set(h,g*x*A);let z=[A,A,A,A,A,A];v.set(z,f*x*A)}let R=new Le;R.setAttribute("position",new Ge(L,S)),R.setAttribute("uv",new Ge(w,g)),R.setAttribute("faceIndex",new Ge(v,f)),n.push(new be(R,null)),s>ei&&s--}return{lodMeshes:n,sizeLods:t,sigmas:e}}function Eh(i,t,e){let n=new He(i,t,e);return n.texture.mapping=ks,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function $i(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function xm(i,t,e){return new qe({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:mm,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:eo(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:_n,depthTest:!1,depthWrite:!1})}function ym(i,t,e){let n=new Float32Array(mi),s=new W(0,1,0);return new qe({name:"SphericalGaussianBlur",defines:{n:mi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:_n,depthTest:!1,depthWrite:!1})}function Ah(){return new qe({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:_n,depthTest:!1,depthWrite:!1})}function wh(){return new qe({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:eo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:_n,depthTest:!1,depthWrite:!1})}function eo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var Qa=class extends He{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new _s(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Vi(5,5,5),r=new qe({name:"CubemapFromEquirect",uniforms:pi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:De,blending:_n});r.uniforms.tEquirect.value=e;let a=new be(s,r),o=e.minFilter;return e.minFilter===jn&&(e.minFilter=Ee),new sa(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,s);t.setRenderTarget(r)}};function vm(i){let t=new WeakMap,e=new WeakMap,n=null;function s(h,p=!1){return h==null?null:p?a(h):r(h)}function r(h){if(h&&h.isTexture){let p=h.mapping;if(p===la||p===ca)if(t.has(h)){let x=t.get(h).texture;return o(x,h.mapping)}else{let x=h.image;if(x&&x.height>0){let S=new Qa(x.height);return S.fromEquirectangularTexture(i,h),t.set(h,S),h.addEventListener("dispose",l),o(S.texture,h.mapping)}else return null}}return h}function a(h){if(h&&h.isTexture){let p=h.mapping,x=p===la||p===ca,S=p===Kn||p===fi;if(x||S){let g=e.get(h),f=g!==void 0?g.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==f)return n===null&&(n=new ja(i)),g=x?n.fromEquirectangular(h,g):n.fromCubemap(h,g),g.texture.pmremVersion=h.pmremVersion,e.set(h,g),g.texture;if(g!==void 0)return g.texture;{let L=h.image;return x&&L&&L.height>0||S&&L&&c(L)?(n===null&&(n=new ja(i)),g=x?n.fromEquirectangular(h):n.fromCubemap(h),g.texture.pmremVersion=h.pmremVersion,e.set(h,g),h.addEventListener("dispose",u),g.texture):null}}}return h}function o(h,p){return p===la?h.mapping=Kn:p===ca&&(h.mapping=fi),h}function c(h){let p=0,x=6;for(let S=0;S<x;S++)h[S]!==void 0&&p++;return p===x}function l(h){let p=h.target;p.removeEventListener("dispose",l);let x=t.get(p);x!==void 0&&(t.delete(p),x.dispose())}function u(h){let p=h.target;p.removeEventListener("dispose",u);let x=e.get(p);x!==void 0&&(e.delete(p),x.dispose())}function d(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:d}}function Mm(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&li("WebGLRenderer: "+n+" extension not supported."),s}}}function Sm(i,t,e,n){let s={},r=new WeakMap;function a(d){let h=d.target;h.index!==null&&t.remove(h.index);for(let x in h.attributes)t.remove(h.attributes[x]);h.removeEventListener("dispose",a),delete s[h.id];let p=r.get(h);p&&(t.remove(p),r.delete(h)),n.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,e.memory.geometries--}function o(d,h){return s[h.id]===!0||(h.addEventListener("dispose",a),s[h.id]=!0,e.memory.geometries++),h}function c(d){let h=d.attributes;for(let p in h)t.update(h[p],i.ARRAY_BUFFER)}function l(d){let h=[],p=d.index,x=d.attributes.position,S=0;if(x===void 0)return;if(p!==null){let L=p.array;S=p.version;for(let w=0,v=L.length;w<v;w+=3){let R=L[w+0],A=L[w+1],N=L[w+2];h.push(R,A,A,N,N,R)}}else{let L=x.array;S=x.version;for(let w=0,v=L.length/3-1;w<v;w+=3){let R=w+0,A=w+1,N=w+2;h.push(R,A,A,N,N,R)}}let g=new(x.count>=65535?gs:ms)(h,1);g.version=S;let f=r.get(d);f&&t.remove(f),r.set(d,g)}function u(d){let h=r.get(d);if(h){let p=d.index;p!==null&&h.version<p.version&&l(d)}else l(d);return r.get(d)}return{get:o,update:c,getWireframeAttribute:u}}function bm(i,t,e){let n;function s(d){n=d}let r,a;function o(d){r=d.type,a=d.bytesPerElement}function c(d,h){i.drawElements(n,h,r,d*a),e.update(h,n,1)}function l(d,h,p){p!==0&&(i.drawElementsInstanced(n,h,r,d*a,p),e.update(h,n,p))}function u(d,h,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,h,0,r,d,0,p);let S=0;for(let g=0;g<p;g++)S+=h[g];e.update(S,n,1)}this.setMode=s,this.setIndex=o,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Tm(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(e.calls++,a){case i.TRIANGLES:e.triangles+=o*(r/3);break;case i.LINES:e.lines+=o*(r/2);break;case i.LINE_STRIP:e.lines+=o*(r-1);break;case i.LINE_LOOP:e.lines+=o*r;break;case i.POINTS:e.points+=o*r;break;default:qt("WebGLInfo: Unknown draw mode:",a);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Em(i,t,e){let n=new WeakMap,s=new de;function r(a,o,c){let l=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=u!==void 0?u.length:0,h=n.get(o);if(h===void 0||h.count!==d){let C=function(){N.dispose(),n.delete(o),o.removeEventListener("dispose",C)};h!==void 0&&h.texture.dispose();let p=o.morphAttributes.position!==void 0,x=o.morphAttributes.normal!==void 0,S=o.morphAttributes.color!==void 0,g=o.morphAttributes.position||[],f=o.morphAttributes.normal||[],L=o.morphAttributes.color||[],w=0;p===!0&&(w=1),x===!0&&(w=2),S===!0&&(w=3);let v=o.attributes.position.count*w,R=1;v>t.maxTextureSize&&(R=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let A=new Float32Array(v*R*4*d),N=new ds(A,v,R,d);N.type=an,N.needsUpdate=!0;let y=w*4;for(let z=0;z<d;z++){let O=g[z],k=f[z],lt=L[z],ot=v*R*4*z;for(let J=0;J<O.count;J++){let it=J*y;p===!0&&(s.fromBufferAttribute(O,J),A[ot+it+0]=s.x,A[ot+it+1]=s.y,A[ot+it+2]=s.z,A[ot+it+3]=0),x===!0&&(s.fromBufferAttribute(k,J),A[ot+it+4]=s.x,A[ot+it+5]=s.y,A[ot+it+6]=s.z,A[ot+it+7]=0),S===!0&&(s.fromBufferAttribute(lt,J),A[ot+it+8]=s.x,A[ot+it+9]=s.y,A[ot+it+10]=s.z,A[ot+it+11]=lt.itemSize===4?s.w:1)}}h={count:d,texture:N,size:new yt(v,R)},n.set(o,h),o.addEventListener("dispose",C)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",a.morphTexture,e);else{let p=0;for(let S=0;S<l.length;S++)p+=l[S];let x=o.morphTargetsRelative?1:1-p;c.getUniforms().setValue(i,"morphTargetBaseInfluence",x),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",h.texture,e),c.getUniforms().setValue(i,"morphTargetsTextureSize",h.size)}return{update:r}}function Am(i,t,e,n,s){let r=new WeakMap;function a(l){let u=s.render.frame,d=l.geometry,h=t.get(l,d);if(r.get(h)!==u&&(t.update(h),r.set(h,u)),l.isInstancedMesh&&(l.hasEventListener("dispose",c)===!1&&l.addEventListener("dispose",c),r.get(l)!==u&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),r.set(l,u))),l.isSkinnedMesh){let p=l.skeleton;r.get(p)!==u&&(p.update(),r.set(p,u))}return h}function o(){r=new WeakMap}function c(l){let u=l.target;u.removeEventListener("dispose",c),n.releaseStatesOfObject(u),e.remove(u.instanceMatrix),u.instanceColor!==null&&e.remove(u.instanceColor)}return{update:a,dispose:o}}var wm={[nl]:"LINEAR_TONE_MAPPING",[il]:"REINHARD_TONE_MAPPING",[sl]:"CINEON_TONE_MAPPING",[rl]:"ACES_FILMIC_TONE_MAPPING",[ol]:"AGX_TONE_MAPPING",[ll]:"NEUTRAL_TONE_MAPPING",[al]:"CUSTOM_TONE_MAPPING"};function Cm(i,t,e,n,s,r){let a=new He(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,depthTexture:s?new In(t,e):void 0}),o=new He(t,e,{type:xn,depthBuffer:!1,stencilBuffer:!1}),c=new Le;c.setAttribute("position",new oe([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new oe([0,2,0,0,2,0],2));let l=new qr({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),u=new be(c,l),d=new $n(-1,1,1,-1,0,1),h=null,p=null,x=!1,S,g=null,f=[],L=!1;this.setSize=function(w,v){a.setSize(w,v),o.setSize(w,v);for(let R=0;R<f.length;R++){let A=f[R];A.setSize&&A.setSize(w,v)}},this.setEffects=function(w){f=w,L=f.length>0&&f[0].isRenderPass===!0;let v=a.width,R=a.height;for(let A=0;A<f.length;A++){let N=f[A];N.setSize&&N.setSize(v,R)}},this.begin=function(w,v){if(x||w.toneMapping===Ze&&f.length===0)return!1;if(g=v,v!==null){let R=v.width,A=v.height;(a.width!==R||a.height!==A)&&this.setSize(R,A)}return L===!1&&w.setRenderTarget(a),S=w.toneMapping,w.toneMapping=Ze,!0},this.hasRenderPass=function(){return L},this.end=function(w,v){w.toneMapping=S,x=!0;let R=a,A=o;for(let N=0;N<f.length;N++){let y=f[N];if(y.enabled!==!1&&(y.render(w,A,R,v),y.needsSwap!==!1)){let C=R;R=A,A=C}}if(h!==w.outputColorSpace||p!==w.toneMapping){h=w.outputColorSpace,p=w.toneMapping,l.defines={},ee.getTransfer(h)===ie&&(l.defines.SRGB_TRANSFER="");let N=wm[p];N&&(l.defines[N]=""),l.needsUpdate=!0}l.uniforms.tDiffuse.value=R.texture,w.setRenderTarget(g),w.render(u,d),g=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),c.dispose(),l.dispose()}}var Yh=new Ie,Ul=new In(1,1),Zh=new ds,Jh=new Fr,$h=new _s,Ch=[],Rh=[],Lh=new Float32Array(16),Ph=new Float32Array(9),Ih=new Float32Array(4);function ji(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=Ch[s];if(r===void 0&&(r=new Float32Array(s),Ch[s]=r),t!==0){n.toArray(r,0);for(let a=1,o=0;a!==t;++a)o+=e,i[a].toArray(r,o)}return r}function ye(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function ve(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function no(i,t){let e=Rh[t];e===void 0&&(e=new Int32Array(t),Rh[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function Rm(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Lm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;i.uniform2fv(this.addr,t),ve(e,t)}}function Pm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ye(e,t))return;i.uniform3fv(this.addr,t),ve(e,t)}}function Im(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;i.uniform4fv(this.addr,t),ve(e,t)}}function Nm(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),ve(e,t)}else{if(ye(e,n))return;Ih.set(n),i.uniformMatrix2fv(this.addr,!1,Ih),ve(e,n)}}function Dm(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),ve(e,t)}else{if(ye(e,n))return;Ph.set(n),i.uniformMatrix3fv(this.addr,!1,Ph),ve(e,n)}}function Um(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),ve(e,t)}else{if(ye(e,n))return;Lh.set(n),i.uniformMatrix4fv(this.addr,!1,Lh),ve(e,n)}}function Fm(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Om(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;i.uniform2iv(this.addr,t),ve(e,t)}}function Bm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ye(e,t))return;i.uniform3iv(this.addr,t),ve(e,t)}}function zm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;i.uniform4iv(this.addr,t),ve(e,t)}}function km(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function Vm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;i.uniform2uiv(this.addr,t),ve(e,t)}}function Gm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ye(e,t))return;i.uniform3uiv(this.addr,t),ve(e,t)}}function Hm(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;i.uniform4uiv(this.addr,t),ve(e,t)}}function Wm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Ul.compareFunction=e.isReversedDepthBuffer()?Ja:Za,r=Ul):r=Yh,e.setTexture2D(t||r,s)}function Xm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Jh,s)}function qm(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||$h,s)}function Ym(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Zh,s)}function Zm(i){switch(i){case 5126:return Rm;case 35664:return Lm;case 35665:return Pm;case 35666:return Im;case 35674:return Nm;case 35675:return Dm;case 35676:return Um;case 5124:case 35670:return Fm;case 35667:case 35671:return Om;case 35668:case 35672:return Bm;case 35669:case 35673:return zm;case 5125:return km;case 36294:return Vm;case 36295:return Gm;case 36296:return Hm;case 35678:case 36198:case 36298:case 36306:case 35682:return Wm;case 35679:case 36299:case 36307:return Xm;case 35680:case 36300:case 36308:case 36293:return qm;case 36289:case 36303:case 36311:case 36292:return Ym}}function Jm(i,t){i.uniform1fv(this.addr,t)}function $m(i,t){let e=ji(t,this.size,2);i.uniform2fv(this.addr,e)}function Km(i,t){let e=ji(t,this.size,3);i.uniform3fv(this.addr,e)}function jm(i,t){let e=ji(t,this.size,4);i.uniform4fv(this.addr,e)}function Qm(i,t){let e=ji(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function tg(i,t){let e=ji(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function eg(i,t){let e=ji(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function ng(i,t){i.uniform1iv(this.addr,t)}function ig(i,t){i.uniform2iv(this.addr,t)}function sg(i,t){i.uniform3iv(this.addr,t)}function rg(i,t){i.uniform4iv(this.addr,t)}function ag(i,t){i.uniform1uiv(this.addr,t)}function og(i,t){i.uniform2uiv(this.addr,t)}function lg(i,t){i.uniform3uiv(this.addr,t)}function cg(i,t){i.uniform4uiv(this.addr,t)}function hg(i,t,e){let n=this.cache,s=t.length,r=no(e,s);ye(n,r)||(i.uniform1iv(this.addr,r),ve(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=Ul:a=Yh;for(let o=0;o!==s;++o)e.setTexture2D(t[o]||a,r[o])}function ug(i,t,e){let n=this.cache,s=t.length,r=no(e,s);ye(n,r)||(i.uniform1iv(this.addr,r),ve(n,r));for(let a=0;a!==s;++a)e.setTexture3D(t[a]||Jh,r[a])}function dg(i,t,e){let n=this.cache,s=t.length,r=no(e,s);ye(n,r)||(i.uniform1iv(this.addr,r),ve(n,r));for(let a=0;a!==s;++a)e.setTextureCube(t[a]||$h,r[a])}function fg(i,t,e){let n=this.cache,s=t.length,r=no(e,s);ye(n,r)||(i.uniform1iv(this.addr,r),ve(n,r));for(let a=0;a!==s;++a)e.setTexture2DArray(t[a]||Zh,r[a])}function pg(i){switch(i){case 5126:return Jm;case 35664:return $m;case 35665:return Km;case 35666:return jm;case 35674:return Qm;case 35675:return tg;case 35676:return eg;case 5124:case 35670:return ng;case 35667:case 35671:return ig;case 35668:case 35672:return sg;case 35669:case 35673:return rg;case 5125:return ag;case 36294:return og;case 36295:return lg;case 36296:return cg;case 35678:case 36198:case 36298:case 36306:case 35682:return hg;case 35679:case 36299:case 36307:return ug;case 35680:case 36300:case 36308:case 36293:return dg;case 36289:case 36303:case 36311:case 36292:return fg}}var Fl=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Zm(e.type)}},Ol=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=pg(e.type)}},Bl=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,a=s.length;r!==a;++r){let o=s[r];o.setValue(t,e[o.id],n)}}},Nl=/(\w+)(\])?(\[|\.)?/g;function Nh(i,t){i.seq.push(t),i.map[t.id]=t}function mg(i,t,e){let n=i.name,s=n.length;for(Nl.lastIndex=0;;){let r=Nl.exec(n),a=Nl.lastIndex,o=r[1],c=r[2]==="]",l=r[3];if(c&&(o=o|0),l===void 0||l==="["&&a+2===s){Nh(e,l===void 0?new Fl(o,i,t):new Ol(o,i,t));break}else{let d=e.map[o];d===void 0&&(d=new Bl(o),Nh(e,d)),e=d}}}var Ki=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=t.getActiveUniform(e,a),c=t.getUniformLocation(e,o.name);mg(o,c,this)}let s=[],r=[];for(let a of this.seq)a.type===t.SAMPLER_2D_SHADOW||a.type===t.SAMPLER_CUBE_SHADOW||a.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,a=e.length;r!==a;++r){let o=e[r],c=n[o.id];c.needsUpdate!==!1&&o.setValue(t,c.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let a=t[s];a.id in e&&n.push(a)}return n}};function Dh(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var gg=37297,_g=0;function xg(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let a=s;a<r;a++){let o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}var Uh=new Gt;function yg(i){ee._getMatrix(Uh,ee.workingColorSpace,i);let t=`mat3( ${Uh.elements.map(e=>e.toFixed(4))} )`;switch(ee.getTransfer(i)){case hs:return[t,"LinearTransferOETF"];case ie:return[t,"sRGBTransferOETF"];default:return Wt("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Fh(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let o=parseInt(a[1]);return e.toUpperCase()+`

`+r+`

`+xg(i.getShaderSource(t),o)}else return r}function vg(i,t){let e=yg(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var Mg={[nl]:"Linear",[il]:"Reinhard",[sl]:"Cineon",[rl]:"ACESFilmic",[ol]:"AgX",[ll]:"Neutral",[al]:"Custom"};function Sg(i,t){let e=Mg[t];return e===void 0?(Wt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var Ka=new W;function bg(){ee.getLuminanceCoefficients(Ka);let i=Ka.x.toFixed(4),t=Ka.y.toFixed(4),e=Ka.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Tg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter($s).join(`
`)}function Eg(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Ag(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),a=r.name,o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),e[a]={type:r.type,location:i.getAttribLocation(t,a),locationSize:o}}return e}function $s(i){return i!==""}function Oh(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Bh(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var wg=/^[ \t]*#include +<([\w\d./]+)>/gm;function zl(i){return i.replace(wg,Rg)}var Cg=new Map;function Rg(i,t){let e=jt[t];if(e===void 0){let n=Cg.get(t);if(n!==void 0)e=jt[n],Wt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return zl(e)}var Lg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function zh(i){return i.replace(Lg,Pg)}function Pg(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function kh(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var Ig={[zs]:"SHADOWMAP_TYPE_PCF",[qi]:"SHADOWMAP_TYPE_VSM"};function Ng(i){return Ig[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Dg={[Kn]:"ENVMAP_TYPE_CUBE",[fi]:"ENVMAP_TYPE_CUBE",[ks]:"ENVMAP_TYPE_CUBE_UV"};function Ug(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Dg[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Fg={[fi]:"ENVMAP_MODE_REFRACTION"};function Og(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Fg[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Bg={[oa]:"ENVMAP_BLENDING_MULTIPLY",[eh]:"ENVMAP_BLENDING_MIX",[nh]:"ENVMAP_BLENDING_ADD"};function zg(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Bg[i.combine]||"ENVMAP_BLENDING_NONE"}function kg(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Vg(i,t,e,n){let s=i.getContext(),r=e.defines,a=e.vertexShader,o=e.fragmentShader,c=Ng(e),l=Ug(e),u=Og(e),d=zg(e),h=kg(e),p=Tg(e),x=Eg(r),S=s.createProgram(),g,f,L=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,x].filter($s).join(`
`),g.length>0&&(g+=`
`),f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,x].filter($s).join(`
`),f.length>0&&(f+=`
`)):(g=[kh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,x,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter($s).join(`
`),f=[kh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,x,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+u:"",e.envMap?"#define "+d:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Ze?"#define TONE_MAPPING":"",e.toneMapping!==Ze?jt.tonemapping_pars_fragment:"",e.toneMapping!==Ze?Sg("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",jt.colorspace_pars_fragment,vg("linearToOutputTexel",e.outputColorSpace),bg(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter($s).join(`
`)),a=zl(a),a=Oh(a,e),a=Bh(a,e),o=zl(o),o=Oh(o,e),o=Bh(o,e),a=zh(a),o=zh(o),e.isRawShaderMaterial!==!0&&(L=`#version 300 es
`,g=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,f=["#define varying in",e.glslVersion===_l?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===_l?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);let w=L+g+a,v=L+f+o,R=Dh(s,s.VERTEX_SHADER,w),A=Dh(s,s.FRAGMENT_SHADER,v);s.attachShader(S,R),s.attachShader(S,A),e.index0AttributeName!==void 0?s.bindAttribLocation(S,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(S,0,"position"),s.linkProgram(S);function N(O){if(i.debug.checkShaderErrors){let k=s.getProgramInfoLog(S)||"",lt=s.getShaderInfoLog(R)||"",ot=s.getShaderInfoLog(A)||"",J=k.trim(),it=lt.trim(),Y=ot.trim(),V=!0,pt=!0;if(s.getProgramParameter(S,s.LINK_STATUS)===!1)if(V=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,S,R,A);else{let mt=Fh(s,R,"vertex"),vt=Fh(s,A,"fragment");qt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(S,s.VALIDATE_STATUS)+`

Material Name: `+O.name+`
Material Type: `+O.type+`

Program Info Log: `+J+`
`+mt+`
`+vt)}else J!==""?Wt("WebGLProgram: Program Info Log:",J):(it===""||Y==="")&&(pt=!1);pt&&(O.diagnostics={runnable:V,programLog:J,vertexShader:{log:it,prefix:g},fragmentShader:{log:Y,prefix:f}})}s.deleteShader(R),s.deleteShader(A),y=new Ki(s,S),C=Ag(s,S)}let y;this.getUniforms=function(){return y===void 0&&N(this),y};let C;this.getAttributes=function(){return C===void 0&&N(this),C};let z=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return z===!1&&(z=s.getProgramParameter(S,gg)),z},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(S),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=_g++,this.cacheKey=t,this.usedTimes=1,this.program=S,this.vertexShader=R,this.fragmentShader=A,this}var Gg=0,kl=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new Vl(t),e.set(t,n)),n}},Vl=class{constructor(t){this.id=Gg++,this.code=t,this.usedTimes=0}};function Hg(i){return i===ti||i===qs||i===Ys}function Wg(i,t,e,n,s,r){let a=new fs,o=new kl,c=new Set,l=[],u=new Map,d=n.logarithmicDepthBuffer,h=n.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function x(y){return c.add(y),y===0?"uv":`uv${y}`}function S(y,C,z,O,k,lt){let ot=O.fog,J=k.geometry,it=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?O.environment:null,Y=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,V=t.get(y.envMap||it,Y),pt=V&&V.mapping===ks?V.image.height:null,mt=p[y.type];y.precision!==null&&(h=n.getMaxPrecision(y.precision),h!==y.precision&&Wt("WebGLProgram.getParameters:",y.precision,"not supported, using",h,"instead."));let vt=J.morphAttributes.position||J.morphAttributes.normal||J.morphAttributes.color,Ct=vt!==void 0?vt.length:0,Xt=0;J.morphAttributes.position!==void 0&&(Xt=1),J.morphAttributes.normal!==void 0&&(Xt=2),J.morphAttributes.color!==void 0&&(Xt=3);let Jt,Yt,ct,X;if(mt){let Ft=vn[mt];Jt=Ft.vertexShader,Yt=Ft.fragmentShader}else{Jt=y.vertexShader,Yt=y.fragmentShader;let Ft=o.getVertexShaderStage(y),pe=o.getFragmentShaderStage(y);o.update(y,Ft,pe),ct=Ft.id,X=pe.id}let D=i.getRenderTarget(),P=i.state.buffers.depth.getReversed(),E=k.isInstancedMesh===!0,B=k.isBatchedMesh===!0,et=!!y.map,ut=!!y.matcap,T=!!V,F=!!y.aoMap,I=!!y.lightMap,$=!!y.bumpMap&&y.wireframe===!1,K=!!y.normalMap,rt=!!y.displacementMap,gt=!!y.emissiveMap,_t=!!y.metalnessMap,H=!!y.roughnessMap,m=y.anisotropy>0,j=y.clearcoat>0,ft=y.dispersion>0,b=y.iridescence>0,_=y.sheen>0,U=y.transmission>0,Z=m&&!!y.anisotropyMap,st=j&&!!y.clearcoatMap,Mt=j&&!!y.clearcoatNormalMap,St=j&&!!y.clearcoatRoughnessMap,at=b&&!!y.iridescenceMap,dt=b&&!!y.iridescenceThicknessMap,Tt=_&&!!y.sheenColorMap,Ut=_&&!!y.sheenRoughnessMap,wt=!!y.specularMap,Et=!!y.specularColorMap,zt=!!y.specularIntensityMap,Ht=U&&!!y.transmissionMap,Zt=U&&!!y.thicknessMap,G=!!y.gradientMap,bt=!!y.alphaMap,ht=y.alphaTest>0,At=!!y.alphaHash,Rt=!!y.extensions,xt=Ze;y.toneMapped&&(D===null||D.isXRRenderTarget===!0)&&(xt=i.toneMapping);let Ot={shaderID:mt,shaderType:y.type,shaderName:y.name,vertexShader:Jt,fragmentShader:Yt,defines:y.defines,customVertexShaderID:ct,customFragmentShaderID:X,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:h,batching:B,batchingColor:B&&k._colorsTexture!==null,instancing:E,instancingColor:E&&k.instanceColor!==null,instancingMorph:E&&k.morphTexture!==null,outputColorSpace:D===null?i.outputColorSpace:D.isXRRenderTarget===!0?D.texture.colorSpace:ee.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:et,matcap:ut,envMap:T,envMapMode:T&&V.mapping,envMapCubeUVHeight:pt,aoMap:F,lightMap:I,bumpMap:$,normalMap:K,displacementMap:rt,emissiveMap:gt,normalMapObjectSpace:K&&y.normalMapType===rh,normalMapTangentSpace:K&&y.normalMapType===Ya,packedNormalMap:K&&y.normalMapType===Ya&&Hg(y.normalMap.format),metalnessMap:_t,roughnessMap:H,anisotropy:m,anisotropyMap:Z,clearcoat:j,clearcoatMap:st,clearcoatNormalMap:Mt,clearcoatRoughnessMap:St,dispersion:ft,iridescence:b,iridescenceMap:at,iridescenceThicknessMap:dt,sheen:_,sheenColorMap:Tt,sheenRoughnessMap:Ut,specularMap:wt,specularColorMap:Et,specularIntensityMap:zt,transmission:U,transmissionMap:Ht,thicknessMap:Zt,gradientMap:G,opaque:y.transparent===!1&&y.blending===ci&&y.alphaToCoverage===!1,alphaMap:bt,alphaTest:ht,alphaHash:At,combine:y.combine,mapUv:et&&x(y.map.channel),aoMapUv:F&&x(y.aoMap.channel),lightMapUv:I&&x(y.lightMap.channel),bumpMapUv:$&&x(y.bumpMap.channel),normalMapUv:K&&x(y.normalMap.channel),displacementMapUv:rt&&x(y.displacementMap.channel),emissiveMapUv:gt&&x(y.emissiveMap.channel),metalnessMapUv:_t&&x(y.metalnessMap.channel),roughnessMapUv:H&&x(y.roughnessMap.channel),anisotropyMapUv:Z&&x(y.anisotropyMap.channel),clearcoatMapUv:st&&x(y.clearcoatMap.channel),clearcoatNormalMapUv:Mt&&x(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:St&&x(y.clearcoatRoughnessMap.channel),iridescenceMapUv:at&&x(y.iridescenceMap.channel),iridescenceThicknessMapUv:dt&&x(y.iridescenceThicknessMap.channel),sheenColorMapUv:Tt&&x(y.sheenColorMap.channel),sheenRoughnessMapUv:Ut&&x(y.sheenRoughnessMap.channel),specularMapUv:wt&&x(y.specularMap.channel),specularColorMapUv:Et&&x(y.specularColorMap.channel),specularIntensityMapUv:zt&&x(y.specularIntensityMap.channel),transmissionMapUv:Ht&&x(y.transmissionMap.channel),thicknessMapUv:Zt&&x(y.thicknessMap.channel),alphaMapUv:bt&&x(y.alphaMap.channel),vertexTangents:!!J.attributes.tangent&&(K||m),vertexNormals:!!J.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!J.attributes.color&&J.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!J.attributes.uv&&(et||bt),fog:!!ot,useFog:y.fog===!0,fogExp2:!!ot&&ot.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||J.attributes.normal===void 0&&K===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:P,skinning:k.isSkinnedMesh===!0,hasPositionAttribute:J.attributes.position!==void 0,morphTargets:J.morphAttributes.position!==void 0,morphNormals:J.morphAttributes.normal!==void 0,morphColors:J.morphAttributes.color!==void 0,morphTargetsCount:Ct,morphTextureStride:Xt,numDirLights:C.directional.length,numPointLights:C.point.length,numSpotLights:C.spot.length,numSpotLightMaps:C.spotLightMap.length,numRectAreaLights:C.rectArea.length,numHemiLights:C.hemi.length,numDirLightShadows:C.directionalShadowMap.length,numPointLightShadows:C.pointShadowMap.length,numSpotLightShadows:C.spotShadowMap.length,numSpotLightShadowsWithMaps:C.numSpotLightShadowsWithMaps,numLightProbes:C.numLightProbes,numLightProbeGrids:lt.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:i.shadowMap.enabled&&z.length>0,shadowMapType:i.shadowMap.type,toneMapping:xt,decodeVideoTexture:et&&y.map.isVideoTexture===!0&&ee.getTransfer(y.map.colorSpace)===ie,decodeVideoTextureEmissive:gt&&y.emissiveMap.isVideoTexture===!0&&ee.getTransfer(y.emissiveMap.colorSpace)===ie,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Ae,flipSided:y.side===De,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:Rt&&y.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Rt&&y.extensions.multiDraw===!0||B)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Ot.vertexUv1s=c.has(1),Ot.vertexUv2s=c.has(2),Ot.vertexUv3s=c.has(3),c.clear(),Ot}function g(y){let C=[];if(y.shaderID?C.push(y.shaderID):(C.push(y.customVertexShaderID),C.push(y.customFragmentShaderID)),y.defines!==void 0)for(let z in y.defines)C.push(z),C.push(y.defines[z]);return y.isRawShaderMaterial===!1&&(f(C,y),L(C,y),C.push(i.outputColorSpace)),C.push(y.customProgramCacheKey),C.join()}function f(y,C){y.push(C.precision),y.push(C.outputColorSpace),y.push(C.envMapMode),y.push(C.envMapCubeUVHeight),y.push(C.mapUv),y.push(C.alphaMapUv),y.push(C.lightMapUv),y.push(C.aoMapUv),y.push(C.bumpMapUv),y.push(C.normalMapUv),y.push(C.displacementMapUv),y.push(C.emissiveMapUv),y.push(C.metalnessMapUv),y.push(C.roughnessMapUv),y.push(C.anisotropyMapUv),y.push(C.clearcoatMapUv),y.push(C.clearcoatNormalMapUv),y.push(C.clearcoatRoughnessMapUv),y.push(C.iridescenceMapUv),y.push(C.iridescenceThicknessMapUv),y.push(C.sheenColorMapUv),y.push(C.sheenRoughnessMapUv),y.push(C.specularMapUv),y.push(C.specularColorMapUv),y.push(C.specularIntensityMapUv),y.push(C.transmissionMapUv),y.push(C.thicknessMapUv),y.push(C.combine),y.push(C.fogExp2),y.push(C.sizeAttenuation),y.push(C.morphTargetsCount),y.push(C.morphAttributeCount),y.push(C.numDirLights),y.push(C.numPointLights),y.push(C.numSpotLights),y.push(C.numSpotLightMaps),y.push(C.numHemiLights),y.push(C.numRectAreaLights),y.push(C.numDirLightShadows),y.push(C.numPointLightShadows),y.push(C.numSpotLightShadows),y.push(C.numSpotLightShadowsWithMaps),y.push(C.numLightProbes),y.push(C.shadowMapType),y.push(C.toneMapping),y.push(C.numClippingPlanes),y.push(C.numClipIntersection),y.push(C.depthPacking)}function L(y,C){a.disableAll(),C.instancing&&a.enable(0),C.instancingColor&&a.enable(1),C.instancingMorph&&a.enable(2),C.matcap&&a.enable(3),C.envMap&&a.enable(4),C.normalMapObjectSpace&&a.enable(5),C.normalMapTangentSpace&&a.enable(6),C.clearcoat&&a.enable(7),C.iridescence&&a.enable(8),C.alphaTest&&a.enable(9),C.vertexColors&&a.enable(10),C.vertexAlphas&&a.enable(11),C.vertexUv1s&&a.enable(12),C.vertexUv2s&&a.enable(13),C.vertexUv3s&&a.enable(14),C.vertexTangents&&a.enable(15),C.anisotropy&&a.enable(16),C.alphaHash&&a.enable(17),C.batching&&a.enable(18),C.dispersion&&a.enable(19),C.batchingColor&&a.enable(20),C.gradientMap&&a.enable(21),C.packedNormalMap&&a.enable(22),C.vertexNormals&&a.enable(23),y.push(a.mask),a.disableAll(),C.fog&&a.enable(0),C.useFog&&a.enable(1),C.flatShading&&a.enable(2),C.logarithmicDepthBuffer&&a.enable(3),C.reversedDepthBuffer&&a.enable(4),C.skinning&&a.enable(5),C.morphTargets&&a.enable(6),C.morphNormals&&a.enable(7),C.morphColors&&a.enable(8),C.premultipliedAlpha&&a.enable(9),C.shadowMapEnabled&&a.enable(10),C.doubleSided&&a.enable(11),C.flipSided&&a.enable(12),C.useDepthPacking&&a.enable(13),C.dithering&&a.enable(14),C.transmission&&a.enable(15),C.sheen&&a.enable(16),C.opaque&&a.enable(17),C.pointsUvs&&a.enable(18),C.decodeVideoTexture&&a.enable(19),C.decodeVideoTextureEmissive&&a.enable(20),C.alphaToCoverage&&a.enable(21),C.numLightProbeGrids>0&&a.enable(22),C.hasPositionAttribute&&a.enable(23),y.push(a.mask)}function w(y){let C=p[y.type],z;if(C){let O=vn[C];z=Mh.clone(O.uniforms)}else z=y.uniforms;return z}function v(y,C){let z=u.get(C);return z!==void 0?++z.usedTimes:(z=new Vg(i,C,y,s),l.push(z),u.set(C,z)),z}function R(y){if(--y.usedTimes===0){let C=l.indexOf(y);l[C]=l[l.length-1],l.pop(),u.delete(y.cacheKey),y.destroy()}}function A(y){o.remove(y)}function N(){o.dispose()}return{getParameters:S,getProgramCacheKey:g,getUniforms:w,acquireProgram:v,releaseProgram:R,releaseShaderCache:A,programs:l,dispose:N}}function Xg(){let i=new WeakMap;function t(a){return i.has(a)}function e(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,c){i.get(a)[o]=c}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function qg(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function Vh(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Gh(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function a(h){let p=0;return h.isInstancedMesh&&(p+=2),h.isSkinnedMesh&&(p+=1),p}function o(h,p,x,S,g,f){let L=i[t];return L===void 0?(L={id:h.id,object:h,geometry:p,material:x,materialVariant:a(h),groupOrder:S,renderOrder:h.renderOrder,z:g,group:f},i[t]=L):(L.id=h.id,L.object=h,L.geometry=p,L.material=x,L.materialVariant=a(h),L.groupOrder=S,L.renderOrder=h.renderOrder,L.z=g,L.group=f),t++,L}function c(h,p,x,S,g,f){let L=o(h,p,x,S,g,f);x.transmission>0?n.push(L):x.transparent===!0?s.push(L):e.push(L)}function l(h,p,x,S,g,f){let L=o(h,p,x,S,g,f);x.transmission>0?n.unshift(L):x.transparent===!0?s.unshift(L):e.unshift(L)}function u(h,p,x){e.length>1&&e.sort(h||qg),n.length>1&&n.sort(p||Vh),s.length>1&&s.sort(p||Vh),x&&(e.reverse(),n.reverse(),s.reverse())}function d(){for(let h=t,p=i.length;h<p;h++){let x=i[h];if(x.id===null)break;x.id=null,x.object=null,x.geometry=null,x.material=null,x.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:c,unshift:l,finish:d,sort:u}}function Yg(){let i=new WeakMap;function t(n,s){let r=i.get(n),a;return r===void 0?(a=new Gh,i.set(n,[a])):s>=r.length?(a=new Gh,r.push(a)):a=r[s],a}function e(){i=new WeakMap}return{get:t,dispose:e}}function Zg(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new W,color:new Kt};break;case"SpotLight":e={position:new W,direction:new W,color:new Kt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new W,color:new Kt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new W,skyColor:new Kt,groundColor:new Kt};break;case"RectAreaLight":e={color:new Kt,position:new W,halfWidth:new W,halfHeight:new W};break}return i[t.id]=e,e}}}function Jg(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new yt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new yt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new yt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var $g=0;function Kg(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function jg(i){let t=new Zg,e=Jg(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new W);let s=new W,r=new ue,a=new ue;function o(l){let u=0,d=0,h=0;for(let C=0;C<9;C++)n.probe[C].set(0,0,0);let p=0,x=0,S=0,g=0,f=0,L=0,w=0,v=0,R=0,A=0,N=0;l.sort(Kg);for(let C=0,z=l.length;C<z;C++){let O=l[C],k=O.color,lt=O.intensity,ot=O.distance,J=null;if(O.shadow&&O.shadow.map&&(O.shadow.map.texture.format===ti?J=O.shadow.map.texture:J=O.shadow.map.depthTexture||O.shadow.map.texture),O.isAmbientLight)u+=k.r*lt,d+=k.g*lt,h+=k.b*lt;else if(O.isLightProbe){for(let it=0;it<9;it++)n.probe[it].addScaledVector(O.sh.coefficients[it],lt);N++}else if(O.isDirectionalLight){let it=t.get(O);if(it.color.copy(O.color).multiplyScalar(O.intensity),O.castShadow){let Y=O.shadow,V=e.get(O);V.shadowIntensity=Y.intensity,V.shadowBias=Y.bias,V.shadowNormalBias=Y.normalBias,V.shadowRadius=Y.radius,V.shadowMapSize=Y.mapSize,n.directionalShadow[p]=V,n.directionalShadowMap[p]=J,n.directionalShadowMatrix[p]=O.shadow.matrix,L++}n.directional[p]=it,p++}else if(O.isSpotLight){let it=t.get(O);it.position.setFromMatrixPosition(O.matrixWorld),it.color.copy(k).multiplyScalar(lt),it.distance=ot,it.coneCos=Math.cos(O.angle),it.penumbraCos=Math.cos(O.angle*(1-O.penumbra)),it.decay=O.decay,n.spot[S]=it;let Y=O.shadow;if(O.map&&(n.spotLightMap[R]=O.map,R++,Y.updateMatrices(O),O.castShadow&&A++),n.spotLightMatrix[S]=Y.matrix,O.castShadow){let V=e.get(O);V.shadowIntensity=Y.intensity,V.shadowBias=Y.bias,V.shadowNormalBias=Y.normalBias,V.shadowRadius=Y.radius,V.shadowMapSize=Y.mapSize,n.spotShadow[S]=V,n.spotShadowMap[S]=J,v++}S++}else if(O.isRectAreaLight){let it=t.get(O);it.color.copy(k).multiplyScalar(lt),it.halfWidth.set(O.width*.5,0,0),it.halfHeight.set(0,O.height*.5,0),n.rectArea[g]=it,g++}else if(O.isPointLight){let it=t.get(O);if(it.color.copy(O.color).multiplyScalar(O.intensity),it.distance=O.distance,it.decay=O.decay,O.castShadow){let Y=O.shadow,V=e.get(O);V.shadowIntensity=Y.intensity,V.shadowBias=Y.bias,V.shadowNormalBias=Y.normalBias,V.shadowRadius=Y.radius,V.shadowMapSize=Y.mapSize,V.shadowCameraNear=Y.camera.near,V.shadowCameraFar=Y.camera.far,n.pointShadow[x]=V,n.pointShadowMap[x]=J,n.pointShadowMatrix[x]=O.shadow.matrix,w++}n.point[x]=it,x++}else if(O.isHemisphereLight){let it=t.get(O);it.skyColor.copy(O.color).multiplyScalar(lt),it.groundColor.copy(O.groundColor).multiplyScalar(lt),n.hemi[f]=it,f++}}g>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Lt.LTC_FLOAT_1,n.rectAreaLTC2=Lt.LTC_FLOAT_2):(n.rectAreaLTC1=Lt.LTC_HALF_1,n.rectAreaLTC2=Lt.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=d,n.ambient[2]=h;let y=n.hash;(y.directionalLength!==p||y.pointLength!==x||y.spotLength!==S||y.rectAreaLength!==g||y.hemiLength!==f||y.numDirectionalShadows!==L||y.numPointShadows!==w||y.numSpotShadows!==v||y.numSpotMaps!==R||y.numLightProbes!==N)&&(n.directional.length=p,n.spot.length=S,n.rectArea.length=g,n.point.length=x,n.hemi.length=f,n.directionalShadow.length=L,n.directionalShadowMap.length=L,n.pointShadow.length=w,n.pointShadowMap.length=w,n.spotShadow.length=v,n.spotShadowMap.length=v,n.directionalShadowMatrix.length=L,n.pointShadowMatrix.length=w,n.spotLightMatrix.length=v+R-A,n.spotLightMap.length=R,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=N,y.directionalLength=p,y.pointLength=x,y.spotLength=S,y.rectAreaLength=g,y.hemiLength=f,y.numDirectionalShadows=L,y.numPointShadows=w,y.numSpotShadows=v,y.numSpotMaps=R,y.numLightProbes=N,n.version=$g++)}function c(l,u){let d=0,h=0,p=0,x=0,S=0,g=u.matrixWorldInverse;for(let f=0,L=l.length;f<L;f++){let w=l[f];if(w.isDirectionalLight){let v=n.directional[d];v.direction.setFromMatrixPosition(w.matrixWorld),s.setFromMatrixPosition(w.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(g),d++}else if(w.isSpotLight){let v=n.spot[p];v.position.setFromMatrixPosition(w.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(w.matrixWorld),s.setFromMatrixPosition(w.target.matrixWorld),v.direction.sub(s),v.direction.transformDirection(g),p++}else if(w.isRectAreaLight){let v=n.rectArea[x];v.position.setFromMatrixPosition(w.matrixWorld),v.position.applyMatrix4(g),a.identity(),r.copy(w.matrixWorld),r.premultiply(g),a.extractRotation(r),v.halfWidth.set(w.width*.5,0,0),v.halfHeight.set(0,w.height*.5,0),v.halfWidth.applyMatrix4(a),v.halfHeight.applyMatrix4(a),x++}else if(w.isPointLight){let v=n.point[h];v.position.setFromMatrixPosition(w.matrixWorld),v.position.applyMatrix4(g),h++}else if(w.isHemisphereLight){let v=n.hemi[S];v.direction.setFromMatrixPosition(w.matrixWorld),v.direction.transformDirection(g),S++}}}return{setup:o,setupView:c,state:n}}function Hh(i){let t=new jg(i),e=[],n=[],s=[];function r(h){d.camera=h,e.length=0,n.length=0,s.length=0}function a(h){e.push(h)}function o(h){n.push(h)}function c(h){s.push(h)}function l(){t.setup(e)}function u(h){t.setupView(e,h)}let d={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:d,setupLights:l,setupLightsView:u,pushLight:a,pushShadow:o,pushLightProbeGrid:c}}function Qg(i){let t=new WeakMap;function e(s,r=0){let a=t.get(s),o;return a===void 0?(o=new Hh(i),t.set(s,[o])):r>=a.length?(o=new Hh(i),a.push(o)):o=a[r],o}function n(){t=new WeakMap}return{get:e,dispose:n}}var t0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,e0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,n0=[new W(1,0,0),new W(-1,0,0),new W(0,1,0),new W(0,-1,0),new W(0,0,1),new W(0,0,-1)],i0=[new W(0,-1,0),new W(0,-1,0),new W(0,0,1),new W(0,0,-1),new W(0,-1,0),new W(0,-1,0)],Wh=new ue,Js=new W,Dl=new W;function s0(i,t,e){let n=new ki,s=new yt,r=new yt,a=new de,o=new Yr,c=new Zr,l={},u=e.maxTextureSize,d={[Ln]:De,[De]:Ln,[Ae]:Ae},h=new qe({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new yt},radius:{value:4}},vertexShader:t0,fragmentShader:e0}),p=h.clone();p.defines.HORIZONTAL_PASS=1;let x=new Le;x.setAttribute("position",new Ge(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let S=new be(x,h),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=zs;let f=this.type;this.render=function(A,N,y){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||A.length===0)return;this.type===Fc&&(Wt("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=zs);let C=i.getRenderTarget(),z=i.getActiveCubeFace(),O=i.getActiveMipmapLevel(),k=i.state;k.setBlending(_n),k.buffers.depth.getReversed()===!0?k.buffers.color.setClear(0,0,0,0):k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);let lt=f!==this.type;lt&&N.traverse(function(ot){ot.material&&(Array.isArray(ot.material)?ot.material.forEach(J=>J.needsUpdate=!0):ot.material.needsUpdate=!0)});for(let ot=0,J=A.length;ot<J;ot++){let it=A[ot],Y=it.shadow;if(Y===void 0){Wt("WebGLShadowMap:",it,"has no shadow.");continue}if(Y.autoUpdate===!1&&Y.needsUpdate===!1)continue;s.copy(Y.mapSize);let V=Y.getFrameExtents();s.multiply(V),r.copy(Y.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/V.x),s.x=r.x*V.x,Y.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/V.y),s.y=r.y*V.y,Y.mapSize.y=r.y));let pt=i.state.buffers.depth.getReversed();if(Y.camera._reversedDepth=pt,Y.map===null||lt===!0){if(Y.map!==null&&(Y.map.depthTexture!==null&&(Y.map.depthTexture.dispose(),Y.map.depthTexture=null),Y.map.dispose()),this.type===qi){if(it.isPointLight){Wt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}Y.map=new He(s.x,s.y,{format:ti,type:xn,minFilter:Ee,magFilter:Ee,generateMipmaps:!1}),Y.map.texture.name=it.name+".shadowMap",Y.map.depthTexture=new In(s.x,s.y,an),Y.map.depthTexture.name=it.name+".shadowMapDepth",Y.map.depthTexture.format=fn,Y.map.depthTexture.compareFunction=null,Y.map.depthTexture.minFilter=Se,Y.map.depthTexture.magFilter=Se}else it.isPointLight?(Y.map=new Qa(s.x),Y.map.depthTexture=new zr(s.x,rn)):(Y.map=new He(s.x,s.y),Y.map.depthTexture=new In(s.x,s.y,rn)),Y.map.depthTexture.name=it.name+".shadowMap",Y.map.depthTexture.format=fn,this.type===zs?(Y.map.depthTexture.compareFunction=pt?Ja:Za,Y.map.depthTexture.minFilter=Ee,Y.map.depthTexture.magFilter=Ee):(Y.map.depthTexture.compareFunction=null,Y.map.depthTexture.minFilter=Se,Y.map.depthTexture.magFilter=Se);Y.camera.updateProjectionMatrix()}let mt=Y.map.isWebGLCubeRenderTarget?6:1;for(let vt=0;vt<mt;vt++){if(Y.map.isWebGLCubeRenderTarget)i.setRenderTarget(Y.map,vt),i.clear();else{vt===0&&(i.setRenderTarget(Y.map),i.clear());let Ct=Y.getViewport(vt);a.set(r.x*Ct.x,r.y*Ct.y,r.x*Ct.z,r.y*Ct.w),k.viewport(a)}if(it.isPointLight){let Ct=Y.camera,Xt=Y.matrix,Jt=it.distance||Ct.far;Jt!==Ct.far&&(Ct.far=Jt,Ct.updateProjectionMatrix()),Js.setFromMatrixPosition(it.matrixWorld),Ct.position.copy(Js),Dl.copy(Ct.position),Dl.add(n0[vt]),Ct.up.copy(i0[vt]),Ct.lookAt(Dl),Ct.updateMatrixWorld(),Xt.makeTranslation(-Js.x,-Js.y,-Js.z),Wh.multiplyMatrices(Ct.projectionMatrix,Ct.matrixWorldInverse),Y._frustum.setFromProjectionMatrix(Wh,Ct.coordinateSystem,Ct.reversedDepth)}else Y.updateMatrices(it);n=Y.getFrustum(),v(N,y,Y.camera,it,this.type)}Y.isPointLightShadow!==!0&&this.type===qi&&L(Y,y),Y.needsUpdate=!1}f=this.type,g.needsUpdate=!1,i.setRenderTarget(C,z,O)};function L(A,N){let y=t.update(S);h.defines.VSM_SAMPLES!==A.blurSamples&&(h.defines.VSM_SAMPLES=A.blurSamples,p.defines.VSM_SAMPLES=A.blurSamples,h.needsUpdate=!0,p.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new He(s.x,s.y,{format:ti,type:xn})),h.uniforms.shadow_pass.value=A.map.depthTexture,h.uniforms.resolution.value=A.mapSize,h.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(N,null,y,h,S,null),p.uniforms.shadow_pass.value=A.mapPass.texture,p.uniforms.resolution.value=A.mapSize,p.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(N,null,y,p,S,null)}function w(A,N,y,C){let z=null,O=y.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(O!==void 0)z=O;else if(z=y.isPointLight===!0?c:o,i.localClippingEnabled&&N.clipShadows===!0&&Array.isArray(N.clippingPlanes)&&N.clippingPlanes.length!==0||N.displacementMap&&N.displacementScale!==0||N.alphaMap&&N.alphaTest>0||N.map&&N.alphaTest>0||N.alphaToCoverage===!0){let k=z.uuid,lt=N.uuid,ot=l[k];ot===void 0&&(ot={},l[k]=ot);let J=ot[lt];J===void 0&&(J=z.clone(),ot[lt]=J,N.addEventListener("dispose",R)),z=J}if(z.visible=N.visible,z.wireframe=N.wireframe,C===qi?z.side=N.shadowSide!==null?N.shadowSide:N.side:z.side=N.shadowSide!==null?N.shadowSide:d[N.side],z.alphaMap=N.alphaMap,z.alphaTest=N.alphaToCoverage===!0?.5:N.alphaTest,z.map=N.map,z.clipShadows=N.clipShadows,z.clippingPlanes=N.clippingPlanes,z.clipIntersection=N.clipIntersection,z.displacementMap=N.displacementMap,z.displacementScale=N.displacementScale,z.displacementBias=N.displacementBias,z.wireframeLinewidth=N.wireframeLinewidth,z.linewidth=N.linewidth,y.isPointLight===!0&&z.isMeshDistanceMaterial===!0){let k=i.properties.get(z);k.light=y}return z}function v(A,N,y,C,z){if(A.visible===!1)return;if(A.layers.test(N.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&z===qi)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,A.matrixWorld);let lt=t.update(A),ot=A.material;if(Array.isArray(ot)){let J=lt.groups;for(let it=0,Y=J.length;it<Y;it++){let V=J[it],pt=ot[V.materialIndex];if(pt&&pt.visible){let mt=w(A,pt,C,z);A.onBeforeShadow(i,A,N,y,lt,mt,V),i.renderBufferDirect(y,null,lt,mt,A,V),A.onAfterShadow(i,A,N,y,lt,mt,V)}}}else if(ot.visible){let J=w(A,ot,C,z);A.onBeforeShadow(i,A,N,y,lt,J,null),i.renderBufferDirect(y,null,lt,J,A,null),A.onAfterShadow(i,A,N,y,lt,J,null)}}let k=A.children;for(let lt=0,ot=k.length;lt<ot;lt++)v(k[lt],N,y,C,z)}function R(A){A.target.removeEventListener("dispose",R);for(let y in l){let C=l[y],z=A.target.uuid;z in C&&(C[z].dispose(),delete C[z])}}}function r0(i,t){function e(){let G=!1,bt=new de,ht=null,At=new de(0,0,0,0);return{setMask:function(Rt){ht!==Rt&&!G&&(i.colorMask(Rt,Rt,Rt,Rt),ht=Rt)},setLocked:function(Rt){G=Rt},setClear:function(Rt,xt,Ot,Ft,pe){pe===!0&&(Rt*=Ft,xt*=Ft,Ot*=Ft),bt.set(Rt,xt,Ot,Ft),At.equals(bt)===!1&&(i.clearColor(Rt,xt,Ot,Ft),At.copy(bt))},reset:function(){G=!1,ht=null,At.set(-1,0,0,0)}}}function n(){let G=!1,bt=!1,ht=null,At=null,Rt=null;return{setReversed:function(xt){if(bt!==xt){let Ot=t.get("EXT_clip_control");xt?Ot.clipControlEXT(Ot.LOWER_LEFT_EXT,Ot.ZERO_TO_ONE_EXT):Ot.clipControlEXT(Ot.LOWER_LEFT_EXT,Ot.NEGATIVE_ONE_TO_ONE_EXT),bt=xt;let Ft=Rt;Rt=null,this.setClear(Ft)}},getReversed:function(){return bt},setTest:function(xt){xt?D(i.DEPTH_TEST):P(i.DEPTH_TEST)},setMask:function(xt){ht!==xt&&!G&&(i.depthMask(xt),ht=xt)},setFunc:function(xt){if(bt&&(xt=mh[xt]),At!==xt){switch(xt){case Er:i.depthFunc(i.NEVER);break;case Ar:i.depthFunc(i.ALWAYS);break;case wr:i.depthFunc(i.LESS);break;case hi:i.depthFunc(i.LEQUAL);break;case Cr:i.depthFunc(i.EQUAL);break;case Rr:i.depthFunc(i.GEQUAL);break;case Lr:i.depthFunc(i.GREATER);break;case Pr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}At=xt}},setLocked:function(xt){G=xt},setClear:function(xt){Rt!==xt&&(Rt=xt,bt&&(xt=1-xt),i.clearDepth(xt))},reset:function(){G=!1,ht=null,At=null,Rt=null,bt=!1}}}function s(){let G=!1,bt=null,ht=null,At=null,Rt=null,xt=null,Ot=null,Ft=null,pe=null;return{setTest:function(le){G||(le?D(i.STENCIL_TEST):P(i.STENCIL_TEST))},setMask:function(le){bt!==le&&!G&&(i.stencilMask(le),bt=le)},setFunc:function(le,on,ln){(ht!==le||At!==on||Rt!==ln)&&(i.stencilFunc(le,on,ln),ht=le,At=on,Rt=ln)},setOp:function(le,on,ln){(xt!==le||Ot!==on||Ft!==ln)&&(i.stencilOp(le,on,ln),xt=le,Ot=on,Ft=ln)},setLocked:function(le){G=le},setClear:function(le){pe!==le&&(i.clearStencil(le),pe=le)},reset:function(){G=!1,bt=null,ht=null,At=null,Rt=null,xt=null,Ot=null,Ft=null,pe=null}}}let r=new e,a=new n,o=new s,c=new WeakMap,l=new WeakMap,u={},d={},h={},p=new WeakMap,x=[],S=null,g=!1,f=null,L=null,w=null,v=null,R=null,A=null,N=null,y=new Kt(0,0,0),C=0,z=!1,O=null,k=null,lt=null,ot=null,J=null,it=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Y=!1,V=0,pt=i.getParameter(i.VERSION);pt.indexOf("WebGL")!==-1?(V=parseFloat(/^WebGL (\d)/.exec(pt)[1]),Y=V>=1):pt.indexOf("OpenGL ES")!==-1&&(V=parseFloat(/^OpenGL ES (\d)/.exec(pt)[1]),Y=V>=2);let mt=null,vt={},Ct=i.getParameter(i.SCISSOR_BOX),Xt=i.getParameter(i.VIEWPORT),Jt=new de().fromArray(Ct),Yt=new de().fromArray(Xt);function ct(G,bt,ht,At){let Rt=new Uint8Array(4),xt=i.createTexture();i.bindTexture(G,xt),i.texParameteri(G,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(G,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ot=0;Ot<ht;Ot++)G===i.TEXTURE_3D||G===i.TEXTURE_2D_ARRAY?i.texImage3D(bt,0,i.RGBA,1,1,At,0,i.RGBA,i.UNSIGNED_BYTE,Rt):i.texImage2D(bt+Ot,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,Rt);return xt}let X={};X[i.TEXTURE_2D]=ct(i.TEXTURE_2D,i.TEXTURE_2D,1),X[i.TEXTURE_CUBE_MAP]=ct(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),X[i.TEXTURE_2D_ARRAY]=ct(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),X[i.TEXTURE_3D]=ct(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),D(i.DEPTH_TEST),a.setFunc(hi),$(!1),K(jo),D(i.CULL_FACE),F(_n);function D(G){u[G]!==!0&&(i.enable(G),u[G]=!0)}function P(G){u[G]!==!1&&(i.disable(G),u[G]=!1)}function E(G,bt){return h[G]!==bt?(i.bindFramebuffer(G,bt),h[G]=bt,G===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=bt),G===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=bt),!0):!1}function B(G,bt){let ht=x,At=!1;if(G){ht=p.get(bt),ht===void 0&&(ht=[],p.set(bt,ht));let Rt=G.textures;if(ht.length!==Rt.length||ht[0]!==i.COLOR_ATTACHMENT0){for(let xt=0,Ot=Rt.length;xt<Ot;xt++)ht[xt]=i.COLOR_ATTACHMENT0+xt;ht.length=Rt.length,At=!0}}else ht[0]!==i.BACK&&(ht[0]=i.BACK,At=!0);At&&i.drawBuffers(ht)}function et(G){return S!==G?(i.useProgram(G),S=G,!0):!1}let ut={[Wn]:i.FUNC_ADD,[Bc]:i.FUNC_SUBTRACT,[zc]:i.FUNC_REVERSE_SUBTRACT};ut[kc]=i.MIN,ut[Vc]=i.MAX;let T={[Gc]:i.ZERO,[Hc]:i.ONE,[Wc]:i.SRC_COLOR,[br]:i.SRC_ALPHA,[$c]:i.SRC_ALPHA_SATURATE,[Zc]:i.DST_COLOR,[qc]:i.DST_ALPHA,[Xc]:i.ONE_MINUS_SRC_COLOR,[Tr]:i.ONE_MINUS_SRC_ALPHA,[Jc]:i.ONE_MINUS_DST_COLOR,[Yc]:i.ONE_MINUS_DST_ALPHA,[Kc]:i.CONSTANT_COLOR,[jc]:i.ONE_MINUS_CONSTANT_COLOR,[Qc]:i.CONSTANT_ALPHA,[th]:i.ONE_MINUS_CONSTANT_ALPHA};function F(G,bt,ht,At,Rt,xt,Ot,Ft,pe,le){if(G===_n){g===!0&&(P(i.BLEND),g=!1);return}if(g===!1&&(D(i.BLEND),g=!0),G!==Oc){if(G!==f||le!==z){if((L!==Wn||R!==Wn)&&(i.blendEquation(i.FUNC_ADD),L=Wn,R=Wn),le)switch(G){case ci:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Qo:i.blendFunc(i.ONE,i.ONE);break;case tl:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case el:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:qt("WebGLState: Invalid blending: ",G);break}else switch(G){case ci:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Qo:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case tl:qt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case el:qt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:qt("WebGLState: Invalid blending: ",G);break}w=null,v=null,A=null,N=null,y.set(0,0,0),C=0,f=G,z=le}return}Rt=Rt||bt,xt=xt||ht,Ot=Ot||At,(bt!==L||Rt!==R)&&(i.blendEquationSeparate(ut[bt],ut[Rt]),L=bt,R=Rt),(ht!==w||At!==v||xt!==A||Ot!==N)&&(i.blendFuncSeparate(T[ht],T[At],T[xt],T[Ot]),w=ht,v=At,A=xt,N=Ot),(Ft.equals(y)===!1||pe!==C)&&(i.blendColor(Ft.r,Ft.g,Ft.b,pe),y.copy(Ft),C=pe),f=G,z=!1}function I(G,bt){G.side===Ae?P(i.CULL_FACE):D(i.CULL_FACE);let ht=G.side===De;bt&&(ht=!ht),$(ht),G.blending===ci&&G.transparent===!1?F(_n):F(G.blending,G.blendEquation,G.blendSrc,G.blendDst,G.blendEquationAlpha,G.blendSrcAlpha,G.blendDstAlpha,G.blendColor,G.blendAlpha,G.premultipliedAlpha),a.setFunc(G.depthFunc),a.setTest(G.depthTest),a.setMask(G.depthWrite),r.setMask(G.colorWrite);let At=G.stencilWrite;o.setTest(At),At&&(o.setMask(G.stencilWriteMask),o.setFunc(G.stencilFunc,G.stencilRef,G.stencilFuncMask),o.setOp(G.stencilFail,G.stencilZFail,G.stencilZPass)),gt(G.polygonOffset,G.polygonOffsetFactor,G.polygonOffsetUnits),G.alphaToCoverage===!0?D(i.SAMPLE_ALPHA_TO_COVERAGE):P(i.SAMPLE_ALPHA_TO_COVERAGE)}function $(G){O!==G&&(G?i.frontFace(i.CW):i.frontFace(i.CCW),O=G)}function K(G){G!==Dc?(D(i.CULL_FACE),G!==k&&(G===jo?i.cullFace(i.BACK):G===Uc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):P(i.CULL_FACE),k=G}function rt(G){G!==lt&&(Y&&i.lineWidth(G),lt=G)}function gt(G,bt,ht){G?(D(i.POLYGON_OFFSET_FILL),(ot!==bt||J!==ht)&&(ot=bt,J=ht,a.getReversed()&&(bt=-bt),i.polygonOffset(bt,ht))):P(i.POLYGON_OFFSET_FILL)}function _t(G){G?D(i.SCISSOR_TEST):P(i.SCISSOR_TEST)}function H(G){G===void 0&&(G=i.TEXTURE0+it-1),mt!==G&&(i.activeTexture(G),mt=G)}function m(G,bt,ht){ht===void 0&&(mt===null?ht=i.TEXTURE0+it-1:ht=mt);let At=vt[ht];At===void 0&&(At={type:void 0,texture:void 0},vt[ht]=At),(At.type!==G||At.texture!==bt)&&(mt!==ht&&(i.activeTexture(ht),mt=ht),i.bindTexture(G,bt||X[G]),At.type=G,At.texture=bt)}function j(){let G=vt[mt];G!==void 0&&G.type!==void 0&&(i.bindTexture(G.type,null),G.type=void 0,G.texture=void 0)}function ft(){try{i.compressedTexImage2D(...arguments)}catch(G){qt("WebGLState:",G)}}function b(){try{i.compressedTexImage3D(...arguments)}catch(G){qt("WebGLState:",G)}}function _(){try{i.texSubImage2D(...arguments)}catch(G){qt("WebGLState:",G)}}function U(){try{i.texSubImage3D(...arguments)}catch(G){qt("WebGLState:",G)}}function Z(){try{i.compressedTexSubImage2D(...arguments)}catch(G){qt("WebGLState:",G)}}function st(){try{i.compressedTexSubImage3D(...arguments)}catch(G){qt("WebGLState:",G)}}function Mt(){try{i.texStorage2D(...arguments)}catch(G){qt("WebGLState:",G)}}function St(){try{i.texStorage3D(...arguments)}catch(G){qt("WebGLState:",G)}}function at(){try{i.texImage2D(...arguments)}catch(G){qt("WebGLState:",G)}}function dt(){try{i.texImage3D(...arguments)}catch(G){qt("WebGLState:",G)}}function Tt(G){return d[G]!==void 0?d[G]:i.getParameter(G)}function Ut(G,bt){d[G]!==bt&&(i.pixelStorei(G,bt),d[G]=bt)}function wt(G){Jt.equals(G)===!1&&(i.scissor(G.x,G.y,G.z,G.w),Jt.copy(G))}function Et(G){Yt.equals(G)===!1&&(i.viewport(G.x,G.y,G.z,G.w),Yt.copy(G))}function zt(G,bt){let ht=l.get(bt);ht===void 0&&(ht=new WeakMap,l.set(bt,ht));let At=ht.get(G);At===void 0&&(At=i.getUniformBlockIndex(bt,G.name),ht.set(G,At))}function Ht(G,bt){let At=l.get(bt).get(G);c.get(bt)!==At&&(i.uniformBlockBinding(bt,At,G.__bindingPointIndex),c.set(bt,At))}function Zt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),u={},d={},mt=null,vt={},h={},p=new WeakMap,x=[],S=null,g=!1,f=null,L=null,w=null,v=null,R=null,A=null,N=null,y=new Kt(0,0,0),C=0,z=!1,O=null,k=null,lt=null,ot=null,J=null,Jt.set(0,0,i.canvas.width,i.canvas.height),Yt.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:D,disable:P,bindFramebuffer:E,drawBuffers:B,useProgram:et,setBlending:F,setMaterial:I,setFlipSided:$,setCullFace:K,setLineWidth:rt,setPolygonOffset:gt,setScissorTest:_t,activeTexture:H,bindTexture:m,unbindTexture:j,compressedTexImage2D:ft,compressedTexImage3D:b,texImage2D:at,texImage3D:dt,pixelStorei:Ut,getParameter:Tt,updateUBOMapping:zt,uniformBlockBinding:Ht,texStorage2D:Mt,texStorage3D:St,texSubImage2D:_,texSubImage3D:U,compressedTexSubImage2D:Z,compressedTexSubImage3D:st,scissor:wt,viewport:Et,reset:Zt}}function a0(i,t,e,n,s,r,a){let o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator=="undefined"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new yt,u=new WeakMap,d=new Set,h,p=new WeakMap,x=!1;try{x=typeof OffscreenCanvas!="undefined"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function S(b,_){return x?new OffscreenCanvas(b,_):us("canvas")}function g(b,_,U){let Z=1,st=ft(b);if((st.width>U||st.height>U)&&(Z=U/Math.max(st.width,st.height)),Z<1)if(typeof HTMLImageElement!="undefined"&&b instanceof HTMLImageElement||typeof HTMLCanvasElement!="undefined"&&b instanceof HTMLCanvasElement||typeof ImageBitmap!="undefined"&&b instanceof ImageBitmap||typeof VideoFrame!="undefined"&&b instanceof VideoFrame){let Mt=Math.floor(Z*st.width),St=Math.floor(Z*st.height);h===void 0&&(h=S(Mt,St));let at=_?S(Mt,St):h;return at.width=Mt,at.height=St,at.getContext("2d").drawImage(b,0,0,Mt,St),Wt("WebGLRenderer: Texture has been resized from ("+st.width+"x"+st.height+") to ("+Mt+"x"+St+")."),at}else return"data"in b&&Wt("WebGLRenderer: Image in DataTexture is too big ("+st.width+"x"+st.height+")."),b;return b}function f(b){return b.generateMipmaps}function L(b){i.generateMipmap(b)}function w(b){return b.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:b.isWebGL3DRenderTarget?i.TEXTURE_3D:b.isWebGLArrayRenderTarget||b.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function v(b,_,U,Z,st,Mt=!1){if(b!==null){if(i[b]!==void 0)return i[b];Wt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+b+"'")}let St;Z&&(St=t.get("EXT_texture_norm16"),St||Wt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let at=_;if(_===i.RED&&(U===i.FLOAT&&(at=i.R32F),U===i.HALF_FLOAT&&(at=i.R16F),U===i.UNSIGNED_BYTE&&(at=i.R8),U===i.UNSIGNED_SHORT&&St&&(at=St.R16_EXT),U===i.SHORT&&St&&(at=St.R16_SNORM_EXT)),_===i.RED_INTEGER&&(U===i.UNSIGNED_BYTE&&(at=i.R8UI),U===i.UNSIGNED_SHORT&&(at=i.R16UI),U===i.UNSIGNED_INT&&(at=i.R32UI),U===i.BYTE&&(at=i.R8I),U===i.SHORT&&(at=i.R16I),U===i.INT&&(at=i.R32I)),_===i.RG&&(U===i.FLOAT&&(at=i.RG32F),U===i.HALF_FLOAT&&(at=i.RG16F),U===i.UNSIGNED_BYTE&&(at=i.RG8),U===i.UNSIGNED_SHORT&&St&&(at=St.RG16_EXT),U===i.SHORT&&St&&(at=St.RG16_SNORM_EXT)),_===i.RG_INTEGER&&(U===i.UNSIGNED_BYTE&&(at=i.RG8UI),U===i.UNSIGNED_SHORT&&(at=i.RG16UI),U===i.UNSIGNED_INT&&(at=i.RG32UI),U===i.BYTE&&(at=i.RG8I),U===i.SHORT&&(at=i.RG16I),U===i.INT&&(at=i.RG32I)),_===i.RGB_INTEGER&&(U===i.UNSIGNED_BYTE&&(at=i.RGB8UI),U===i.UNSIGNED_SHORT&&(at=i.RGB16UI),U===i.UNSIGNED_INT&&(at=i.RGB32UI),U===i.BYTE&&(at=i.RGB8I),U===i.SHORT&&(at=i.RGB16I),U===i.INT&&(at=i.RGB32I)),_===i.RGBA_INTEGER&&(U===i.UNSIGNED_BYTE&&(at=i.RGBA8UI),U===i.UNSIGNED_SHORT&&(at=i.RGBA16UI),U===i.UNSIGNED_INT&&(at=i.RGBA32UI),U===i.BYTE&&(at=i.RGBA8I),U===i.SHORT&&(at=i.RGBA16I),U===i.INT&&(at=i.RGBA32I)),_===i.RGB&&(U===i.UNSIGNED_SHORT&&St&&(at=St.RGB16_EXT),U===i.SHORT&&St&&(at=St.RGB16_SNORM_EXT),U===i.UNSIGNED_INT_5_9_9_9_REV&&(at=i.RGB9_E5),U===i.UNSIGNED_INT_10F_11F_11F_REV&&(at=i.R11F_G11F_B10F)),_===i.RGBA){let dt=Mt?hs:ee.getTransfer(st);U===i.FLOAT&&(at=i.RGBA32F),U===i.HALF_FLOAT&&(at=i.RGBA16F),U===i.UNSIGNED_BYTE&&(at=dt===ie?i.SRGB8_ALPHA8:i.RGBA8),U===i.UNSIGNED_SHORT&&St&&(at=St.RGBA16_EXT),U===i.SHORT&&St&&(at=St.RGBA16_SNORM_EXT),U===i.UNSIGNED_SHORT_4_4_4_4&&(at=i.RGBA4),U===i.UNSIGNED_SHORT_5_5_5_1&&(at=i.RGB5_A1)}return(at===i.R16F||at===i.R32F||at===i.RG16F||at===i.RG32F||at===i.RGBA16F||at===i.RGBA32F)&&t.get("EXT_color_buffer_float"),at}function R(b,_){let U;return b?_===null||_===rn||_===Zi?U=i.DEPTH24_STENCIL8:_===an?U=i.DEPTH32F_STENCIL8:_===Yi&&(U=i.DEPTH24_STENCIL8,Wt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===rn||_===Zi?U=i.DEPTH_COMPONENT24:_===an?U=i.DEPTH_COMPONENT32F:_===Yi&&(U=i.DEPTH_COMPONENT16),U}function A(b,_){return f(b)===!0||b.isFramebufferTexture&&b.minFilter!==Se&&b.minFilter!==Ee?Math.log2(Math.max(_.width,_.height))+1:b.mipmaps!==void 0&&b.mipmaps.length>0?b.mipmaps.length:b.isCompressedTexture&&Array.isArray(b.image)?_.mipmaps.length:1}function N(b){let _=b.target;_.removeEventListener("dispose",N),C(_),_.isVideoTexture&&u.delete(_),_.isHTMLTexture&&d.delete(_)}function y(b){let _=b.target;_.removeEventListener("dispose",y),O(_)}function C(b){let _=n.get(b);if(_.__webglInit===void 0)return;let U=b.source,Z=p.get(U);if(Z){let st=Z[_.__cacheKey];st.usedTimes--,st.usedTimes===0&&z(b),Object.keys(Z).length===0&&p.delete(U)}n.remove(b)}function z(b){let _=n.get(b);i.deleteTexture(_.__webglTexture);let U=b.source,Z=p.get(U);delete Z[_.__cacheKey],a.memory.textures--}function O(b){let _=n.get(b);if(b.depthTexture&&(b.depthTexture.dispose(),n.remove(b.depthTexture)),b.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(_.__webglFramebuffer[Z]))for(let st=0;st<_.__webglFramebuffer[Z].length;st++)i.deleteFramebuffer(_.__webglFramebuffer[Z][st]);else i.deleteFramebuffer(_.__webglFramebuffer[Z]);_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer[Z])}else{if(Array.isArray(_.__webglFramebuffer))for(let Z=0;Z<_.__webglFramebuffer.length;Z++)i.deleteFramebuffer(_.__webglFramebuffer[Z]);else i.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&i.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let Z=0;Z<_.__webglColorRenderbuffer.length;Z++)_.__webglColorRenderbuffer[Z]&&i.deleteRenderbuffer(_.__webglColorRenderbuffer[Z]);_.__webglDepthRenderbuffer&&i.deleteRenderbuffer(_.__webglDepthRenderbuffer)}let U=b.textures;for(let Z=0,st=U.length;Z<st;Z++){let Mt=n.get(U[Z]);Mt.__webglTexture&&(i.deleteTexture(Mt.__webglTexture),a.memory.textures--),n.remove(U[Z])}n.remove(b)}let k=0;function lt(){k=0}function ot(){return k}function J(b){k=b}function it(){let b=k;return b>=s.maxTextures&&Wt("WebGLTextures: Trying to use "+b+" texture units while this GPU supports only "+s.maxTextures),k+=1,b}function Y(b){let _=[];return _.push(b.wrapS),_.push(b.wrapT),_.push(b.wrapR||0),_.push(b.magFilter),_.push(b.minFilter),_.push(b.anisotropy),_.push(b.internalFormat),_.push(b.format),_.push(b.type),_.push(b.generateMipmaps),_.push(b.premultiplyAlpha),_.push(b.flipY),_.push(b.unpackAlignment),_.push(b.colorSpace),_.join()}function V(b,_){let U=n.get(b);if(b.isVideoTexture&&m(b),b.isRenderTargetTexture===!1&&b.isExternalTexture!==!0&&b.version>0&&U.__version!==b.version){let Z=b.image;if(Z===null)Wt("WebGLRenderer: Texture marked for update but no image data found.");else if(Z.complete===!1)Wt("WebGLRenderer: Texture marked for update but image is incomplete");else{P(U,b,_);return}}else b.isExternalTexture&&(U.__webglTexture=b.sourceTexture?b.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,U.__webglTexture,i.TEXTURE0+_)}function pt(b,_){let U=n.get(b);if(b.isRenderTargetTexture===!1&&b.version>0&&U.__version!==b.version){P(U,b,_);return}else b.isExternalTexture&&(U.__webglTexture=b.sourceTexture?b.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,U.__webglTexture,i.TEXTURE0+_)}function mt(b,_){let U=n.get(b);if(b.isRenderTargetTexture===!1&&b.version>0&&U.__version!==b.version){P(U,b,_);return}e.bindTexture(i.TEXTURE_3D,U.__webglTexture,i.TEXTURE0+_)}function vt(b,_){let U=n.get(b);if(b.isCubeDepthTexture!==!0&&b.version>0&&U.__version!==b.version){E(U,b,_);return}e.bindTexture(i.TEXTURE_CUBE_MAP,U.__webglTexture,i.TEXTURE0+_)}let Ct={[Ni]:i.REPEAT,[Ke]:i.CLAMP_TO_EDGE,[Di]:i.MIRRORED_REPEAT},Xt={[Se]:i.NEAREST,[ih]:i.NEAREST_MIPMAP_NEAREST,[Vs]:i.NEAREST_MIPMAP_LINEAR,[Ee]:i.LINEAR,[ha]:i.LINEAR_MIPMAP_NEAREST,[jn]:i.LINEAR_MIPMAP_LINEAR},Jt={[ah]:i.NEVER,[uh]:i.ALWAYS,[oh]:i.LESS,[Za]:i.LEQUAL,[lh]:i.EQUAL,[Ja]:i.GEQUAL,[ch]:i.GREATER,[hh]:i.NOTEQUAL};function Yt(b,_){if(_.type===an&&t.has("OES_texture_float_linear")===!1&&(_.magFilter===Ee||_.magFilter===ha||_.magFilter===Vs||_.magFilter===jn||_.minFilter===Ee||_.minFilter===ha||_.minFilter===Vs||_.minFilter===jn)&&Wt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(b,i.TEXTURE_WRAP_S,Ct[_.wrapS]),i.texParameteri(b,i.TEXTURE_WRAP_T,Ct[_.wrapT]),(b===i.TEXTURE_3D||b===i.TEXTURE_2D_ARRAY)&&i.texParameteri(b,i.TEXTURE_WRAP_R,Ct[_.wrapR]),i.texParameteri(b,i.TEXTURE_MAG_FILTER,Xt[_.magFilter]),i.texParameteri(b,i.TEXTURE_MIN_FILTER,Xt[_.minFilter]),_.compareFunction&&(i.texParameteri(b,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(b,i.TEXTURE_COMPARE_FUNC,Jt[_.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===Se||_.minFilter!==Vs&&_.minFilter!==jn||_.type===an&&t.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||n.get(_).__currentAnisotropy){let U=t.get("EXT_texture_filter_anisotropic");i.texParameterf(b,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,s.getMaxAnisotropy())),n.get(_).__currentAnisotropy=_.anisotropy}}}function ct(b,_){let U=!1;b.__webglInit===void 0&&(b.__webglInit=!0,_.addEventListener("dispose",N));let Z=_.source,st=p.get(Z);st===void 0&&(st={},p.set(Z,st));let Mt=Y(_);if(Mt!==b.__cacheKey){st[Mt]===void 0&&(st[Mt]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,U=!0),st[Mt].usedTimes++;let St=st[b.__cacheKey];St!==void 0&&(st[b.__cacheKey].usedTimes--,St.usedTimes===0&&z(_)),b.__cacheKey=Mt,b.__webglTexture=st[Mt].texture}return U}function X(b,_,U){return Math.floor(Math.floor(b/U)/_)}function D(b,_,U,Z){let Mt=b.updateRanges;if(Mt.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,_.width,_.height,U,Z,_.data);else{Mt.sort((Ut,wt)=>Ut.start-wt.start);let St=0;for(let Ut=1;Ut<Mt.length;Ut++){let wt=Mt[St],Et=Mt[Ut],zt=wt.start+wt.count,Ht=X(Et.start,_.width,4),Zt=X(wt.start,_.width,4);Et.start<=zt+1&&Ht===Zt&&X(Et.start+Et.count-1,_.width,4)===Ht?wt.count=Math.max(wt.count,Et.start+Et.count-wt.start):(++St,Mt[St]=Et)}Mt.length=St+1;let at=e.getParameter(i.UNPACK_ROW_LENGTH),dt=e.getParameter(i.UNPACK_SKIP_PIXELS),Tt=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,_.width);for(let Ut=0,wt=Mt.length;Ut<wt;Ut++){let Et=Mt[Ut],zt=Math.floor(Et.start/4),Ht=Math.ceil(Et.count/4),Zt=zt%_.width,G=Math.floor(zt/_.width),bt=Ht,ht=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,Zt),e.pixelStorei(i.UNPACK_SKIP_ROWS,G),e.texSubImage2D(i.TEXTURE_2D,0,Zt,G,bt,ht,U,Z,_.data)}b.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,at),e.pixelStorei(i.UNPACK_SKIP_PIXELS,dt),e.pixelStorei(i.UNPACK_SKIP_ROWS,Tt)}}function P(b,_,U){let Z=i.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(Z=i.TEXTURE_2D_ARRAY),_.isData3DTexture&&(Z=i.TEXTURE_3D);let st=ct(b,_),Mt=_.source;e.bindTexture(Z,b.__webglTexture,i.TEXTURE0+U);let St=n.get(Mt);if(Mt.version!==St.__version||st===!0){if(e.activeTexture(i.TEXTURE0+U),(typeof ImageBitmap!="undefined"&&_.image instanceof ImageBitmap)===!1){let ht=ee.getPrimaries(ee.workingColorSpace),At=_.colorSpace===Nn?null:ee.getPrimaries(_.colorSpace),Rt=_.colorSpace===Nn||ht===At?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Rt)}e.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment);let dt=g(_.image,!1,s.maxTextureSize);dt=j(_,dt);let Tt=r.convert(_.format,_.colorSpace),Ut=r.convert(_.type),wt=v(_.internalFormat,Tt,Ut,_.normalized,_.colorSpace,_.isVideoTexture);Yt(Z,_);let Et,zt=_.mipmaps,Ht=_.isVideoTexture!==!0,Zt=St.__version===void 0||st===!0,G=Mt.dataReady,bt=A(_,dt);if(_.isDepthTexture)wt=R(_.format===Qn,_.type),Zt&&(Ht?e.texStorage2D(i.TEXTURE_2D,1,wt,dt.width,dt.height):e.texImage2D(i.TEXTURE_2D,0,wt,dt.width,dt.height,0,Tt,Ut,null));else if(_.isDataTexture)if(zt.length>0){Ht&&Zt&&e.texStorage2D(i.TEXTURE_2D,bt,wt,zt[0].width,zt[0].height);for(let ht=0,At=zt.length;ht<At;ht++)Et=zt[ht],Ht?G&&e.texSubImage2D(i.TEXTURE_2D,ht,0,0,Et.width,Et.height,Tt,Ut,Et.data):e.texImage2D(i.TEXTURE_2D,ht,wt,Et.width,Et.height,0,Tt,Ut,Et.data);_.generateMipmaps=!1}else Ht?(Zt&&e.texStorage2D(i.TEXTURE_2D,bt,wt,dt.width,dt.height),G&&D(_,dt,Tt,Ut)):e.texImage2D(i.TEXTURE_2D,0,wt,dt.width,dt.height,0,Tt,Ut,dt.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Ht&&Zt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,bt,wt,zt[0].width,zt[0].height,dt.depth);for(let ht=0,At=zt.length;ht<At;ht++)if(Et=zt[ht],_.format!==je)if(Tt!==null)if(Ht){if(G)if(_.layerUpdates.size>0){let Rt=bl(Et.width,Et.height,_.format,_.type);for(let xt of _.layerUpdates){let Ot=Et.data.subarray(xt*Rt/Et.data.BYTES_PER_ELEMENT,(xt+1)*Rt/Et.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ht,0,0,xt,Et.width,Et.height,1,Tt,Ot)}_.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,ht,0,0,0,Et.width,Et.height,dt.depth,Tt,Et.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,ht,wt,Et.width,Et.height,dt.depth,0,Et.data,0,0);else Wt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ht?G&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,ht,0,0,0,Et.width,Et.height,dt.depth,Tt,Ut,Et.data):e.texImage3D(i.TEXTURE_2D_ARRAY,ht,wt,Et.width,Et.height,dt.depth,0,Tt,Ut,Et.data)}else{Ht&&Zt&&e.texStorage2D(i.TEXTURE_2D,bt,wt,zt[0].width,zt[0].height);for(let ht=0,At=zt.length;ht<At;ht++)Et=zt[ht],_.format!==je?Tt!==null?Ht?G&&e.compressedTexSubImage2D(i.TEXTURE_2D,ht,0,0,Et.width,Et.height,Tt,Et.data):e.compressedTexImage2D(i.TEXTURE_2D,ht,wt,Et.width,Et.height,0,Et.data):Wt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ht?G&&e.texSubImage2D(i.TEXTURE_2D,ht,0,0,Et.width,Et.height,Tt,Ut,Et.data):e.texImage2D(i.TEXTURE_2D,ht,wt,Et.width,Et.height,0,Tt,Ut,Et.data)}else if(_.isDataArrayTexture)if(Ht){if(Zt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,bt,wt,dt.width,dt.height,dt.depth),G)if(_.layerUpdates.size>0){let ht=bl(dt.width,dt.height,_.format,_.type);for(let At of _.layerUpdates){let Rt=dt.data.subarray(At*ht/dt.data.BYTES_PER_ELEMENT,(At+1)*ht/dt.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,At,dt.width,dt.height,1,Tt,Ut,Rt)}_.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,dt.width,dt.height,dt.depth,Tt,Ut,dt.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,wt,dt.width,dt.height,dt.depth,0,Tt,Ut,dt.data);else if(_.isData3DTexture)Ht?(Zt&&e.texStorage3D(i.TEXTURE_3D,bt,wt,dt.width,dt.height,dt.depth),G&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,dt.width,dt.height,dt.depth,Tt,Ut,dt.data)):e.texImage3D(i.TEXTURE_3D,0,wt,dt.width,dt.height,dt.depth,0,Tt,Ut,dt.data);else if(_.isFramebufferTexture){if(Zt)if(Ht)e.texStorage2D(i.TEXTURE_2D,bt,wt,dt.width,dt.height);else{let ht=dt.width,At=dt.height;for(let Rt=0;Rt<bt;Rt++)e.texImage2D(i.TEXTURE_2D,Rt,wt,ht,At,0,Tt,Ut,null),ht>>=1,At>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in i){let ht=i.canvas;if(ht.hasAttribute("layoutsubtree")||ht.setAttribute("layoutsubtree","true"),dt.parentNode!==ht){ht.appendChild(dt),d.add(_),ht.onpaint=At=>{let Rt=At.changedElements;for(let xt of d)Rt.includes(xt.image)&&(xt.needsUpdate=!0)},ht.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,dt);else{let Rt=i.RGBA,xt=i.RGBA,Ot=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,Rt,xt,Ot,dt)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(zt.length>0){if(Ht&&Zt){let ht=ft(zt[0]);e.texStorage2D(i.TEXTURE_2D,bt,wt,ht.width,ht.height)}for(let ht=0,At=zt.length;ht<At;ht++)Et=zt[ht],Ht?G&&e.texSubImage2D(i.TEXTURE_2D,ht,0,0,Tt,Ut,Et):e.texImage2D(i.TEXTURE_2D,ht,wt,Tt,Ut,Et);_.generateMipmaps=!1}else if(Ht){if(Zt){let ht=ft(dt);e.texStorage2D(i.TEXTURE_2D,bt,wt,ht.width,ht.height)}G&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,Tt,Ut,dt)}else e.texImage2D(i.TEXTURE_2D,0,wt,Tt,Ut,dt);f(_)&&L(Z),St.__version=Mt.version,_.onUpdate&&_.onUpdate(_)}b.__version=_.version}function E(b,_,U){if(_.image.length!==6)return;let Z=ct(b,_),st=_.source;e.bindTexture(i.TEXTURE_CUBE_MAP,b.__webglTexture,i.TEXTURE0+U);let Mt=n.get(st);if(st.version!==Mt.__version||Z===!0){e.activeTexture(i.TEXTURE0+U);let St=ee.getPrimaries(ee.workingColorSpace),at=_.colorSpace===Nn?null:ee.getPrimaries(_.colorSpace),dt=_.colorSpace===Nn||St===at?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,dt);let Tt=_.isCompressedTexture||_.image[0].isCompressedTexture,Ut=_.image[0]&&_.image[0].isDataTexture,wt=[];for(let xt=0;xt<6;xt++)!Tt&&!Ut?wt[xt]=g(_.image[xt],!0,s.maxCubemapSize):wt[xt]=Ut?_.image[xt].image:_.image[xt],wt[xt]=j(_,wt[xt]);let Et=wt[0],zt=r.convert(_.format,_.colorSpace),Ht=r.convert(_.type),Zt=v(_.internalFormat,zt,Ht,_.normalized,_.colorSpace),G=_.isVideoTexture!==!0,bt=Mt.__version===void 0||Z===!0,ht=st.dataReady,At=A(_,Et);Yt(i.TEXTURE_CUBE_MAP,_);let Rt;if(Tt){G&&bt&&e.texStorage2D(i.TEXTURE_CUBE_MAP,At,Zt,Et.width,Et.height);for(let xt=0;xt<6;xt++){Rt=wt[xt].mipmaps;for(let Ot=0;Ot<Rt.length;Ot++){let Ft=Rt[Ot];_.format!==je?zt!==null?G?ht&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot,0,0,Ft.width,Ft.height,zt,Ft.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot,Zt,Ft.width,Ft.height,0,Ft.data):Wt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):G?ht&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot,0,0,Ft.width,Ft.height,zt,Ht,Ft.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot,Zt,Ft.width,Ft.height,0,zt,Ht,Ft.data)}}}else{if(Rt=_.mipmaps,G&&bt){Rt.length>0&&At++;let xt=ft(wt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,At,Zt,xt.width,xt.height)}for(let xt=0;xt<6;xt++)if(Ut){G?ht&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,0,0,0,wt[xt].width,wt[xt].height,zt,Ht,wt[xt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,0,Zt,wt[xt].width,wt[xt].height,0,zt,Ht,wt[xt].data);for(let Ot=0;Ot<Rt.length;Ot++){let pe=Rt[Ot].image[xt].image;G?ht&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot+1,0,0,pe.width,pe.height,zt,Ht,pe.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot+1,Zt,pe.width,pe.height,0,zt,Ht,pe.data)}}else{G?ht&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,0,0,0,zt,Ht,wt[xt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,0,Zt,zt,Ht,wt[xt]);for(let Ot=0;Ot<Rt.length;Ot++){let Ft=Rt[Ot];G?ht&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot+1,0,0,zt,Ht,Ft.image[xt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+xt,Ot+1,Zt,zt,Ht,Ft.image[xt])}}}f(_)&&L(i.TEXTURE_CUBE_MAP),Mt.__version=st.version,_.onUpdate&&_.onUpdate(_)}b.__version=_.version}function B(b,_,U,Z,st,Mt){let St=r.convert(U.format,U.colorSpace),at=r.convert(U.type),dt=v(U.internalFormat,St,at,U.normalized,U.colorSpace),Tt=n.get(_),Ut=n.get(U);if(Ut.__renderTarget=_,!Tt.__hasExternalTextures){let wt=Math.max(1,_.width>>Mt),Et=Math.max(1,_.height>>Mt);st===i.TEXTURE_3D||st===i.TEXTURE_2D_ARRAY?e.texImage3D(st,Mt,dt,wt,Et,_.depth,0,St,at,null):e.texImage2D(st,Mt,dt,wt,Et,0,St,at,null)}e.bindFramebuffer(i.FRAMEBUFFER,b),H(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Z,st,Ut.__webglTexture,0,_t(_)):(st===i.TEXTURE_2D||st>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&st<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Z,st,Ut.__webglTexture,Mt),e.bindFramebuffer(i.FRAMEBUFFER,null)}function et(b,_,U){if(i.bindRenderbuffer(i.RENDERBUFFER,b),_.depthBuffer){let Z=_.depthTexture,st=Z&&Z.isDepthTexture?Z.type:null,Mt=R(_.stencilBuffer,st),St=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;H(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,_t(_),Mt,_.width,_.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,_t(_),Mt,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,Mt,_.width,_.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,St,i.RENDERBUFFER,b)}else{let Z=_.textures;for(let st=0;st<Z.length;st++){let Mt=Z[st],St=r.convert(Mt.format,Mt.colorSpace),at=r.convert(Mt.type),dt=v(Mt.internalFormat,St,at,Mt.normalized,Mt.colorSpace);H(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,_t(_),dt,_.width,_.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,_t(_),dt,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,dt,_.width,_.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function ut(b,_,U){let Z=_.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,b),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let st=n.get(_.depthTexture);if(st.__renderTarget=_,(!st.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),Z){if(st.__webglInit===void 0&&(st.__webglInit=!0,_.depthTexture.addEventListener("dispose",N)),st.__webglTexture===void 0){st.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,st.__webglTexture),Yt(i.TEXTURE_CUBE_MAP,_.depthTexture);let Tt=r.convert(_.depthTexture.format),Ut=r.convert(_.depthTexture.type),wt;_.depthTexture.format===fn?wt=i.DEPTH_COMPONENT24:_.depthTexture.format===Qn&&(wt=i.DEPTH24_STENCIL8);for(let Et=0;Et<6;Et++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+Et,0,wt,_.width,_.height,0,Tt,Ut,null)}}else V(_.depthTexture,0);let Mt=st.__webglTexture,St=_t(_),at=Z?i.TEXTURE_CUBE_MAP_POSITIVE_X+U:i.TEXTURE_2D,dt=_.depthTexture.format===Qn?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(_.depthTexture.format===fn)H(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,dt,at,Mt,0,St):i.framebufferTexture2D(i.FRAMEBUFFER,dt,at,Mt,0);else if(_.depthTexture.format===Qn)H(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,dt,at,Mt,0,St):i.framebufferTexture2D(i.FRAMEBUFFER,dt,at,Mt,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function T(b){let _=n.get(b),U=b.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==b.depthTexture){let Z=b.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),Z){let st=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,Z.removeEventListener("dispose",st)};Z.addEventListener("dispose",st),_.__depthDisposeCallback=st}_.__boundDepthTexture=Z}if(b.depthTexture&&!_.__autoAllocateDepthBuffer)if(U)for(let Z=0;Z<6;Z++)ut(_.__webglFramebuffer[Z],b,Z);else{let Z=b.texture.mipmaps;Z&&Z.length>0?ut(_.__webglFramebuffer[0],b,0):ut(_.__webglFramebuffer,b,0)}else if(U){_.__webglDepthbuffer=[];for(let Z=0;Z<6;Z++)if(e.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[Z]),_.__webglDepthbuffer[Z]===void 0)_.__webglDepthbuffer[Z]=i.createRenderbuffer(),et(_.__webglDepthbuffer[Z],b,!1);else{let st=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Mt=_.__webglDepthbuffer[Z];i.bindRenderbuffer(i.RENDERBUFFER,Mt),i.framebufferRenderbuffer(i.FRAMEBUFFER,st,i.RENDERBUFFER,Mt)}}else{let Z=b.texture.mipmaps;if(Z&&Z.length>0?e.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=i.createRenderbuffer(),et(_.__webglDepthbuffer,b,!1);else{let st=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Mt=_.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,Mt),i.framebufferRenderbuffer(i.FRAMEBUFFER,st,i.RENDERBUFFER,Mt)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function F(b,_,U){let Z=n.get(b);_!==void 0&&B(Z.__webglFramebuffer,b,b.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),U!==void 0&&T(b)}function I(b){let _=b.texture,U=n.get(b),Z=n.get(_);b.addEventListener("dispose",y);let st=b.textures,Mt=b.isWebGLCubeRenderTarget===!0,St=st.length>1;if(St||(Z.__webglTexture===void 0&&(Z.__webglTexture=i.createTexture()),Z.__version=_.version,a.memory.textures++),Mt){U.__webglFramebuffer=[];for(let at=0;at<6;at++)if(_.mipmaps&&_.mipmaps.length>0){U.__webglFramebuffer[at]=[];for(let dt=0;dt<_.mipmaps.length;dt++)U.__webglFramebuffer[at][dt]=i.createFramebuffer()}else U.__webglFramebuffer[at]=i.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){U.__webglFramebuffer=[];for(let at=0;at<_.mipmaps.length;at++)U.__webglFramebuffer[at]=i.createFramebuffer()}else U.__webglFramebuffer=i.createFramebuffer();if(St)for(let at=0,dt=st.length;at<dt;at++){let Tt=n.get(st[at]);Tt.__webglTexture===void 0&&(Tt.__webglTexture=i.createTexture(),a.memory.textures++)}if(b.samples>0&&H(b)===!1){U.__webglMultisampledFramebuffer=i.createFramebuffer(),U.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let at=0;at<st.length;at++){let dt=st[at];U.__webglColorRenderbuffer[at]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,U.__webglColorRenderbuffer[at]);let Tt=r.convert(dt.format,dt.colorSpace),Ut=r.convert(dt.type),wt=v(dt.internalFormat,Tt,Ut,dt.normalized,dt.colorSpace,b.isXRRenderTarget===!0),Et=_t(b);i.renderbufferStorageMultisample(i.RENDERBUFFER,Et,wt,b.width,b.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+at,i.RENDERBUFFER,U.__webglColorRenderbuffer[at])}i.bindRenderbuffer(i.RENDERBUFFER,null),b.depthBuffer&&(U.__webglDepthRenderbuffer=i.createRenderbuffer(),et(U.__webglDepthRenderbuffer,b,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(Mt){e.bindTexture(i.TEXTURE_CUBE_MAP,Z.__webglTexture),Yt(i.TEXTURE_CUBE_MAP,_);for(let at=0;at<6;at++)if(_.mipmaps&&_.mipmaps.length>0)for(let dt=0;dt<_.mipmaps.length;dt++)B(U.__webglFramebuffer[at][dt],b,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+at,dt);else B(U.__webglFramebuffer[at],b,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+at,0);f(_)&&L(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(St){for(let at=0,dt=st.length;at<dt;at++){let Tt=st[at],Ut=n.get(Tt),wt=i.TEXTURE_2D;(b.isWebGL3DRenderTarget||b.isWebGLArrayRenderTarget)&&(wt=b.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(wt,Ut.__webglTexture),Yt(wt,Tt),B(U.__webglFramebuffer,b,Tt,i.COLOR_ATTACHMENT0+at,wt,0),f(Tt)&&L(wt)}e.unbindTexture()}else{let at=i.TEXTURE_2D;if((b.isWebGL3DRenderTarget||b.isWebGLArrayRenderTarget)&&(at=b.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(at,Z.__webglTexture),Yt(at,_),_.mipmaps&&_.mipmaps.length>0)for(let dt=0;dt<_.mipmaps.length;dt++)B(U.__webglFramebuffer[dt],b,_,i.COLOR_ATTACHMENT0,at,dt);else B(U.__webglFramebuffer,b,_,i.COLOR_ATTACHMENT0,at,0);f(_)&&L(at),e.unbindTexture()}b.depthBuffer&&T(b)}function $(b){let _=b.textures;for(let U=0,Z=_.length;U<Z;U++){let st=_[U];if(f(st)){let Mt=w(b),St=n.get(st).__webglTexture;e.bindTexture(Mt,St),L(Mt),e.unbindTexture()}}}let K=[],rt=[];function gt(b){if(b.samples>0){if(H(b)===!1){let _=b.textures,U=b.width,Z=b.height,st=i.COLOR_BUFFER_BIT,Mt=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,St=n.get(b),at=_.length>1;if(at)for(let Tt=0;Tt<_.length;Tt++)e.bindFramebuffer(i.FRAMEBUFFER,St.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,St.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,St.__webglMultisampledFramebuffer);let dt=b.texture.mipmaps;dt&&dt.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,St.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,St.__webglFramebuffer);for(let Tt=0;Tt<_.length;Tt++){if(b.resolveDepthBuffer&&(b.depthBuffer&&(st|=i.DEPTH_BUFFER_BIT),b.stencilBuffer&&b.resolveStencilBuffer&&(st|=i.STENCIL_BUFFER_BIT)),at){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,St.__webglColorRenderbuffer[Tt]);let Ut=n.get(_[Tt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ut,0)}i.blitFramebuffer(0,0,U,Z,0,0,U,Z,st,i.NEAREST),c===!0&&(K.length=0,rt.length=0,K.push(i.COLOR_ATTACHMENT0+Tt),b.depthBuffer&&b.resolveDepthBuffer===!1&&(K.push(Mt),rt.push(Mt),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,rt)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,K))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),at)for(let Tt=0;Tt<_.length;Tt++){e.bindFramebuffer(i.FRAMEBUFFER,St.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.RENDERBUFFER,St.__webglColorRenderbuffer[Tt]);let Ut=n.get(_[Tt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,St.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.TEXTURE_2D,Ut,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,St.__webglMultisampledFramebuffer)}else if(b.depthBuffer&&b.resolveDepthBuffer===!1&&c){let _=b.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[_])}}}function _t(b){return Math.min(s.maxSamples,b.samples)}function H(b){let _=n.get(b);return b.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function m(b){let _=a.render.frame;u.get(b)!==_&&(u.set(b,_),b.update())}function j(b,_){let U=b.colorSpace,Z=b.format,st=b.type;return b.isCompressedTexture===!0||b.isVideoTexture===!0||U!==cs&&U!==Nn&&(ee.getTransfer(U)===ie?(Z!==je||st!==Oe)&&Wt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):qt("WebGLTextures: Unsupported texture color space:",U)),_}function ft(b){return typeof HTMLImageElement!="undefined"&&b instanceof HTMLImageElement?(l.width=b.naturalWidth||b.width,l.height=b.naturalHeight||b.height):typeof VideoFrame!="undefined"&&b instanceof VideoFrame?(l.width=b.displayWidth,l.height=b.displayHeight):(l.width=b.width,l.height=b.height),l}this.allocateTextureUnit=it,this.resetTextureUnits=lt,this.getTextureUnits=ot,this.setTextureUnits=J,this.setTexture2D=V,this.setTexture2DArray=pt,this.setTexture3D=mt,this.setTextureCube=vt,this.rebindTextures=F,this.setupRenderTarget=I,this.updateRenderTargetMipmap=$,this.updateMultisampleRenderTarget=gt,this.setupDepthRenderbuffer=T,this.setupFrameBufferTexture=B,this.useMultisampledRTT=H,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function o0(i,t){function e(n,s=Nn){let r,a=ee.getTransfer(s);if(n===Oe)return i.UNSIGNED_BYTE;if(n===da)return i.UNSIGNED_SHORT_4_4_4_4;if(n===fa)return i.UNSIGNED_SHORT_5_5_5_1;if(n===dl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===fl)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===hl)return i.BYTE;if(n===ul)return i.SHORT;if(n===Yi)return i.UNSIGNED_SHORT;if(n===ua)return i.INT;if(n===rn)return i.UNSIGNED_INT;if(n===an)return i.FLOAT;if(n===xn)return i.HALF_FLOAT;if(n===pl)return i.ALPHA;if(n===ml)return i.RGB;if(n===je)return i.RGBA;if(n===fn)return i.DEPTH_COMPONENT;if(n===Qn)return i.DEPTH_STENCIL;if(n===gl)return i.RED;if(n===pa)return i.RED_INTEGER;if(n===ti)return i.RG;if(n===ma)return i.RG_INTEGER;if(n===ga)return i.RGBA_INTEGER;if(n===Gs||n===Hs||n===Ws||n===Xs)if(a===ie)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Gs)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Hs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Ws)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Xs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Gs)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Hs)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Ws)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Xs)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===_a||n===xa||n===ya||n===va)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===_a)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===xa)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===ya)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===va)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ma||n===Sa||n===ba||n===Ta||n===Ea||n===qs||n===Aa)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Ma||n===Sa)return a===ie?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===ba)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Ta)return r.COMPRESSED_R11_EAC;if(n===Ea)return r.COMPRESSED_SIGNED_R11_EAC;if(n===qs)return r.COMPRESSED_RG11_EAC;if(n===Aa)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===wa||n===Ca||n===Ra||n===La||n===Pa||n===Ia||n===Na||n===Da||n===Ua||n===Fa||n===Oa||n===Ba||n===za||n===ka)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===wa)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ca)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ra)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===La)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Pa)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Ia)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Na)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Da)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ua)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Fa)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Oa)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ba)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===za)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ka)return a===ie?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Va||n===Ga||n===Ha)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Va)return a===ie?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Ga)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Ha)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Wa||n===Xa||n===Ys||n===qa)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Wa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Xa)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Ys)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===qa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Zi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var l0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,c0=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Gl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new ys(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new qe({vertexShader:l0,fragmentShader:c0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new be(new Rs(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Hl=class extends pn{constructor(t,e){super();let n=this,s=null,r=1,a=null,o="local-floor",c=1,l=null,u=null,d=null,h=null,p=null,x=null,S=typeof XRWebGLBinding!="undefined",g=new Gl,f={},L=e.getContextAttributes(),w=null,v=null,R=[],A=[],N=new yt,y=null,C=new Fe;C.viewport=new de;let z=new Fe;z.viewport=new de;let O=[C,z],k=new ra,lt=null,ot=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(ct){let X=R[ct];return X===void 0&&(X=new Bi,R[ct]=X),X.getTargetRaySpace()},this.getControllerGrip=function(ct){let X=R[ct];return X===void 0&&(X=new Bi,R[ct]=X),X.getGripSpace()},this.getHand=function(ct){let X=R[ct];return X===void 0&&(X=new Bi,R[ct]=X),X.getHandSpace()};function J(ct){let X=A.indexOf(ct.inputSource);if(X===-1)return;let D=R[X];D!==void 0&&(D.update(ct.inputSource,ct.frame,l||a),D.dispatchEvent({type:ct.type,data:ct.inputSource}))}function it(){s.removeEventListener("select",J),s.removeEventListener("selectstart",J),s.removeEventListener("selectend",J),s.removeEventListener("squeeze",J),s.removeEventListener("squeezestart",J),s.removeEventListener("squeezeend",J),s.removeEventListener("end",it),s.removeEventListener("inputsourceschange",Y);for(let ct=0;ct<R.length;ct++){let X=A[ct];X!==null&&(A[ct]=null,R[ct].disconnect(X))}lt=null,ot=null,g.reset();for(let ct in f)delete f[ct];t.setRenderTarget(w),p=null,h=null,d=null,s=null,v=null,Yt.stop(),n.isPresenting=!1,t.setPixelRatio(y),t.setSize(N.width,N.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(ct){r=ct,n.isPresenting===!0&&Wt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(ct){o=ct,n.isPresenting===!0&&Wt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||a},this.setReferenceSpace=function(ct){l=ct},this.getBaseLayer=function(){return h!==null?h:p},this.getBinding=function(){return d===null&&S&&(d=new XRWebGLBinding(s,e)),d},this.getFrame=function(){return x},this.getSession=function(){return s},this.setSession=async function(ct){if(s=ct,s!==null){if(w=t.getRenderTarget(),s.addEventListener("select",J),s.addEventListener("selectstart",J),s.addEventListener("selectend",J),s.addEventListener("squeeze",J),s.addEventListener("squeezestart",J),s.addEventListener("squeezeend",J),s.addEventListener("end",it),s.addEventListener("inputsourceschange",Y),L.xrCompatible!==!0&&await e.makeXRCompatible(),y=t.getPixelRatio(),t.getSize(N),S&&"createProjectionLayer"in XRWebGLBinding.prototype){let D=null,P=null,E=null;L.depth&&(E=L.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,D=L.stencil?Qn:fn,P=L.stencil?Zi:rn);let B={colorFormat:e.RGBA8,depthFormat:E,scaleFactor:r};d=this.getBinding(),h=d.createProjectionLayer(B),s.updateRenderState({layers:[h]}),t.setPixelRatio(1),t.setSize(h.textureWidth,h.textureHeight,!1),v=new He(h.textureWidth,h.textureHeight,{format:je,type:Oe,depthTexture:new In(h.textureWidth,h.textureHeight,P,void 0,void 0,void 0,void 0,void 0,void 0,D),stencilBuffer:L.stencil,colorSpace:t.outputColorSpace,samples:L.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1})}else{let D={antialias:L.antialias,alpha:!0,depth:L.depth,stencil:L.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,e,D),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),v=new He(p.framebufferWidth,p.framebufferHeight,{format:je,type:Oe,colorSpace:t.outputColorSpace,stencilBuffer:L.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(c),l=null,a=await s.requestReferenceSpace(o),Yt.setContext(s),Yt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return g.getDepthTexture()};function Y(ct){for(let X=0;X<ct.removed.length;X++){let D=ct.removed[X],P=A.indexOf(D);P>=0&&(A[P]=null,R[P].disconnect(D))}for(let X=0;X<ct.added.length;X++){let D=ct.added[X],P=A.indexOf(D);if(P===-1){for(let B=0;B<R.length;B++)if(B>=A.length){A.push(D),P=B;break}else if(A[B]===null){A[B]=D,P=B;break}if(P===-1)break}let E=R[P];E&&E.connect(D)}}let V=new W,pt=new W;function mt(ct,X,D){V.setFromMatrixPosition(X.matrixWorld),pt.setFromMatrixPosition(D.matrixWorld);let P=V.distanceTo(pt),E=X.projectionMatrix.elements,B=D.projectionMatrix.elements,et=E[14]/(E[10]-1),ut=E[14]/(E[10]+1),T=(E[9]+1)/E[5],F=(E[9]-1)/E[5],I=(E[8]-1)/E[0],$=(B[8]+1)/B[0],K=et*I,rt=et*$,gt=P/(-I+$),_t=gt*-I;if(X.matrixWorld.decompose(ct.position,ct.quaternion,ct.scale),ct.translateX(_t),ct.translateZ(gt),ct.matrixWorld.compose(ct.position,ct.quaternion,ct.scale),ct.matrixWorldInverse.copy(ct.matrixWorld).invert(),E[10]===-1)ct.projectionMatrix.copy(X.projectionMatrix),ct.projectionMatrixInverse.copy(X.projectionMatrixInverse);else{let H=et+gt,m=ut+gt,j=K-_t,ft=rt+(P-_t),b=T*ut/m*H,_=F*ut/m*H;ct.projectionMatrix.makePerspective(j,ft,b,_,H,m),ct.projectionMatrixInverse.copy(ct.projectionMatrix).invert()}}function vt(ct,X){X===null?ct.matrixWorld.copy(ct.matrix):ct.matrixWorld.multiplyMatrices(X.matrixWorld,ct.matrix),ct.matrixWorldInverse.copy(ct.matrixWorld).invert()}this.updateCamera=function(ct){if(s===null)return;let X=ct.near,D=ct.far;g.texture!==null&&(g.depthNear>0&&(X=g.depthNear),g.depthFar>0&&(D=g.depthFar)),k.near=z.near=C.near=X,k.far=z.far=C.far=D,(lt!==k.near||ot!==k.far)&&(s.updateRenderState({depthNear:k.near,depthFar:k.far}),lt=k.near,ot=k.far),k.layers.mask=ct.layers.mask|6,C.layers.mask=k.layers.mask&-5,z.layers.mask=k.layers.mask&-3;let P=ct.parent,E=k.cameras;vt(k,P);for(let B=0;B<E.length;B++)vt(E[B],P);E.length===2?mt(k,C,z):k.projectionMatrix.copy(C.projectionMatrix),Ct(ct,k,P)};function Ct(ct,X,D){D===null?ct.matrix.copy(X.matrixWorld):(ct.matrix.copy(D.matrixWorld),ct.matrix.invert(),ct.matrix.multiply(X.matrixWorld)),ct.matrix.decompose(ct.position,ct.quaternion,ct.scale),ct.updateMatrixWorld(!0),ct.projectionMatrix.copy(X.projectionMatrix),ct.projectionMatrixInverse.copy(X.projectionMatrixInverse),ct.isPerspectiveCamera&&(ct.fov=Nr*2*Math.atan(1/ct.projectionMatrix.elements[5]),ct.zoom=1)}this.getCamera=function(){return k},this.getFoveation=function(){if(!(h===null&&p===null))return c},this.setFoveation=function(ct){c=ct,h!==null&&(h.fixedFoveation=ct),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=ct)},this.hasDepthSensing=function(){return g.texture!==null},this.getDepthSensingMesh=function(){return g.getMesh(k)},this.getCameraTexture=function(ct){return f[ct]};let Xt=null;function Jt(ct,X){if(u=X.getViewerPose(l||a),x=X,u!==null){let D=u.views;p!==null&&(t.setRenderTargetFramebuffer(v,p.framebuffer),t.setRenderTarget(v));let P=!1;D.length!==k.cameras.length&&(k.cameras.length=0,P=!0);for(let ut=0;ut<D.length;ut++){let T=D[ut],F=null;if(p!==null)F=p.getViewport(T);else{let $=d.getViewSubImage(h,T);F=$.viewport,ut===0&&(t.setRenderTargetTextures(v,$.colorTexture,$.depthStencilTexture),t.setRenderTarget(v))}let I=O[ut];I===void 0&&(I=new Fe,I.layers.enable(ut),I.viewport=new de,O[ut]=I),I.matrix.fromArray(T.transform.matrix),I.matrix.decompose(I.position,I.quaternion,I.scale),I.projectionMatrix.fromArray(T.projectionMatrix),I.projectionMatrixInverse.copy(I.projectionMatrix).invert(),I.viewport.set(F.x,F.y,F.width,F.height),ut===0&&(k.matrix.copy(I.matrix),k.matrix.decompose(k.position,k.quaternion,k.scale)),P===!0&&k.cameras.push(I)}let E=s.enabledFeatures;if(E&&E.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&S){d=n.getBinding();let ut=d.getDepthInformation(D[0]);ut&&ut.isValid&&ut.texture&&g.init(ut,s.renderState)}if(E&&E.includes("camera-access")&&S){t.state.unbindTexture(),d=n.getBinding();for(let ut=0;ut<D.length;ut++){let T=D[ut].camera;if(T){let F=f[T];F||(F=new ys,f[T]=F);let I=d.getCameraImage(T);F.sourceTexture=I}}}}for(let D=0;D<R.length;D++){let P=A[D],E=R[D];P!==null&&E!==void 0&&E.update(P,X,l||a)}Xt&&Xt(ct,X),X.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:X}),x=null}let Yt=new Xh;Yt.setAnimationLoop(Jt),this.setAnimationLoop=function(ct){Xt=ct},this.dispose=function(){}}},h0=new ue,Kh=new Gt;Kh.set(-1,0,0,0,1,0,0,0,1);function u0(i,t){function e(g,f){g.matrixAutoUpdate===!0&&g.updateMatrix(),f.value.copy(g.matrix)}function n(g,f){f.color.getRGB(g.fogColor.value,vl(i)),f.isFog?(g.fogNear.value=f.near,g.fogFar.value=f.far):f.isFogExp2&&(g.fogDensity.value=f.density)}function s(g,f,L,w,v){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?r(g,f):f.isMeshLambertMaterial?(r(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(r(g,f),d(g,f)):f.isMeshPhongMaterial?(r(g,f),u(g,f),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(r(g,f),h(g,f),f.isMeshPhysicalMaterial&&p(g,f,v)):f.isMeshMatcapMaterial?(r(g,f),x(g,f)):f.isMeshDepthMaterial?r(g,f):f.isMeshDistanceMaterial?(r(g,f),S(g,f)):f.isMeshNormalMaterial?r(g,f):f.isLineBasicMaterial?(a(g,f),f.isLineDashedMaterial&&o(g,f)):f.isPointsMaterial?c(g,f,L,w):f.isSpriteMaterial?l(g,f):f.isShadowMaterial?(g.color.value.copy(f.color),g.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function r(g,f){g.opacity.value=f.opacity,f.color&&g.diffuse.value.copy(f.color),f.emissive&&g.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(g.map.value=f.map,e(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,e(f.alphaMap,g.alphaMapTransform)),f.bumpMap&&(g.bumpMap.value=f.bumpMap,e(f.bumpMap,g.bumpMapTransform),g.bumpScale.value=f.bumpScale,f.side===De&&(g.bumpScale.value*=-1)),f.normalMap&&(g.normalMap.value=f.normalMap,e(f.normalMap,g.normalMapTransform),g.normalScale.value.copy(f.normalScale),f.side===De&&g.normalScale.value.negate()),f.displacementMap&&(g.displacementMap.value=f.displacementMap,e(f.displacementMap,g.displacementMapTransform),g.displacementScale.value=f.displacementScale,g.displacementBias.value=f.displacementBias),f.emissiveMap&&(g.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,g.emissiveMapTransform)),f.specularMap&&(g.specularMap.value=f.specularMap,e(f.specularMap,g.specularMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest);let L=t.get(f),w=L.envMap,v=L.envMapRotation;w&&(g.envMap.value=w,g.envMapRotation.value.setFromMatrix4(h0.makeRotationFromEuler(v)).transpose(),w.isCubeTexture&&w.isRenderTargetTexture===!1&&g.envMapRotation.value.premultiply(Kh),g.reflectivity.value=f.reflectivity,g.ior.value=f.ior,g.refractionRatio.value=f.refractionRatio),f.lightMap&&(g.lightMap.value=f.lightMap,g.lightMapIntensity.value=f.lightMapIntensity,e(f.lightMap,g.lightMapTransform)),f.aoMap&&(g.aoMap.value=f.aoMap,g.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,g.aoMapTransform))}function a(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,f.map&&(g.map.value=f.map,e(f.map,g.mapTransform))}function o(g,f){g.dashSize.value=f.dashSize,g.totalSize.value=f.dashSize+f.gapSize,g.scale.value=f.scale}function c(g,f,L,w){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.size.value=f.size*L,g.scale.value=w*.5,f.map&&(g.map.value=f.map,e(f.map,g.uvTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,e(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function l(g,f){g.diffuse.value.copy(f.color),g.opacity.value=f.opacity,g.rotation.value=f.rotation,f.map&&(g.map.value=f.map,e(f.map,g.mapTransform)),f.alphaMap&&(g.alphaMap.value=f.alphaMap,e(f.alphaMap,g.alphaMapTransform)),f.alphaTest>0&&(g.alphaTest.value=f.alphaTest)}function u(g,f){g.specular.value.copy(f.specular),g.shininess.value=Math.max(f.shininess,1e-4)}function d(g,f){f.gradientMap&&(g.gradientMap.value=f.gradientMap)}function h(g,f){g.metalness.value=f.metalness,f.metalnessMap&&(g.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,g.metalnessMapTransform)),g.roughness.value=f.roughness,f.roughnessMap&&(g.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,g.roughnessMapTransform)),f.envMap&&(g.envMapIntensity.value=f.envMapIntensity)}function p(g,f,L){g.ior.value=f.ior,f.sheen>0&&(g.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),g.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(g.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,g.sheenColorMapTransform)),f.sheenRoughnessMap&&(g.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,g.sheenRoughnessMapTransform))),f.clearcoat>0&&(g.clearcoat.value=f.clearcoat,g.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(g.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,g.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(g.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===De&&g.clearcoatNormalScale.value.negate())),f.dispersion>0&&(g.dispersion.value=f.dispersion),f.iridescence>0&&(g.iridescence.value=f.iridescence,g.iridescenceIOR.value=f.iridescenceIOR,g.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(g.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,g.iridescenceMapTransform)),f.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),f.transmission>0&&(g.transmission.value=f.transmission,g.transmissionSamplerMap.value=L.texture,g.transmissionSamplerSize.value.set(L.width,L.height),f.transmissionMap&&(g.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,g.transmissionMapTransform)),g.thickness.value=f.thickness,f.thicknessMap&&(g.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=f.attenuationDistance,g.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(g.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(g.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=f.specularIntensity,g.specularColor.value.copy(f.specularColor),f.specularColorMap&&(g.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,g.specularColorMapTransform)),f.specularIntensityMap&&(g.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,g.specularIntensityMapTransform))}function x(g,f){f.matcap&&(g.matcap.value=f.matcap)}function S(g,f){let L=t.get(f).light;g.referencePosition.value.setFromMatrixPosition(L.matrixWorld),g.nearDistance.value=L.shadow.camera.near,g.farDistance.value=L.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function d0(i,t,e,n){let s={},r={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(v,R){let A=R.program;n.uniformBlockBinding(v,A)}function l(v,R){let A=s[v.id];A===void 0&&(g(v),A=u(v),s[v.id]=A,v.addEventListener("dispose",L));let N=R.program;n.updateUBOMapping(v,N);let y=t.render.frame;r[v.id]!==y&&(h(v),r[v.id]=y)}function u(v){let R=d();v.__bindingPointIndex=R;let A=i.createBuffer(),N=v.__size,y=v.usage;return i.bindBuffer(i.UNIFORM_BUFFER,A),i.bufferData(i.UNIFORM_BUFFER,N,y),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,R,A),A}function d(){for(let v=0;v<o;v++)if(a.indexOf(v)===-1)return a.push(v),v;return qt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(v){let R=s[v.id],A=v.uniforms,N=v.__cache;i.bindBuffer(i.UNIFORM_BUFFER,R);for(let y=0,C=A.length;y<C;y++){let z=A[y];if(Array.isArray(z))for(let O=0,k=z.length;O<k;O++)p(z[O],y,O,N);else p(z,y,0,N)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(v,R,A,N){if(S(v,R,A,N)===!0){let y=v.__offset,C=v.value;if(Array.isArray(C)){let z=0;for(let O=0;O<C.length;O++){let k=C[O],lt=f(k);x(k,v.__data,z),typeof k!="number"&&typeof k!="boolean"&&!k.isMatrix3&&!ArrayBuffer.isView(k)&&(z+=lt.storage/Float32Array.BYTES_PER_ELEMENT)}}else x(C,v.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,y,v.__data)}}function x(v,R,A){typeof v=="number"||typeof v=="boolean"?R[0]=v:v.isMatrix3?(R[0]=v.elements[0],R[1]=v.elements[1],R[2]=v.elements[2],R[3]=0,R[4]=v.elements[3],R[5]=v.elements[4],R[6]=v.elements[5],R[7]=0,R[8]=v.elements[6],R[9]=v.elements[7],R[10]=v.elements[8],R[11]=0):ArrayBuffer.isView(v)?R.set(new v.constructor(v.buffer,v.byteOffset,R.length)):v.toArray(R,A)}function S(v,R,A,N){let y=v.value,C=R+"_"+A;if(N[C]===void 0)return typeof y=="number"||typeof y=="boolean"?N[C]=y:ArrayBuffer.isView(y)?N[C]=y.slice():N[C]=y.clone(),!0;{let z=N[C];if(typeof y=="number"||typeof y=="boolean"){if(z!==y)return N[C]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(z.equals(y)===!1)return z.copy(y),!0}}return!1}function g(v){let R=v.uniforms,A=0,N=16;for(let C=0,z=R.length;C<z;C++){let O=Array.isArray(R[C])?R[C]:[R[C]];for(let k=0,lt=O.length;k<lt;k++){let ot=O[k],J=Array.isArray(ot.value)?ot.value:[ot.value];for(let it=0,Y=J.length;it<Y;it++){let V=J[it],pt=f(V),mt=A%N,vt=mt%pt.boundary,Ct=mt+vt;A+=vt,Ct!==0&&N-Ct<pt.storage&&(A+=N-Ct),ot.__data=new Float32Array(pt.storage/Float32Array.BYTES_PER_ELEMENT),ot.__offset=A,A+=pt.storage}}}let y=A%N;return y>0&&(A+=N-y),v.__size=A,v.__cache={},this}function f(v){let R={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(R.boundary=4,R.storage=4):v.isVector2?(R.boundary=8,R.storage=8):v.isVector3||v.isColor?(R.boundary=16,R.storage=12):v.isVector4?(R.boundary=16,R.storage=16):v.isMatrix3?(R.boundary=48,R.storage=48):v.isMatrix4?(R.boundary=64,R.storage=64):v.isTexture?Wt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(R.boundary=16,R.storage=v.byteLength):Wt("WebGLRenderer: Unsupported uniform value type.",v),R}function L(v){let R=v.target;R.removeEventListener("dispose",L);let A=a.indexOf(R.__bindingPointIndex);a.splice(A,1),i.deleteBuffer(s[R.id]),delete s[R.id],delete r[R.id]}function w(){for(let v in s)i.deleteBuffer(s[v]);a=[],s={},r={}}return{bind:c,update:l,dispose:w}}var f0=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),yn=null;function p0(){return yn===null&&(yn=new Br(f0,16,16,ti,xn),yn.name="DFG_LUT",yn.minFilter=Ee,yn.magFilter=Ee,yn.wrapS=Ke,yn.wrapT=Ke,yn.generateMipmaps=!1,yn.needsUpdate=!0),yn}var to=class{constructor(t={}){let{canvas:e=dh(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:h=!1,outputBufferType:p=Oe}=t;this.isWebGLRenderer=!0;let x;if(n!==null){if(typeof WebGLRenderingContext!="undefined"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");x=n.getContextAttributes().alpha}else x=a;let S=p,g=new Set([ga,ma,pa]),f=new Set([Oe,rn,Yi,Zi,da,fa]),L=new Uint32Array(4),w=new Int32Array(4),v=new W,R=null,A=null,N=[],y=[],C=null;this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Ze,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let z=this,O=!1,k=null,lt=null,ot=null,J=null;this._outputColorSpace=Te;let it=0,Y=0,V=null,pt=-1,mt=null,vt=new de,Ct=new de,Xt=null,Jt=new Kt(0),Yt=0,ct=e.width,X=e.height,D=1,P=null,E=null,B=new de(0,0,ct,X),et=new de(0,0,ct,X),ut=!1,T=new ki,F=!1,I=!1,$=new ue,K=new W,rt=new de,gt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},_t=!1;function H(){return V===null?D:1}let m=n;function j(M,q){return e.getContext(M,q)}try{let M={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:u,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"185"}`),e.addEventListener("webglcontextlost",pe,!1),e.addEventListener("webglcontextrestored",le,!1),e.addEventListener("webglcontextcreationerror",on,!1),m===null){let q="webgl2";if(m=j(q,M),m===null)throw j(q)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(M){throw qt("WebGLRenderer: "+M.message),M}let ft,b,_,U,Z,st,Mt,St,at,dt,Tt,Ut,wt,Et,zt,Ht,Zt,G,bt,ht,At,Rt,xt;function Ot(){ft=new Mm(m),ft.init(),At=new o0(m,ft),b=new fm(m,ft,t,At),_=new r0(m,ft),b.reversedDepthBuffer&&h&&_.buffers.depth.setReversed(!0),lt=m.createFramebuffer(),ot=m.createFramebuffer(),J=m.createFramebuffer(),U=new Tm(m),Z=new Xg,st=new a0(m,ft,_,Z,b,At,U),Mt=new vm(z),St=new wd(m),Rt=new um(m,St),at=new Sm(m,St,U,Rt),dt=new Am(m,at,St,Rt,U),G=new Em(m,b,st),zt=new pm(Z),Tt=new Wg(z,Mt,ft,b,Rt,zt),Ut=new u0(z,Z),wt=new Yg,Et=new Qg(ft),Zt=new hm(z,Mt,_,dt,x,c),Ht=new s0(z,dt,b),xt=new d0(m,U,b,_),bt=new dm(m,ft,U),ht=new bm(m,ft,U),U.programs=Tt.programs,z.capabilities=b,z.extensions=ft,z.properties=Z,z.renderLists=wt,z.shadowMap=Ht,z.state=_,z.info=U}Ot(),S!==Oe&&(C=new Cm(S,e.width,e.height,o,s,r));let Ft=new Hl(z,m);this.xr=Ft,this.getContext=function(){return m},this.getContextAttributes=function(){return m.getContextAttributes()},this.forceContextLoss=function(){let M=ft.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){let M=ft.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return D},this.setPixelRatio=function(M){M!==void 0&&(D=M,this.setSize(ct,X,!1))},this.getSize=function(M){return M.set(ct,X)},this.setSize=function(M,q,nt=!0){if(Ft.isPresenting){Wt("WebGLRenderer: Can't change size while VR device is presenting.");return}ct=M,X=q,e.width=Math.floor(M*D),e.height=Math.floor(q*D),nt===!0&&(e.style.width=M+"px",e.style.height=q+"px"),C!==null&&C.setSize(e.width,e.height),this.setViewport(0,0,M,q)},this.getDrawingBufferSize=function(M){return M.set(ct*D,X*D).floor()},this.setDrawingBufferSize=function(M,q,nt){ct=M,X=q,D=nt,e.width=Math.floor(M*nt),e.height=Math.floor(q*nt),this.setViewport(0,0,M,q)},this.setEffects=function(M){if(S===Oe){qt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(M){for(let q=0;q<M.length;q++)if(M[q].isOutputPass===!0){Wt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}C.setEffects(M||[])},this.getCurrentViewport=function(M){return M.copy(vt)},this.getViewport=function(M){return M.copy(B)},this.setViewport=function(M,q,nt,Q){M.isVector4?B.set(M.x,M.y,M.z,M.w):B.set(M,q,nt,Q),_.viewport(vt.copy(B).multiplyScalar(D).round())},this.getScissor=function(M){return M.copy(et)},this.setScissor=function(M,q,nt,Q){M.isVector4?et.set(M.x,M.y,M.z,M.w):et.set(M,q,nt,Q),_.scissor(Ct.copy(et).multiplyScalar(D).round())},this.getScissorTest=function(){return ut},this.setScissorTest=function(M){_.setScissorTest(ut=M)},this.setOpaqueSort=function(M){P=M},this.setTransparentSort=function(M){E=M},this.getClearColor=function(M){return M.copy(Zt.getClearColor())},this.setClearColor=function(){Zt.setClearColor(...arguments)},this.getClearAlpha=function(){return Zt.getClearAlpha()},this.setClearAlpha=function(){Zt.setClearAlpha(...arguments)},this.clear=function(M=!0,q=!0,nt=!0){let Q=0;if(M){let tt=!1;if(V!==null){let It=V.texture.format;tt=g.has(It)}if(tt){let It=V.texture.type,Dt=f.has(It),Pt=Zt.getClearColor(),Bt=Zt.getClearAlpha(),kt=Pt.r,$t=Pt.g,Qt=Pt.b;Dt?(L[0]=kt,L[1]=$t,L[2]=Qt,L[3]=Bt,m.clearBufferuiv(m.COLOR,0,L)):(w[0]=kt,w[1]=$t,w[2]=Qt,w[3]=Bt,m.clearBufferiv(m.COLOR,0,w))}else Q|=m.COLOR_BUFFER_BIT}q&&(Q|=m.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),nt&&(Q|=m.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),Q!==0&&m.clear(Q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(M){M.setRenderer(this),k=M},this.dispose=function(){e.removeEventListener("webglcontextlost",pe,!1),e.removeEventListener("webglcontextrestored",le,!1),e.removeEventListener("webglcontextcreationerror",on,!1),Zt.dispose(),wt.dispose(),Et.dispose(),Z.dispose(),Mt.dispose(),dt.dispose(),Rt.dispose(),xt.dispose(),Tt.dispose(),Ft.dispose(),Ft.removeEventListener("sessionstart",jl),Ft.removeEventListener("sessionend",Ql),ni.stop()};function pe(M){M.preventDefault(),xl("WebGLRenderer: Context Lost."),O=!0}function le(){xl("WebGLRenderer: Context Restored."),O=!1;let M=U.autoReset,q=Ht.enabled,nt=Ht.autoUpdate,Q=Ht.needsUpdate,tt=Ht.type;Ot(),U.autoReset=M,Ht.enabled=q,Ht.autoUpdate=nt,Ht.needsUpdate=Q,Ht.type=tt}function on(M){qt("WebGLRenderer: A WebGL context could not be created. Reason: ",M.statusMessage)}function ln(M){let q=M.target;q.removeEventListener("dispose",ln),ou(q)}function ou(M){lu(M),Z.remove(M)}function lu(M){let q=Z.get(M).programs;q!==void 0&&(q.forEach(function(nt){Tt.releaseProgram(nt)}),M.isShaderMaterial&&Tt.releaseShaderCache(M))}this.renderBufferDirect=function(M,q,nt,Q,tt,It){q===null&&(q=gt);let Dt=tt.isMesh&&tt.matrixWorld.determinantAffine()<0,Pt=uu(M,q,nt,Q,tt);_.setMaterial(Q,Dt);let Bt=nt.index,kt=1;if(Q.wireframe===!0){if(Bt=at.getWireframeAttribute(nt),Bt===void 0)return;kt=2}let $t=nt.drawRange,Qt=nt.attributes.position,Vt=$t.start*kt,se=($t.start+$t.count)*kt;It!==null&&(Vt=Math.max(Vt,It.start*kt),se=Math.min(se,(It.start+It.count)*kt)),Bt!==null?(Vt=Math.max(Vt,0),se=Math.min(se,Bt.count)):Qt!=null&&(Vt=Math.max(Vt,0),se=Math.min(se,Qt.count));let ge=se-Vt;if(ge<0||ge===1/0)return;Rt.setup(tt,Q,Pt,nt,Bt);let me,re=bt;if(Bt!==null&&(me=St.get(Bt),re=ht,re.setIndex(me)),tt.isMesh)Q.wireframe===!0?(_.setLineWidth(Q.wireframeLinewidth*H()),re.setMode(m.LINES)):re.setMode(m.TRIANGLES);else if(tt.isLine){let we=Q.linewidth;we===void 0&&(we=1),_.setLineWidth(we*H()),tt.isLineSegments?re.setMode(m.LINES):tt.isLineLoop?re.setMode(m.LINE_LOOP):re.setMode(m.LINE_STRIP)}else tt.isPoints?re.setMode(m.POINTS):tt.isSprite&&re.setMode(m.TRIANGLES);if(tt.isBatchedMesh)if(ft.get("WEBGL_multi_draw"))re.renderMultiDraw(tt._multiDrawStarts,tt._multiDrawCounts,tt._multiDrawCount);else{let we=tt._multiDrawStarts,Nt=tt._multiDrawCounts,Be=tt._multiDrawCount,ne=Bt?St.get(Bt).bytesPerElement:1,Je=Z.get(Q).currentProgram.getUniforms();for(let cn=0;cn<Be;cn++)Je.setValue(m,"_gl_DrawID",cn),re.render(we[cn]/ne,Nt[cn])}else if(tt.isInstancedMesh)re.renderInstances(Vt,ge,tt.count);else if(nt.isInstancedBufferGeometry){let we=nt._maxInstanceCount!==void 0?nt._maxInstanceCount:1/0,Nt=Math.min(nt.instanceCount,we);re.renderInstances(Vt,ge,Nt)}else re.render(Vt,ge)};function Kl(M,q,nt){M.transparent===!0&&M.side===Ae&&M.forceSinglePass===!1?(M.side=De,M.needsUpdate=!0,Qs(M,q,nt),M.side=Ln,M.needsUpdate=!0,Qs(M,q,nt),M.side=Ae):Qs(M,q,nt)}this.compile=function(M,q,nt=null){nt===null&&(nt=M),A=Et.get(nt),A.init(q),y.push(A),nt.traverseVisible(function(tt){tt.isLight&&tt.layers.test(q.layers)&&(A.pushLight(tt),tt.castShadow&&A.pushShadow(tt))}),M!==nt&&M.traverseVisible(function(tt){tt.isLight&&tt.layers.test(q.layers)&&(A.pushLight(tt),tt.castShadow&&A.pushShadow(tt))}),A.setupLights();let Q=new Set;return M.traverse(function(tt){if(!(tt.isMesh||tt.isPoints||tt.isLine||tt.isSprite))return;let It=tt.material;if(It)if(Array.isArray(It))for(let Dt=0;Dt<It.length;Dt++){let Pt=It[Dt];Kl(Pt,nt,tt),Q.add(Pt)}else Kl(It,nt,tt),Q.add(It)}),A=y.pop(),Q},this.compileAsync=function(M,q,nt=null){let Q=this.compile(M,q,nt);return new Promise(tt=>{function It(){if(Q.forEach(function(Dt){Z.get(Dt).currentProgram.isReady()&&Q.delete(Dt)}),Q.size===0){tt(M);return}setTimeout(It,10)}ft.get("KHR_parallel_shader_compile")!==null?It():setTimeout(It,10)})};let ro=null;function cu(M){ro&&ro(M)}function jl(){ni.stop()}function Ql(){ni.start()}let ni=new Xh;ni.setAnimationLoop(cu),typeof self!="undefined"&&ni.setContext(self),this.setAnimationLoop=function(M){ro=M,Ft.setAnimationLoop(M),M===null?ni.stop():ni.start()},Ft.addEventListener("sessionstart",jl),Ft.addEventListener("sessionend",Ql),this.render=function(M,q){if(q!==void 0&&q.isCamera!==!0){qt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(O===!0)return;k!==null&&k.renderStart(M,q);let nt=Ft.enabled===!0&&Ft.isPresenting===!0,Q=C!==null&&(V===null||nt)&&C.begin(z,V);if(M.matrixWorldAutoUpdate===!0&&M.updateMatrixWorld(),q.parent===null&&q.matrixWorldAutoUpdate===!0&&q.updateMatrixWorld(),Ft.enabled===!0&&Ft.isPresenting===!0&&(C===null||C.isCompositing()===!1)&&(Ft.cameraAutoUpdate===!0&&Ft.updateCamera(q),q=Ft.getCamera()),M.isScene===!0&&M.onBeforeRender(z,M,q,V),A=Et.get(M,y.length),A.init(q),A.state.textureUnits=st.getTextureUnits(),y.push(A),$.multiplyMatrices(q.projectionMatrix,q.matrixWorldInverse),T.setFromProjectionMatrix($,nn,q.reversedDepth),I=this.localClippingEnabled,F=zt.init(this.clippingPlanes,I),R=wt.get(M,N.length),R.init(),N.push(R),Ft.enabled===!0&&Ft.isPresenting===!0){let Dt=z.xr.getDepthSensingMesh();Dt!==null&&ao(Dt,q,-1/0,z.sortObjects)}ao(M,q,0,z.sortObjects),R.finish(),z.sortObjects===!0&&R.sort(P,E,q.reversedDepth),_t=Ft.enabled===!1||Ft.isPresenting===!1||Ft.hasDepthSensing()===!1,_t&&Zt.addToRenderList(R,M),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),F===!0&&zt.beginShadows();let tt=A.state.shadowsArray;if(Ht.render(tt,M,q),F===!0&&zt.endShadows(),(Q&&C.hasRenderPass())===!1){let Dt=R.opaque,Pt=R.transmissive;if(A.setupLights(),q.isArrayCamera){let Bt=q.cameras;if(Pt.length>0)for(let kt=0,$t=Bt.length;kt<$t;kt++){let Qt=Bt[kt];ec(Dt,Pt,M,Qt)}_t&&Zt.render(M);for(let kt=0,$t=Bt.length;kt<$t;kt++){let Qt=Bt[kt];tc(R,M,Qt,Qt.viewport)}}else Pt.length>0&&ec(Dt,Pt,M,q),_t&&Zt.render(M),tc(R,M,q)}V!==null&&Y===0&&(st.updateMultisampleRenderTarget(V),st.updateRenderTargetMipmap(V)),Q&&C.end(z),M.isScene===!0&&M.onAfterRender(z,M,q),Rt.resetDefaultState(),pt=-1,mt=null,y.pop(),y.length>0?(A=y[y.length-1],st.setTextureUnits(A.state.textureUnits),F===!0&&zt.setGlobalState(z.clippingPlanes,A.state.camera)):A=null,N.pop(),N.length>0?R=N[N.length-1]:R=null,k!==null&&k.renderEnd()};function ao(M,q,nt,Q){if(M.visible===!1)return;if(M.layers.test(q.layers)){if(M.isGroup)nt=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(q);else if(M.isLightProbeGrid)A.pushLightProbeGrid(M);else if(M.isLight)A.pushLight(M),M.castShadow&&A.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||T.intersectsSprite(M)){Q&&rt.setFromMatrixPosition(M.matrixWorld).applyMatrix4($);let Dt=dt.update(M),Pt=M.material;Pt.visible&&R.push(M,Dt,Pt,nt,rt.z,null)}}else if((M.isMesh||M.isLine||M.isPoints)&&(!M.frustumCulled||T.intersectsObject(M))){let Dt=dt.update(M),Pt=M.material;if(Q&&(M.boundingSphere!==void 0?(M.boundingSphere===null&&M.computeBoundingSphere(),rt.copy(M.boundingSphere.center)):(Dt.boundingSphere===null&&Dt.computeBoundingSphere(),rt.copy(Dt.boundingSphere.center)),rt.applyMatrix4(M.matrixWorld).applyMatrix4($)),Array.isArray(Pt)){let Bt=Dt.groups;for(let kt=0,$t=Bt.length;kt<$t;kt++){let Qt=Bt[kt],Vt=Pt[Qt.materialIndex];Vt&&Vt.visible&&R.push(M,Dt,Vt,nt,rt.z,Qt)}}else Pt.visible&&R.push(M,Dt,Pt,nt,rt.z,null)}}let It=M.children;for(let Dt=0,Pt=It.length;Dt<Pt;Dt++)ao(It[Dt],q,nt,Q)}function tc(M,q,nt,Q){let{opaque:tt,transmissive:It,transparent:Dt}=M;A.setupLightsView(nt),F===!0&&zt.setGlobalState(z.clippingPlanes,nt),Q&&_.viewport(vt.copy(Q)),tt.length>0&&js(tt,q,nt),It.length>0&&js(It,q,nt),Dt.length>0&&js(Dt,q,nt),_.buffers.depth.setTest(!0),_.buffers.depth.setMask(!0),_.buffers.color.setMask(!0),_.setPolygonOffset(!1)}function ec(M,q,nt,Q){if((nt.isScene===!0?nt.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[Q.id]===void 0){let Vt=ft.has("EXT_color_buffer_half_float")||ft.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[Q.id]=new He(1,1,{generateMipmaps:!0,type:Vt?xn:Oe,minFilter:jn,samples:Math.max(4,b.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ee.workingColorSpace})}let It=A.state.transmissionRenderTarget[Q.id],Dt=Q.viewport||vt;It.setSize(Dt.z*z.transmissionResolutionScale,Dt.w*z.transmissionResolutionScale);let Pt=z.getRenderTarget(),Bt=z.getActiveCubeFace(),kt=z.getActiveMipmapLevel();z.setRenderTarget(It),z.getClearColor(Jt),Yt=z.getClearAlpha(),Yt<1&&z.setClearColor(16777215,.5),z.clear(),_t&&Zt.render(nt);let $t=z.toneMapping;z.toneMapping=Ze;let Qt=Q.viewport;if(Q.viewport!==void 0&&(Q.viewport=void 0),A.setupLightsView(Q),F===!0&&zt.setGlobalState(z.clippingPlanes,Q),js(M,nt,Q),st.updateMultisampleRenderTarget(It),st.updateRenderTargetMipmap(It),ft.has("WEBGL_multisampled_render_to_texture")===!1){let Vt=!1;for(let se=0,ge=q.length;se<ge;se++){let me=q[se],{object:re,geometry:we,material:Nt,group:Be}=me;if(Nt.side===Ae&&re.layers.test(Q.layers)){let ne=Nt.side;Nt.side=De,Nt.needsUpdate=!0,nc(re,nt,Q,we,Nt,Be),Nt.side=ne,Nt.needsUpdate=!0,Vt=!0}}Vt===!0&&(st.updateMultisampleRenderTarget(It),st.updateRenderTargetMipmap(It))}z.setRenderTarget(Pt,Bt,kt),z.setClearColor(Jt,Yt),Qt!==void 0&&(Q.viewport=Qt),z.toneMapping=$t}function js(M,q,nt){let Q=q.isScene===!0?q.overrideMaterial:null;for(let tt=0,It=M.length;tt<It;tt++){let Dt=M[tt],{object:Pt,geometry:Bt,group:kt}=Dt,$t=Dt.material;$t.allowOverride===!0&&Q!==null&&($t=Q),Pt.layers.test(nt.layers)&&nc(Pt,q,nt,Bt,$t,kt)}}function nc(M,q,nt,Q,tt,It){M.onBeforeRender(z,q,nt,Q,tt,It),M.modelViewMatrix.multiplyMatrices(nt.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),tt.onBeforeRender(z,q,nt,Q,M,It),tt.transparent===!0&&tt.side===Ae&&tt.forceSinglePass===!1?(tt.side=De,tt.needsUpdate=!0,z.renderBufferDirect(nt,q,Q,tt,M,It),tt.side=Ln,tt.needsUpdate=!0,z.renderBufferDirect(nt,q,Q,tt,M,It),tt.side=Ae):z.renderBufferDirect(nt,q,Q,tt,M,It),M.onAfterRender(z,q,nt,Q,tt,It)}function Qs(M,q,nt){q.isScene!==!0&&(q=gt);let Q=Z.get(M),tt=A.state.lights,It=A.state.shadowsArray,Dt=tt.state.version,Pt=Tt.getParameters(M,tt.state,It,q,nt,A.state.lightProbeGridArray),Bt=Tt.getProgramCacheKey(Pt),kt=Q.programs;Q.environment=M.isMeshStandardMaterial||M.isMeshLambertMaterial||M.isMeshPhongMaterial?q.environment:null,Q.fog=q.fog;let $t=M.isMeshStandardMaterial||M.isMeshLambertMaterial&&!M.envMap||M.isMeshPhongMaterial&&!M.envMap;Q.envMap=Mt.get(M.envMap||Q.environment,$t),Q.envMapRotation=Q.environment!==null&&M.envMap===null?q.environmentRotation:M.envMapRotation,kt===void 0&&(M.addEventListener("dispose",ln),kt=new Map,Q.programs=kt);let Qt=kt.get(Bt);if(Qt!==void 0){if(Q.currentProgram===Qt&&Q.lightsStateVersion===Dt)return sc(M,Pt),Qt}else Pt.uniforms=Tt.getUniforms(M),k!==null&&M.isNodeMaterial&&k.build(M,nt,Pt),M.onBeforeCompile(Pt,z),Qt=Tt.acquireProgram(Pt,Bt),kt.set(Bt,Qt),Q.uniforms=Pt.uniforms;let Vt=Q.uniforms;return(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(Vt.clippingPlanes=zt.uniform),sc(M,Pt),Q.needsLights=fu(M),Q.lightsStateVersion=Dt,Q.needsLights&&(Vt.ambientLightColor.value=tt.state.ambient,Vt.lightProbe.value=tt.state.probe,Vt.directionalLights.value=tt.state.directional,Vt.directionalLightShadows.value=tt.state.directionalShadow,Vt.spotLights.value=tt.state.spot,Vt.spotLightShadows.value=tt.state.spotShadow,Vt.rectAreaLights.value=tt.state.rectArea,Vt.ltc_1.value=tt.state.rectAreaLTC1,Vt.ltc_2.value=tt.state.rectAreaLTC2,Vt.pointLights.value=tt.state.point,Vt.pointLightShadows.value=tt.state.pointShadow,Vt.hemisphereLights.value=tt.state.hemi,Vt.directionalShadowMatrix.value=tt.state.directionalShadowMatrix,Vt.spotLightMatrix.value=tt.state.spotLightMatrix,Vt.spotLightMap.value=tt.state.spotLightMap,Vt.pointShadowMatrix.value=tt.state.pointShadowMatrix),Q.lightProbeGrid=A.state.lightProbeGridArray.length>0,Q.currentProgram=Qt,Q.uniformsList=null,Qt}function ic(M){if(M.uniformsList===null){let q=M.currentProgram.getUniforms();M.uniformsList=Ki.seqWithValue(q.seq,M.uniforms)}return M.uniformsList}function sc(M,q){let nt=Z.get(M);nt.outputColorSpace=q.outputColorSpace,nt.batching=q.batching,nt.batchingColor=q.batchingColor,nt.instancing=q.instancing,nt.instancingColor=q.instancingColor,nt.instancingMorph=q.instancingMorph,nt.skinning=q.skinning,nt.morphTargets=q.morphTargets,nt.morphNormals=q.morphNormals,nt.morphColors=q.morphColors,nt.morphTargetsCount=q.morphTargetsCount,nt.numClippingPlanes=q.numClippingPlanes,nt.numIntersection=q.numClipIntersection,nt.vertexAlphas=q.vertexAlphas,nt.vertexTangents=q.vertexTangents,nt.toneMapping=q.toneMapping}function hu(M,q){if(M.length===0)return null;if(M.length===1)return M[0].texture!==null?M[0]:null;v.setFromMatrixPosition(q.matrixWorld);for(let nt=0,Q=M.length;nt<Q;nt++){let tt=M[nt];if(tt.texture!==null&&tt.boundingBox.containsPoint(v))return tt}return null}function uu(M,q,nt,Q,tt){q.isScene!==!0&&(q=gt),st.resetTextureUnits();let It=q.fog,Dt=Q.isMeshStandardMaterial||Q.isMeshLambertMaterial||Q.isMeshPhongMaterial?q.environment:null,Pt=V===null?z.outputColorSpace:V.isXRRenderTarget===!0?V.texture.colorSpace:ee.workingColorSpace,Bt=Q.isMeshStandardMaterial||Q.isMeshLambertMaterial&&!Q.envMap||Q.isMeshPhongMaterial&&!Q.envMap,kt=Mt.get(Q.envMap||Dt,Bt),$t=Q.vertexColors===!0&&!!nt.attributes.color&&nt.attributes.color.itemSize===4,Qt=!!nt.attributes.tangent&&(!!Q.normalMap||Q.anisotropy>0),Vt=!!nt.morphAttributes.position,se=!!nt.morphAttributes.normal,ge=!!nt.morphAttributes.color,me=Ze;Q.toneMapped&&(V===null||V.isXRRenderTarget===!0)&&(me=z.toneMapping);let re=nt.morphAttributes.position||nt.morphAttributes.normal||nt.morphAttributes.color,we=re!==void 0?re.length:0,Nt=Z.get(Q),Be=A.state.lights;if(F===!0&&(I===!0||M!==mt)){let ce=M===mt&&Q.id===pt;zt.setState(Q,M,ce)}let ne=!1;Q.version===Nt.__version?(Nt.needsLights&&Nt.lightsStateVersion!==Be.state.version||Nt.outputColorSpace!==Pt||tt.isBatchedMesh&&Nt.batching===!1||!tt.isBatchedMesh&&Nt.batching===!0||tt.isBatchedMesh&&Nt.batchingColor===!0&&tt.colorTexture===null||tt.isBatchedMesh&&Nt.batchingColor===!1&&tt.colorTexture!==null||tt.isInstancedMesh&&Nt.instancing===!1||!tt.isInstancedMesh&&Nt.instancing===!0||tt.isSkinnedMesh&&Nt.skinning===!1||!tt.isSkinnedMesh&&Nt.skinning===!0||tt.isInstancedMesh&&Nt.instancingColor===!0&&tt.instanceColor===null||tt.isInstancedMesh&&Nt.instancingColor===!1&&tt.instanceColor!==null||tt.isInstancedMesh&&Nt.instancingMorph===!0&&tt.morphTexture===null||tt.isInstancedMesh&&Nt.instancingMorph===!1&&tt.morphTexture!==null||Nt.envMap!==kt||Q.fog===!0&&Nt.fog!==It||Nt.numClippingPlanes!==void 0&&(Nt.numClippingPlanes!==zt.numPlanes||Nt.numIntersection!==zt.numIntersection)||Nt.vertexAlphas!==$t||Nt.vertexTangents!==Qt||Nt.morphTargets!==Vt||Nt.morphNormals!==se||Nt.morphColors!==ge||Nt.toneMapping!==me||Nt.morphTargetsCount!==we||!!Nt.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(ne=!0):(ne=!0,Nt.__version=Q.version);let Je=Nt.currentProgram;ne===!0&&(Je=Qs(Q,q,tt),k&&Q.isNodeMaterial&&k.onUpdateProgram(Q,Je,Nt));let cn=!1,Dn=!1,xi=!1,ae=Je.getUniforms(),_e=Nt.uniforms;if(_.useProgram(Je.program)&&(cn=!0,Dn=!0,xi=!0),Q.id!==pt&&(pt=Q.id,Dn=!0),Nt.needsLights){let ce=hu(A.state.lightProbeGridArray,tt);Nt.lightProbeGrid!==ce&&(Nt.lightProbeGrid=ce,Dn=!0)}if(cn||mt!==M){_.buffers.depth.getReversed()&&M.reversedDepth!==!0&&(M._reversedDepth=!0,M.updateProjectionMatrix()),ae.setValue(m,"projectionMatrix",M.projectionMatrix),ae.setValue(m,"viewMatrix",M.matrixWorldInverse);let Fn=ae.map.cameraPosition;Fn!==void 0&&Fn.setValue(m,K.setFromMatrixPosition(M.matrixWorld)),b.logarithmicDepthBuffer&&ae.setValue(m,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),(Q.isMeshPhongMaterial||Q.isMeshToonMaterial||Q.isMeshLambertMaterial||Q.isMeshBasicMaterial||Q.isMeshStandardMaterial||Q.isShaderMaterial)&&ae.setValue(m,"isOrthographic",M.isOrthographicCamera===!0),mt!==M&&(mt=M,Dn=!0,xi=!0)}if(Nt.needsLights&&(Be.state.directionalShadowMap.length>0&&ae.setValue(m,"directionalShadowMap",Be.state.directionalShadowMap,st),Be.state.spotShadowMap.length>0&&ae.setValue(m,"spotShadowMap",Be.state.spotShadowMap,st),Be.state.pointShadowMap.length>0&&ae.setValue(m,"pointShadowMap",Be.state.pointShadowMap,st)),tt.isSkinnedMesh){ae.setOptional(m,tt,"bindMatrix"),ae.setOptional(m,tt,"bindMatrixInverse");let ce=tt.skeleton;ce&&(ce.boneTexture===null&&ce.computeBoneTexture(),ae.setValue(m,"boneTexture",ce.boneTexture,st))}tt.isBatchedMesh&&(ae.setOptional(m,tt,"batchingTexture"),ae.setValue(m,"batchingTexture",tt._matricesTexture,st),ae.setOptional(m,tt,"batchingIdTexture"),ae.setValue(m,"batchingIdTexture",tt._indirectTexture,st),ae.setOptional(m,tt,"batchingColorTexture"),tt._colorsTexture!==null&&ae.setValue(m,"batchingColorTexture",tt._colorsTexture,st));let Un=nt.morphAttributes;if((Un.position!==void 0||Un.normal!==void 0||Un.color!==void 0)&&G.update(tt,nt,Je),(Dn||Nt.receiveShadow!==tt.receiveShadow)&&(Nt.receiveShadow=tt.receiveShadow,ae.setValue(m,"receiveShadow",tt.receiveShadow)),(Q.isMeshStandardMaterial||Q.isMeshLambertMaterial||Q.isMeshPhongMaterial)&&Q.envMap===null&&q.environment!==null&&(_e.envMapIntensity.value=q.environmentIntensity),_e.dfgLUT!==void 0&&(_e.dfgLUT.value=p0()),Dn){if(ae.setValue(m,"toneMappingExposure",z.toneMappingExposure),Nt.needsLights&&du(_e,xi),It&&Q.fog===!0&&Ut.refreshFogUniforms(_e,It),Ut.refreshMaterialUniforms(_e,Q,D,X,A.state.transmissionRenderTarget[M.id]),Nt.needsLights&&Nt.lightProbeGrid){let ce=Nt.lightProbeGrid;_e.probesSH.value=ce.texture,_e.probesMin.value.copy(ce.boundingBox.min),_e.probesMax.value.copy(ce.boundingBox.max),_e.probesResolution.value.copy(ce.resolution)}Ki.upload(m,ic(Nt),_e,st)}if(Q.isShaderMaterial&&Q.uniformsNeedUpdate===!0&&(Ki.upload(m,ic(Nt),_e,st),Q.uniformsNeedUpdate=!1),Q.isSpriteMaterial&&ae.setValue(m,"center",tt.center),ae.setValue(m,"modelViewMatrix",tt.modelViewMatrix),ae.setValue(m,"normalMatrix",tt.normalMatrix),ae.setValue(m,"modelMatrix",tt.matrixWorld),Q.uniformsGroups!==void 0){let ce=Q.uniformsGroups;for(let Fn=0,yi=ce.length;Fn<yi;Fn++){let rc=ce[Fn];xt.update(rc,Je),xt.bind(rc,Je)}}return Je}function du(M,q){M.ambientLightColor.needsUpdate=q,M.lightProbe.needsUpdate=q,M.directionalLights.needsUpdate=q,M.directionalLightShadows.needsUpdate=q,M.pointLights.needsUpdate=q,M.pointLightShadows.needsUpdate=q,M.spotLights.needsUpdate=q,M.spotLightShadows.needsUpdate=q,M.rectAreaLights.needsUpdate=q,M.hemisphereLights.needsUpdate=q}function fu(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return it},this.getActiveMipmapLevel=function(){return Y},this.getRenderTarget=function(){return V},this.setRenderTargetTextures=function(M,q,nt){let Q=Z.get(M);Q.__autoAllocateDepthBuffer=M.resolveDepthBuffer===!1,Q.__autoAllocateDepthBuffer===!1&&(Q.__useRenderToTexture=!1),Z.get(M.texture).__webglTexture=q,Z.get(M.depthTexture).__webglTexture=Q.__autoAllocateDepthBuffer?void 0:nt,Q.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(M,q){let nt=Z.get(M);nt.__webglFramebuffer=q,nt.__useDefaultFramebuffer=q===void 0},this.setRenderTarget=function(M,q=0,nt=0){V=M,it=q,Y=nt;let Q=null,tt=!1,It=!1;if(M){let Pt=Z.get(M);if(Pt.__useDefaultFramebuffer!==void 0){_.bindFramebuffer(m.FRAMEBUFFER,Pt.__webglFramebuffer),vt.copy(M.viewport),Ct.copy(M.scissor),Xt=M.scissorTest,_.viewport(vt),_.scissor(Ct),_.setScissorTest(Xt),pt=-1;return}else if(Pt.__webglFramebuffer===void 0)st.setupRenderTarget(M);else if(Pt.__hasExternalTextures)st.rebindTextures(M,Z.get(M.texture).__webglTexture,Z.get(M.depthTexture).__webglTexture);else if(M.depthBuffer){let $t=M.depthTexture;if(Pt.__boundDepthTexture!==$t){if($t!==null&&Z.has($t)&&(M.width!==$t.image.width||M.height!==$t.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");st.setupDepthRenderbuffer(M)}}let Bt=M.texture;(Bt.isData3DTexture||Bt.isDataArrayTexture||Bt.isCompressedArrayTexture)&&(It=!0);let kt=Z.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(Array.isArray(kt[q])?Q=kt[q][nt]:Q=kt[q],tt=!0):M.samples>0&&st.useMultisampledRTT(M)===!1?Q=Z.get(M).__webglMultisampledFramebuffer:Array.isArray(kt)?Q=kt[nt]:Q=kt,vt.copy(M.viewport),Ct.copy(M.scissor),Xt=M.scissorTest}else vt.copy(B).multiplyScalar(D).floor(),Ct.copy(et).multiplyScalar(D).floor(),Xt=ut;if(nt!==0&&(Q=lt),_.bindFramebuffer(m.FRAMEBUFFER,Q)&&_.drawBuffers(M,Q),_.viewport(vt),_.scissor(Ct),_.setScissorTest(Xt),tt){let Pt=Z.get(M.texture);m.framebufferTexture2D(m.FRAMEBUFFER,m.COLOR_ATTACHMENT0,m.TEXTURE_CUBE_MAP_POSITIVE_X+q,Pt.__webglTexture,nt)}else if(It){let Pt=q;for(let Bt=0;Bt<M.textures.length;Bt++){let kt=Z.get(M.textures[Bt]);m.framebufferTextureLayer(m.FRAMEBUFFER,m.COLOR_ATTACHMENT0+Bt,kt.__webglTexture,nt,Pt)}}else if(M!==null&&nt!==0){let Pt=Z.get(M.texture);m.framebufferTexture2D(m.FRAMEBUFFER,m.COLOR_ATTACHMENT0,m.TEXTURE_2D,Pt.__webglTexture,nt)}pt=-1},this.readRenderTargetPixels=function(M,q,nt,Q,tt,It,Dt,Pt=0){if(!(M&&M.isWebGLRenderTarget)){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Bt=Z.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Dt!==void 0&&(Bt=Bt[Dt]),Bt){_.bindFramebuffer(m.FRAMEBUFFER,Bt);try{let kt=M.textures[Pt],$t=kt.format,Qt=kt.type;if(M.textures.length>1&&m.readBuffer(m.COLOR_ATTACHMENT0+Pt),!b.textureFormatReadable($t)){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!b.textureTypeReadable(Qt)){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}q>=0&&q<=M.width-Q&&nt>=0&&nt<=M.height-tt&&m.readPixels(q,nt,Q,tt,At.convert($t),At.convert(Qt),It)}finally{let kt=V!==null?Z.get(V).__webglFramebuffer:null;_.bindFramebuffer(m.FRAMEBUFFER,kt)}}},this.readRenderTargetPixelsAsync=async function(M,q,nt,Q,tt,It,Dt,Pt=0){if(!(M&&M.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Bt=Z.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&Dt!==void 0&&(Bt=Bt[Dt]),Bt)if(q>=0&&q<=M.width-Q&&nt>=0&&nt<=M.height-tt){_.bindFramebuffer(m.FRAMEBUFFER,Bt);let kt=M.textures[Pt],$t=kt.format,Qt=kt.type;if(M.textures.length>1&&m.readBuffer(m.COLOR_ATTACHMENT0+Pt),!b.textureFormatReadable($t))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!b.textureTypeReadable(Qt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Vt=m.createBuffer();m.bindBuffer(m.PIXEL_PACK_BUFFER,Vt),m.bufferData(m.PIXEL_PACK_BUFFER,It.byteLength,m.STREAM_READ),m.readPixels(q,nt,Q,tt,At.convert($t),At.convert(Qt),0);let se=V!==null?Z.get(V).__webglFramebuffer:null;_.bindFramebuffer(m.FRAMEBUFFER,se);let ge=m.fenceSync(m.SYNC_GPU_COMMANDS_COMPLETE,0);return m.flush(),await ph(m,ge,4),m.bindBuffer(m.PIXEL_PACK_BUFFER,Vt),m.getBufferSubData(m.PIXEL_PACK_BUFFER,0,It),m.deleteBuffer(Vt),m.deleteSync(ge),It}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(M,q=null,nt=0){let Q=Math.pow(2,-nt),tt=Math.floor(M.image.width*Q),It=Math.floor(M.image.height*Q),Dt=q!==null?q.x:0,Pt=q!==null?q.y:0;st.setTexture2D(M,0),m.copyTexSubImage2D(m.TEXTURE_2D,nt,0,0,Dt,Pt,tt,It),_.unbindTexture()},this.copyTextureToTexture=function(M,q,nt=null,Q=null,tt=0,It=0){let Dt,Pt,Bt,kt,$t,Qt,Vt,se,ge,me=M.isCompressedTexture?M.mipmaps[It]:M.image;if(nt!==null)Dt=nt.max.x-nt.min.x,Pt=nt.max.y-nt.min.y,Bt=nt.isBox3?nt.max.z-nt.min.z:1,kt=nt.min.x,$t=nt.min.y,Qt=nt.isBox3?nt.min.z:0;else{let _e=Math.pow(2,-tt);Dt=Math.floor(me.width*_e),Pt=Math.floor(me.height*_e),M.isDataArrayTexture?Bt=me.depth:M.isData3DTexture?Bt=Math.floor(me.depth*_e):Bt=1,kt=0,$t=0,Qt=0}Q!==null?(Vt=Q.x,se=Q.y,ge=Q.z):(Vt=0,se=0,ge=0);let re=At.convert(q.format),we=At.convert(q.type),Nt;q.isData3DTexture?(st.setTexture3D(q,0),Nt=m.TEXTURE_3D):q.isDataArrayTexture||q.isCompressedArrayTexture?(st.setTexture2DArray(q,0),Nt=m.TEXTURE_2D_ARRAY):(st.setTexture2D(q,0),Nt=m.TEXTURE_2D),_.activeTexture(m.TEXTURE0),_.pixelStorei(m.UNPACK_FLIP_Y_WEBGL,q.flipY),_.pixelStorei(m.UNPACK_PREMULTIPLY_ALPHA_WEBGL,q.premultiplyAlpha),_.pixelStorei(m.UNPACK_ALIGNMENT,q.unpackAlignment);let Be=_.getParameter(m.UNPACK_ROW_LENGTH),ne=_.getParameter(m.UNPACK_IMAGE_HEIGHT),Je=_.getParameter(m.UNPACK_SKIP_PIXELS),cn=_.getParameter(m.UNPACK_SKIP_ROWS),Dn=_.getParameter(m.UNPACK_SKIP_IMAGES);_.pixelStorei(m.UNPACK_ROW_LENGTH,me.width),_.pixelStorei(m.UNPACK_IMAGE_HEIGHT,me.height),_.pixelStorei(m.UNPACK_SKIP_PIXELS,kt),_.pixelStorei(m.UNPACK_SKIP_ROWS,$t),_.pixelStorei(m.UNPACK_SKIP_IMAGES,Qt);let xi=M.isDataArrayTexture||M.isData3DTexture,ae=q.isDataArrayTexture||q.isData3DTexture;if(M.isDepthTexture){let _e=Z.get(M),Un=Z.get(q),ce=Z.get(_e.__renderTarget),Fn=Z.get(Un.__renderTarget);_.bindFramebuffer(m.READ_FRAMEBUFFER,ce.__webglFramebuffer),_.bindFramebuffer(m.DRAW_FRAMEBUFFER,Fn.__webglFramebuffer);for(let yi=0;yi<Bt;yi++)xi&&(m.framebufferTextureLayer(m.READ_FRAMEBUFFER,m.COLOR_ATTACHMENT0,Z.get(M).__webglTexture,tt,Qt+yi),m.framebufferTextureLayer(m.DRAW_FRAMEBUFFER,m.COLOR_ATTACHMENT0,Z.get(q).__webglTexture,It,ge+yi)),m.blitFramebuffer(kt,$t,Dt,Pt,Vt,se,Dt,Pt,m.DEPTH_BUFFER_BIT,m.NEAREST);_.bindFramebuffer(m.READ_FRAMEBUFFER,null),_.bindFramebuffer(m.DRAW_FRAMEBUFFER,null)}else if(tt!==0||M.isRenderTargetTexture||Z.has(M)){let _e=Z.get(M),Un=Z.get(q);_.bindFramebuffer(m.READ_FRAMEBUFFER,ot),_.bindFramebuffer(m.DRAW_FRAMEBUFFER,J);for(let ce=0;ce<Bt;ce++)xi?m.framebufferTextureLayer(m.READ_FRAMEBUFFER,m.COLOR_ATTACHMENT0,_e.__webglTexture,tt,Qt+ce):m.framebufferTexture2D(m.READ_FRAMEBUFFER,m.COLOR_ATTACHMENT0,m.TEXTURE_2D,_e.__webglTexture,tt),ae?m.framebufferTextureLayer(m.DRAW_FRAMEBUFFER,m.COLOR_ATTACHMENT0,Un.__webglTexture,It,ge+ce):m.framebufferTexture2D(m.DRAW_FRAMEBUFFER,m.COLOR_ATTACHMENT0,m.TEXTURE_2D,Un.__webglTexture,It),tt!==0?m.blitFramebuffer(kt,$t,Dt,Pt,Vt,se,Dt,Pt,m.COLOR_BUFFER_BIT,m.NEAREST):ae?m.copyTexSubImage3D(Nt,It,Vt,se,ge+ce,kt,$t,Dt,Pt):m.copyTexSubImage2D(Nt,It,Vt,se,kt,$t,Dt,Pt);_.bindFramebuffer(m.READ_FRAMEBUFFER,null),_.bindFramebuffer(m.DRAW_FRAMEBUFFER,null)}else ae?M.isDataTexture||M.isData3DTexture?m.texSubImage3D(Nt,It,Vt,se,ge,Dt,Pt,Bt,re,we,me.data):q.isCompressedArrayTexture?m.compressedTexSubImage3D(Nt,It,Vt,se,ge,Dt,Pt,Bt,re,me.data):m.texSubImage3D(Nt,It,Vt,se,ge,Dt,Pt,Bt,re,we,me):M.isDataTexture?m.texSubImage2D(m.TEXTURE_2D,It,Vt,se,Dt,Pt,re,we,me.data):M.isCompressedTexture?m.compressedTexSubImage2D(m.TEXTURE_2D,It,Vt,se,me.width,me.height,re,me.data):m.texSubImage2D(m.TEXTURE_2D,It,Vt,se,Dt,Pt,re,we,me);_.pixelStorei(m.UNPACK_ROW_LENGTH,Be),_.pixelStorei(m.UNPACK_IMAGE_HEIGHT,ne),_.pixelStorei(m.UNPACK_SKIP_PIXELS,Je),_.pixelStorei(m.UNPACK_SKIP_ROWS,cn),_.pixelStorei(m.UNPACK_SKIP_IMAGES,Dn),It===0&&q.generateMipmaps&&m.generateMipmap(Nt),_.unbindTexture()},this.initRenderTarget=function(M){Z.get(M).__webglFramebuffer===void 0&&st.setupRenderTarget(M)},this.initTexture=function(M){M.isCubeTexture?st.setTextureCube(M,0):M.isData3DTexture?st.setTexture3D(M,0):M.isDataArrayTexture||M.isCompressedArrayTexture?st.setTexture2DArray(M,0):st.setTexture2D(M,0),_.unbindTexture()},this.resetState=function(){it=0,Y=0,V=null,_.reset(),Rt.reset()},typeof __THREE_DEVTOOLS__!="undefined"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return nn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=ee._getDrawingBufferColorSpace(t),e.unpackColorSpace=ee._getUnpackColorSpace()}};var Ks=Te,gi=class i extends di{constructor(t){super(t),this.defaultDPI=90,this.defaultUnit="px"}load(t,e,n,s){let r=this,a=new Ds(r.manager);a.setPath(r.path),a.setRequestHeader(r.requestHeader),a.setWithCredentials(r.withCredentials),a.load(t,function(o){try{e(r.parse(o))}catch(c){s?s(c):console.error(c),r.manager.itemError(t)}},n,s)}parse(t){let e=this;function n(D,P){if(D.nodeType!==1)return;D.hasAttribute("filter")&&console.warn("THREE.SVGLoader: Filters are not supported.");let E=R(D),B=!1,et=null;switch(D.nodeName){case"svg":P=S(D,P);break;case"style":r(D);break;case"g":P=S(D,P);break;case"path":P=S(D,P),D.hasAttribute("d")&&(et=s(D));break;case"rect":P=S(D,P),et=c(D);break;case"polygon":P=S(D,P),et=l(D);break;case"polyline":P=S(D,P),et=u(D);break;case"circle":P=S(D,P),et=d(D);break;case"ellipse":P=S(D,P),et=h(D);break;case"line":P=S(D,P),et=p(D);break;case"defs":B=!0;break;case"use":P=S(D,P);let F=(D.getAttributeNS("http://www.w3.org/1999/xlink","href")||"").substring(1),I=D.viewportElement.getElementById(F);I?n(I,P):console.warn("SVGLoader: 'use node' references non-existent node id: "+F);break;default:}if(et){P.fill!==void 0&&P.fill!=="none"&&!P.fill.startsWith("url")&&et.color.setStyle(P.fill,Ks),y(et,Yt),J.push(et);let T=Object.assign({},P);T.strokeWidth=P.strokeWidth*lt(Yt),et.userData={node:D,style:T,transform:Yt.clone(),gradients:Y}}let ut=D.childNodes;for(let T=0;T<ut.length;T++){let F=ut[T];B&&F.nodeName!=="style"&&F.nodeName!=="defs"||n(F,P)}E&&(V.pop(),V.length>0?Yt.copy(V[V.length-1]):Yt.identity())}function s(D){let P=new sn,E=new yt,B=new yt,et=new yt,ut=!0,T=!1,F=D.getAttribute("d");if(F===""||F==="none")return null;let I=F.match(/[a-df-z][^a-df-z]*/ig);for(let $=0,K=I.length;$<K;$++){let rt=I[$],gt=rt.charAt(0),_t=rt.slice(1).trim();ut===!0&&(T=!0,ut=!1);let H;switch(gt){case"M":H=f(_t);for(let m=0,j=H.length;m<j;m+=2)E.x=H[m+0],E.y=H[m+1],B.x=E.x,B.y=E.y,m===0?P.moveTo(E.x,E.y):P.lineTo(E.x,E.y),m===0&&et.copy(E);break;case"H":H=f(_t);for(let m=0,j=H.length;m<j;m++)E.x=H[m],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"V":H=f(_t);for(let m=0,j=H.length;m<j;m++)E.y=H[m],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"L":H=f(_t);for(let m=0,j=H.length;m<j;m+=2)E.x=H[m+0],E.y=H[m+1],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"C":H=f(_t);for(let m=0,j=H.length;m<j;m+=6)P.bezierCurveTo(H[m+0],H[m+1],H[m+2],H[m+3],H[m+4],H[m+5]),B.x=H[m+2],B.y=H[m+3],E.x=H[m+4],E.y=H[m+5],m===0&&T===!0&&et.copy(E);break;case"S":H=f(_t);for(let m=0,j=H.length;m<j;m+=4)P.bezierCurveTo(g(E.x,B.x),g(E.y,B.y),H[m+0],H[m+1],H[m+2],H[m+3]),B.x=H[m+0],B.y=H[m+1],E.x=H[m+2],E.y=H[m+3],m===0&&T===!0&&et.copy(E);break;case"Q":H=f(_t);for(let m=0,j=H.length;m<j;m+=4)P.quadraticCurveTo(H[m+0],H[m+1],H[m+2],H[m+3]),B.x=H[m+0],B.y=H[m+1],E.x=H[m+2],E.y=H[m+3],m===0&&T===!0&&et.copy(E);break;case"T":H=f(_t);for(let m=0,j=H.length;m<j;m+=2){let ft=g(E.x,B.x),b=g(E.y,B.y);P.quadraticCurveTo(ft,b,H[m+0],H[m+1]),B.x=ft,B.y=b,E.x=H[m+0],E.y=H[m+1],m===0&&T===!0&&et.copy(E)}break;case"A":H=f(_t,[3,4],7);for(let m=0,j=H.length;m<j;m+=7){if(H[m+5]==E.x&&H[m+6]==E.y)continue;let ft=E.clone();E.x=H[m+5],E.y=H[m+6],B.x=E.x,B.y=E.y,a(P,H[m],H[m+1],H[m+2],H[m+3],H[m+4],ft,E),m===0&&T===!0&&et.copy(E)}break;case"m":H=f(_t);for(let m=0,j=H.length;m<j;m+=2)E.x+=H[m+0],E.y+=H[m+1],B.x=E.x,B.y=E.y,m===0?P.moveTo(E.x,E.y):P.lineTo(E.x,E.y),m===0&&et.copy(E);break;case"h":H=f(_t);for(let m=0,j=H.length;m<j;m++)E.x+=H[m],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"v":H=f(_t);for(let m=0,j=H.length;m<j;m++)E.y+=H[m],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"l":H=f(_t);for(let m=0,j=H.length;m<j;m+=2)E.x+=H[m+0],E.y+=H[m+1],B.x=E.x,B.y=E.y,P.lineTo(E.x,E.y),m===0&&T===!0&&et.copy(E);break;case"c":H=f(_t);for(let m=0,j=H.length;m<j;m+=6)P.bezierCurveTo(E.x+H[m+0],E.y+H[m+1],E.x+H[m+2],E.y+H[m+3],E.x+H[m+4],E.y+H[m+5]),B.x=E.x+H[m+2],B.y=E.y+H[m+3],E.x+=H[m+4],E.y+=H[m+5],m===0&&T===!0&&et.copy(E);break;case"s":H=f(_t);for(let m=0,j=H.length;m<j;m+=4)P.bezierCurveTo(g(E.x,B.x),g(E.y,B.y),E.x+H[m+0],E.y+H[m+1],E.x+H[m+2],E.y+H[m+3]),B.x=E.x+H[m+0],B.y=E.y+H[m+1],E.x+=H[m+2],E.y+=H[m+3],m===0&&T===!0&&et.copy(E);break;case"q":H=f(_t);for(let m=0,j=H.length;m<j;m+=4)P.quadraticCurveTo(E.x+H[m+0],E.y+H[m+1],E.x+H[m+2],E.y+H[m+3]),B.x=E.x+H[m+0],B.y=E.y+H[m+1],E.x+=H[m+2],E.y+=H[m+3],m===0&&T===!0&&et.copy(E);break;case"t":H=f(_t);for(let m=0,j=H.length;m<j;m+=2){let ft=g(E.x,B.x),b=g(E.y,B.y);P.quadraticCurveTo(ft,b,E.x+H[m+0],E.y+H[m+1]),B.x=ft,B.y=b,E.x=E.x+H[m+0],E.y=E.y+H[m+1],m===0&&T===!0&&et.copy(E)}break;case"a":H=f(_t,[3,4],7);for(let m=0,j=H.length;m<j;m+=7){if(H[m+5]==0&&H[m+6]==0)continue;let ft=E.clone();E.x+=H[m+5],E.y+=H[m+6],B.x=E.x,B.y=E.y,a(P,H[m],H[m+1],H[m+2],H[m+3],H[m+4],ft,E),m===0&&T===!0&&et.copy(E)}break;case"Z":case"z":P.currentPath.autoClose=!0,P.currentPath.curves.length>0&&(E.copy(et),P.currentPath.currentPoint.copy(E),ut=!0);break;default:console.warn(rt)}T=!1}return P}function r(D){if(!(!D.sheet||!D.sheet.cssRules||!D.sheet.cssRules.length))for(let P=0;P<D.sheet.cssRules.length;P++){let E=D.sheet.cssRules[P];if(E.type!==1)continue;let B=E.selectorText.split(/,/gm).filter(Boolean).map(et=>et.trim());for(let et=0;et<B.length;et++){let ut=Object.fromEntries(Object.entries(E.style).filter(([,T])=>T!==""));it[B[et]]=Object.assign(it[B[et]]||{},ut)}}}function a(D,P,E,B,et,ut,T,F){if(P==0||E==0){D.lineTo(F.x,F.y);return}B=B*Math.PI/180,P=Math.abs(P),E=Math.abs(E);let I=(T.x-F.x)/2,$=(T.y-F.y)/2,K=Math.cos(B)*I+Math.sin(B)*$,rt=-Math.sin(B)*I+Math.cos(B)*$,gt=P*P,_t=E*E,H=K*K,m=rt*rt,j=H/gt+m/_t;if(j>1){let dt=Math.sqrt(j);P=dt*P,E=dt*E,gt=P*P,_t=E*E}let ft=gt*m+_t*H,b=(gt*_t-ft)/ft,_=Math.sqrt(Math.max(0,b));et===ut&&(_=-_);let U=_*P*rt/E,Z=-_*E*K/P,st=Math.cos(B)*U-Math.sin(B)*Z+(T.x+F.x)/2,Mt=Math.sin(B)*U+Math.cos(B)*Z+(T.y+F.y)/2,St=o(1,0,(K-U)/P,(rt-Z)/E),at=o((K-U)/P,(rt-Z)/E,(-K-U)/P,(-rt-Z)/E)%(Math.PI*2);D.currentPath.absellipse(st,Mt,P,E,St,St+at,ut===0,B)}function o(D,P,E,B){let et=D*E+P*B,ut=Math.sqrt(D*D+P*P)*Math.sqrt(E*E+B*B),T=Math.acos(Math.max(-1,Math.min(1,et/ut)));return D*B-P*E<0&&(T=-T),T}function c(D){let P=v(D.getAttribute("x")||0),E=v(D.getAttribute("y")||0),B=v(D.getAttribute("rx")||D.getAttribute("ry")||0),et=v(D.getAttribute("ry")||D.getAttribute("rx")||0),ut=v(D.getAttribute("width")),T=v(D.getAttribute("height")),F=1-.551915024494,I=new sn;return I.moveTo(P+B,E),I.lineTo(P+ut-B,E),(B!==0||et!==0)&&I.bezierCurveTo(P+ut-B*F,E,P+ut,E+et*F,P+ut,E+et),I.lineTo(P+ut,E+T-et),(B!==0||et!==0)&&I.bezierCurveTo(P+ut,E+T-et*F,P+ut-B*F,E+T,P+ut-B,E+T),I.lineTo(P+B,E+T),(B!==0||et!==0)&&I.bezierCurveTo(P+B*F,E+T,P,E+T-et*F,P,E+T-et),I.lineTo(P,E+et),(B!==0||et!==0)&&I.bezierCurveTo(P,E+et*F,P+B*F,E,P+B,E),I}function l(D){function P(ut,T,F){let I=v(T),$=v(F);et===0?B.moveTo(I,$):B.lineTo(I,$),et++}let E=/([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g,B=new sn,et=0;return D.getAttribute("points").replace(E,P),B.currentPath.autoClose=!0,B}function u(D){function P(ut,T,F){let I=v(T),$=v(F);et===0?B.moveTo(I,$):B.lineTo(I,$),et++}let E=/([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g,B=new sn,et=0;return D.getAttribute("points").replace(E,P),B.currentPath.autoClose=!1,B}function d(D){let P=v(D.getAttribute("cx")||0),E=v(D.getAttribute("cy")||0),B=v(D.getAttribute("r")||0),et=new gn;et.absarc(P,E,B,0,Math.PI*2);let ut=new sn;return ut.subPaths.push(et),ut}function h(D){let P=v(D.getAttribute("cx")||0),E=v(D.getAttribute("cy")||0),B=v(D.getAttribute("rx")||0),et=v(D.getAttribute("ry")||0),ut=new gn;ut.absellipse(P,E,B,et,0,Math.PI*2);let T=new sn;return T.subPaths.push(ut),T}function p(D){let P=v(D.getAttribute("x1")||0),E=v(D.getAttribute("y1")||0),B=v(D.getAttribute("x2")||0),et=v(D.getAttribute("y2")||0),ut=new sn;return ut.moveTo(P,E),ut.lineTo(B,et),ut.currentPath.autoClose=!1,ut}function x(D){let P="http://www.w3.org/1999/xlink",E=D.querySelectorAll("linearGradient, radialGradient"),B=["x1","y1","x2","y2","cx","cy","r","fx","fy","gradientUnits","gradientTransform","spreadMethod"],et={};for(let T of E){let F=T.getAttribute("id");if(!F)continue;let I={type:T.nodeName==="radialGradient"?"radialGradient":"linearGradient",attrs:{},stops:null,href:null},$=T.getAttributeNS(P,"href")||T.getAttribute("href")||"";$.startsWith("#")&&(I.href=$.substring(1));for(let rt of B)T.hasAttribute(rt)&&(I.attrs[rt]=T.getAttribute(rt));let K=T.querySelectorAll("stop");if(K.length>0){I.stops=[];for(let rt of K){let gt=rt.getAttribute("stop-color");!gt&&rt.style&&(gt=rt.style["stop-color"]),gt||(gt="#000");let _t=rt.getAttribute("stop-opacity");(_t===null||_t==="")&&rt.style&&(_t=rt.style["stop-opacity"]),_t=_t===null||_t===""||_t===void 0?1:Math.max(0,Math.min(1,parseFloat(_t)));let H=Math.max(0,Math.min(1,parseFloat(rt.getAttribute("offset")||"0")));I.stops.push({offset:H,color:gt,opacity:_t})}}et[F]=I}function ut(T,F){let I=et[T];if(!I||F.has(T))return I;if(F.add(T),I.href&&et[I.href]){let $=ut(I.href,F);if($){I.stops||(I.stops=$.stops);for(let K in $.attrs)K in I.attrs||(I.attrs[K]=$.attrs[K])}}return I}for(let T in et)ut(T,new Set);for(let T in et){let rt=function(gt){return typeof gt!="string"?0:gt.endsWith("%")?parseFloat(gt)/100:v(gt)},F=et[T],I=F.attrs,$=I.gradientUnits==="userSpaceOnUse"?"userSpaceOnUse":"objectBoundingBox",K={type:F.type,gradientUnits:$,spreadMethod:I.spreadMethod==="reflect"||I.spreadMethod==="repeat"?I.spreadMethod:"pad",gradientTransform:null,stops:(F.stops||[]).slice().sort((gt,_t)=>gt.offset-_t.offset)};if(I.gradientTransform&&(K.gradientTransform=new Gt,N(I.gradientTransform,K.gradientTransform)),F.type==="linearGradient")K.x1=I.x1!==void 0?rt(I.x1):0,K.y1=I.y1!==void 0?rt(I.y1):0,K.x2=I.x2!==void 0?rt(I.x2):$==="objectBoundingBox"?1:0,K.y2=I.y2!==void 0?rt(I.y2):0;else{let gt=$==="objectBoundingBox"?.5:0,_t=$==="objectBoundingBox"?.5:0;K.cx=I.cx!==void 0?rt(I.cx):gt,K.cy=I.cy!==void 0?rt(I.cy):gt,K.r=I.r!==void 0?rt(I.r):_t,K.fx=I.fx!==void 0?rt(I.fx):K.cx,K.fy=I.fy!==void 0?rt(I.fy):K.cy}Y[T]=K}}function S(D,P){P=Object.assign({},P);let E={};if(D.hasAttribute("class")){let T=D.getAttribute("class").split(/\s/).filter(Boolean).map(F=>F.trim());for(let F=0;F<T.length;F++)E=Object.assign(E,it["."+T[F]])}D.hasAttribute("id")&&(E=Object.assign(E,it["#"+D.getAttribute("id")]));function B(T,F,I){I===void 0&&(I=function(K){return K}),D.hasAttribute(T)&&(P[F]=I(D.getAttribute(T))),E[F]&&(P[F]=I(E[F])),D.style&&D.style[T]!==""&&(P[F]=I(D.style[T]))}function et(T){return Math.max(0,Math.min(1,v(T)))}function ut(T){return Math.max(0,v(T))}return B("fill","fill"),B("fill-opacity","fillOpacity",et),B("fill-rule","fillRule"),B("opacity","opacity",et),B("stroke","stroke"),B("stroke-opacity","strokeOpacity",et),B("stroke-width","strokeWidth",ut),B("stroke-linejoin","strokeLineJoin"),B("stroke-linecap","strokeLineCap"),B("stroke-miterlimit","strokeMiterLimit",ut),B("visibility","visibility"),P}function g(D,P){return D-(P-D)}function f(D,P,E){if(typeof D!="string")throw new TypeError("Invalid input: "+typeof D);let B={SEPARATOR:/[ \t\r\n\,.\-+]/,WHITESPACE:/[ \t\r\n]/,DIGIT:/[\d]/,SIGN:/[-+]/,POINT:/\./,COMMA:/,/,EXP:/e/i,FLAGS:/[01]/},et=0,ut=1,T=2,F=3,I=et,$=!0,K="",rt="",gt=[];function _t(ft,b,_){let U=new SyntaxError('Unexpected character "'+ft+'" at index '+b+".");throw U.partial=_,U}function H(){K!==""&&(rt===""?gt.push(Number(K)):gt.push(Number(K)*Math.pow(10,Number(rt)))),K="",rt=""}let m,j=D.length;for(let ft=0;ft<j;ft++){if(m=D[ft],Array.isArray(P)&&P.includes(gt.length%E)&&B.FLAGS.test(m)){I=ut,K=m,H();continue}if(I===et){if(B.WHITESPACE.test(m))continue;if(B.DIGIT.test(m)||B.SIGN.test(m)){I=ut,K=m;continue}if(B.POINT.test(m)){I=T,K=m;continue}B.COMMA.test(m)&&($&&_t(m,ft,gt),$=!0)}if(I===ut){if(B.DIGIT.test(m)){K+=m;continue}if(B.POINT.test(m)){K+=m,I=T;continue}if(B.EXP.test(m)){I=F;continue}B.SIGN.test(m)&&K.length===1&&B.SIGN.test(K[0])&&_t(m,ft,gt)}if(I===T){if(B.DIGIT.test(m)){K+=m;continue}if(B.EXP.test(m)){I=F;continue}B.POINT.test(m)&&K[K.length-1]==="."&&_t(m,ft,gt)}if(I===F){if(B.DIGIT.test(m)){rt+=m;continue}if(B.SIGN.test(m)){if(rt===""){rt+=m;continue}rt.length===1&&B.SIGN.test(rt)&&_t(m,ft,gt)}}B.WHITESPACE.test(m)?(H(),I=et,$=!1):B.COMMA.test(m)?(H(),I=et,$=!0):B.SIGN.test(m)?(H(),I=ut,K=m):B.POINT.test(m)?(H(),I=T,K=m):_t(m,ft,gt)}return H(),gt}let L=["mm","cm","in","pt","pc","px"],w={mm:{mm:1,cm:.1,in:1/25.4,pt:72/25.4,pc:6/25.4,px:-1},cm:{mm:10,cm:1,in:1/2.54,pt:72/2.54,pc:6/2.54,px:-1},in:{mm:25.4,cm:2.54,in:1,pt:72,pc:6,px:-1},pt:{mm:25.4/72,cm:2.54/72,in:1/72,pt:1,pc:6/72,px:-1},pc:{mm:25.4/6,cm:2.54/6,in:1/6,pt:72/6,pc:1,px:-1},px:{px:1}};function v(D){let P="px";if(typeof D=="string"||D instanceof String)for(let B=0,et=L.length;B<et;B++){let ut=L[B];if(D.endsWith(ut)){P=ut,D=D.substring(0,D.length-ut.length);break}}let E;return P==="px"&&e.defaultUnit!=="px"?E=w.in[e.defaultUnit]/e.defaultDPI:(E=w[P][e.defaultUnit],E<0&&(E=w[P].in*e.defaultDPI)),E*parseFloat(D)}function R(D){if(!(D.hasAttribute("transform")||D.nodeName==="use"&&(D.hasAttribute("x")||D.hasAttribute("y"))))return null;let P=A(D);return V.length>0&&P.premultiply(V[V.length-1]),Yt.copy(P),V.push(P),P}function A(D){let P=new Gt;if(D.nodeName==="use"&&(D.hasAttribute("x")||D.hasAttribute("y"))){let E=v(D.getAttribute("x")||0),B=v(D.getAttribute("y")||0);P.makeTranslation(E,B)}return D.hasAttribute("transform")&&N(D.getAttribute("transform"),P),P}function N(D,P){let E=pt,B=D.split(")");for(let et=B.length-1;et>=0;et--){let ut=B[et].trim();if(ut==="")continue;let T=ut.indexOf("("),F=ut.length;if(T>0&&T<F){let I=ut.slice(0,T),$=f(ut.slice(T+1));switch(E.identity(),I){case"translate":if($.length>=1){let K=$[0],rt=0;$.length>=2&&(rt=$[1]),E.makeTranslation(K,rt)}break;case"rotate":if($.length>=1){let K=0,rt=0,gt=0;K=$[0]*Math.PI/180,$.length>=3&&(rt=$[1],gt=$[2]),mt.makeTranslation(-rt,-gt),vt.makeRotation(K),Ct.multiplyMatrices(vt,mt),mt.makeTranslation(rt,gt),E.multiplyMatrices(mt,Ct)}break;case"scale":if($.length>=1){let K=$[0],rt=K;$.length>=2&&(rt=$[1]),E.makeScale(K,rt)}break;case"skewX":$.length===1&&E.set(1,Math.tan($[0]*Math.PI/180),0,0,1,0,0,0,1);break;case"skewY":$.length===1&&E.set(1,0,0,Math.tan($[0]*Math.PI/180),1,0,0,0,1);break;case"matrix":$.length===6&&E.set($[0],$[2],$[4],$[1],$[3],$[5],0,0,1);break}P.premultiply(E)}}return P}function y(D,P){function E(T){Jt.set(T.x,T.y,1).applyMatrix3(P),T.set(Jt.x,Jt.y)}function B(T){let F=T.xRadius,I=T.yRadius,$=Math.cos(T.aRotation),K=Math.sin(T.aRotation),rt=new W(F*$,F*K,0),gt=new W(-I*K,I*$,0),_t=rt.applyMatrix3(P),H=gt.applyMatrix3(P),m=pt.set(_t.x,H.x,0,_t.y,H.y,0,0,0,1),j=mt.copy(m).invert(),_=vt.copy(j).transpose().multiply(j).elements,U=ot(_[0],_[1],_[4]),Z=Math.sqrt(U.rt1),st=Math.sqrt(U.rt2);if(T.xRadius=1/Z,T.yRadius=1/st,T.aRotation=Math.atan2(U.sn,U.cs),!((T.aEndAngle-T.aStartAngle)%(2*Math.PI)<Number.EPSILON)){let St=mt.set(Z,0,0,0,st,0,0,0,1),at=vt.set(U.cs,U.sn,0,-U.sn,U.cs,0,0,0,1),dt=St.multiply(at).multiply(m),Tt=Ut=>{let{x:wt,y:Et}=new W(Math.cos(Ut),Math.sin(Ut),0).applyMatrix3(dt);return Math.atan2(Et,wt)};T.aStartAngle=Tt(T.aStartAngle),T.aEndAngle=Tt(T.aEndAngle),C(P)&&(T.aClockwise=!T.aClockwise)}}function et(T){let F=O(P),I=k(P);T.xRadius*=F,T.yRadius*=I;let $=F>Number.EPSILON?Math.atan2(P.elements[1],P.elements[0]):Math.atan2(-P.elements[3],P.elements[4]);T.aRotation+=$,C(P)&&(T.aStartAngle*=-1,T.aEndAngle*=-1,T.aClockwise=!T.aClockwise)}let ut=D.subPaths;for(let T=0,F=ut.length;T<F;T++){let $=ut[T].curves;for(let K=0;K<$.length;K++){let rt=$[K];rt.isLineCurve?(E(rt.v1),E(rt.v2)):rt.isCubicBezierCurve?(E(rt.v0),E(rt.v1),E(rt.v2),E(rt.v3)):rt.isQuadraticBezierCurve?(E(rt.v0),E(rt.v1),E(rt.v2)):rt.isEllipseCurve&&(Xt.set(rt.aX,rt.aY),E(Xt),rt.aX=Xt.x,rt.aY=Xt.y,z(P)?B(rt):et(rt))}}}function C(D){let P=D.elements;return P[0]*P[4]-P[1]*P[3]<0}function z(D){let P=D.elements,E=P[0]*P[3]+P[1]*P[4];if(E===0)return!1;let B=O(D),et=k(D);return Math.abs(E/(B*et))>Number.EPSILON}function O(D){let P=D.elements;return Math.sqrt(P[0]*P[0]+P[1]*P[1])}function k(D){let P=D.elements;return Math.sqrt(P[3]*P[3]+P[4]*P[4])}function lt(D){let P=D.elements,E=P[0]*P[4]-P[1]*P[3];return Math.sqrt(Math.abs(E))}function ot(D,P,E){let B,et,ut,T,F,I=D+E,$=D-E,K=Math.sqrt($*$+4*P*P);return I>0?(B=.5*(I+K),F=1/B,et=D*F*E-P*F*P):I<0?et=.5*(I-K):(B=.5*K,et=-.5*K),$>0?ut=$+K:ut=$-K,Math.abs(ut)>2*Math.abs(P)?(F=-2*P/ut,T=1/Math.sqrt(1+F*F),ut=F*T):Math.abs(P)===0?(ut=1,T=0):(F=-.5*ut/P,ut=1/Math.sqrt(1+F*F),T=F*ut),$>0&&(F=ut,ut=-T,T=F),{rt1:B,rt2:et,cs:ut,sn:T}}let J=[],it={},Y={},V=[],pt=new Gt,mt=new Gt,vt=new Gt,Ct=new Gt,Xt=new yt,Jt=new W,Yt=new Gt,ct=new DOMParser().parseFromString(t,"image/svg+xml");return x(ct),n(ct.documentElement,{fill:"#000",fillOpacity:1,strokeOpacity:1,strokeWidth:1,strokeLineJoin:"miter",strokeLineCap:"butt",strokeMiterLimit:4}),{paths:J,gradients:Y,xml:ct.documentElement}}static createFillMaterial(t){let e=t.userData.style;if(e.fill===void 0||e.fill==="none")return null;let n=t.color,s=null,r=jh.exec(e.fill);if(r){let o=t.userData.gradients&&t.userData.gradients[r[1]];s=g0(o,t)}let a=new We({opacity:e.fillOpacity*(e.opacity||1),transparent:!0,side:Ae,depthWrite:!1});return s!==null?a.map=s:a.color=n,a}static createStrokeMaterial(t){let e=t.userData.style;return e.stroke===void 0||e.stroke==="none"?null:(jh.test(e.stroke)&&console.warn("THREE.SVGLoader: Gradient strokes are not supported."),new We({color:new Kt().setStyle(e.stroke,Ks),opacity:e.strokeOpacity*(e.opacity||1),transparent:!0,side:Ae,depthWrite:!1}))}static createShapes(t){return console.warn("SVGLoader: createShapes() is deprecated. Use shapePath.toShapes() instead."),t.toShapes()}static getStrokeStyle(t,e,n,s,r){return t=t!==void 0?t:1,e=e!==void 0?e:"#000",n=n!==void 0?n:"miter",s=s!==void 0?s:"butt",r=r!==void 0?r:4,{strokeColor:e,strokeWidth:t,strokeLineJoin:n,strokeLineCap:s,strokeMiterLimit:r}}static pointsToStroke(t,e,n,s){let r=[],a=[],o=[];if(i.pointsToStrokeWithBuffers(t,e,n,s,r,a,o)===0)return null;let c=new Le;return c.setAttribute("position",new oe(r,3)),c.setAttribute("normal",new oe(a,3)),c.setAttribute("uv",new oe(o,2)),c}static pointsToStrokeWithBuffers(t,e,n,s,r,a,o,c){let l=new yt,u=new yt,d=new yt,h=new yt,p=new yt,x=new yt,S=new yt,g=new yt,f=new yt,L=new yt,w=new yt,v=new yt,R=new yt,A=new yt,N=new yt,y=new yt,C=new yt;n=n!==void 0?n:12,s=s!==void 0?s:.001,c=c!==void 0?c:0,t=ut(t);let z=t.length;if(z<2)return 0;let O=t[0].equals(t[z-1]),k,lt=t[0],ot,J=e.strokeWidth/2,it=1/(z-1),Y=0,V,pt,mt,vt,Ct=!1,Xt=0,Jt=c*3,Yt=c*2;ct(t[0],t[1],l).multiplyScalar(J),g.copy(t[0]).sub(l),f.copy(t[0]).add(l),L.copy(g),w.copy(f);for(let T=1;T<z;T++){k=t[T],T===z-1?O?ot=t[1]:ot=void 0:ot=t[T+1];let F=l;if(ct(lt,k,F),d.copy(F).multiplyScalar(J),v.copy(k).sub(d),R.copy(k).add(d),V=Y+it,pt=!1,ot!==void 0){ct(k,ot,u),d.copy(u).multiplyScalar(J),A.copy(k).sub(d),N.copy(k).add(d),mt=!0,d.subVectors(ot,lt),F.dot(d)<0&&(mt=!1),T===1&&(Ct=mt),d.subVectors(ot,k),d.normalize();let I=Math.abs(F.dot(d));if(I>Number.EPSILON){let $=J/I;d.multiplyScalar(-$),h.subVectors(k,lt),p.copy(h).setLength($).add(d),y.copy(p).negate();let K=p.length(),rt=h.length();h.divideScalar(rt),x.subVectors(ot,k);let gt=x.length();if(x.divideScalar(gt),h.dot(y)<rt&&x.dot(y)<gt&&(pt=!0),C.copy(p).add(k),y.add(k),pt){let _t=mt?f:g,H=(C.x-_t.x)*(y.y-_t.y)-(C.y-_t.y)*(y.x-_t.x);(mt&&H<0||!mt&&H>0)&&y.copy(_t)}switch(vt=!1,pt?mt?(N.copy(y),R.copy(y)):(A.copy(y),v.copy(y)):P(),e.strokeLineJoin){case"bevel":E(mt,pt,V);break;case"round":B(mt,pt),mt?D(k,v,A,V,0):D(k,N,R,V,1);break;case"miter":case"miter-clip":default:let _t=J*e.strokeMiterLimit/K;if(_t<1)if(e.strokeLineJoin!=="miter-clip"){E(mt,pt,V);break}else B(mt,pt),mt?(x.subVectors(C,v).multiplyScalar(_t).add(v),S.subVectors(C,A).multiplyScalar(_t).add(A),X(v,V,0),X(x,V,0),X(k,V,.5),X(k,V,.5),X(x,V,0),X(S,V,0),X(k,V,.5),X(S,V,0),X(A,V,0)):(x.subVectors(C,R).multiplyScalar(_t).add(R),S.subVectors(C,N).multiplyScalar(_t).add(N),X(R,V,1),X(x,V,1),X(k,V,.5),X(k,V,.5),X(x,V,1),X(S,V,1),X(k,V,.5),X(S,V,1),X(N,V,1));else pt?(mt?(X(f,Y,1),X(g,Y,0),X(C,V,0),X(f,Y,1),X(C,V,0),X(y,V,1)):(X(f,Y,1),X(g,Y,0),X(C,V,1),X(g,Y,0),X(y,V,0),X(C,V,1)),mt?A.copy(C):N.copy(C)):mt?(X(v,V,0),X(C,V,0),X(k,V,.5),X(k,V,.5),X(C,V,0),X(A,V,0)):(X(R,V,1),X(C,V,1),X(k,V,.5),X(k,V,.5),X(C,V,1),X(N,V,1)),vt=!0;break}}else P()}else P();!O&&T===z-1&&et(t[0],L,w,mt,!0,Y),Y=V,lt=k,g.copy(A),f.copy(N)}if(!O)et(k,v,R,mt,!1,V);else if(pt&&r){let T=C,F=y;Ct!==mt&&(T=y,F=C),mt?(vt||Ct)&&(F.toArray(r,0),F.toArray(r,9),vt&&T.toArray(r,3)):(vt||!Ct)&&(F.toArray(r,3),F.toArray(r,9),vt&&T.toArray(r,0))}if(r){let T=[new yt,new yt,new yt],F=c*3;for(let I=F;I<Jt;I+=9)T[0].set(r[I],r[I+1]),T[1].set(r[I+3],r[I+4]),T[2].set(r[I+6],r[I+7]),Ve.area(T)<0&&(r[I+3]=T[0].x,r[I+4]=T[0].y)}return Xt;function ct(T,F,I){return I.subVectors(F,T),I.set(-I.y,I.x).normalize()}function X(T,F,I){r&&(r[Jt]=T.x,r[Jt+1]=T.y,r[Jt+2]=0,a&&(a[Jt]=0,a[Jt+1]=0,a[Jt+2]=1),Jt+=3,o&&(o[Yt]=F,o[Yt+1]=I,Yt+=2)),Xt+=3}function D(T,F,I,$,K){l.copy(F).sub(T).normalize(),u.copy(I).sub(T).normalize();let rt=Math.PI,gt=l.dot(u);Math.abs(gt)<1&&(rt=Math.abs(Math.acos(gt))),rt/=n,d.copy(F);for(let _t=0,H=n-1;_t<H;_t++)h.copy(d).rotateAround(T,rt),X(d,$,K),X(h,$,K),X(T,$,.5),d.copy(h);X(d,$,K),X(I,$,K),X(T,$,.5)}function P(){X(f,Y,1),X(g,Y,0),X(v,V,0),X(f,Y,1),X(v,V,0),X(R,V,1)}function E(T,F,I){F?T?(X(f,Y,1),X(g,Y,0),X(v,V,0),X(f,Y,1),X(v,V,0),X(y,V,1),X(v,I,0),X(A,I,0),X(y,I,.5)):(X(f,Y,1),X(g,Y,0),X(R,V,1),X(g,Y,0),X(y,V,0),X(R,V,1),X(R,I,1),X(y,I,0),X(N,I,1)):T?(X(v,I,0),X(A,I,0),X(k,I,.5)):(X(R,I,1),X(N,I,0),X(k,I,.5))}function B(T,F){F&&(T?(X(f,Y,1),X(g,Y,0),X(v,V,0),X(f,Y,1),X(v,V,0),X(y,V,1),X(v,Y,0),X(k,V,.5),X(y,V,1),X(k,V,.5),X(A,Y,0),X(y,V,1)):(X(f,Y,1),X(g,Y,0),X(R,V,1),X(g,Y,0),X(y,V,0),X(R,V,1),X(R,Y,1),X(y,V,0),X(k,V,.5),X(k,V,.5),X(y,V,0),X(N,Y,1)))}function et(T,F,I,$,K,rt){switch(e.strokeLineCap){case"round":K?D(T,I,F,rt,.5):D(T,F,I,rt,.5);break;case"square":if(K)l.subVectors(F,T),u.set(l.y,-l.x),d.addVectors(l,u).add(T),h.subVectors(u,l).add(T),$?(d.toArray(r,3),h.toArray(r,0),h.toArray(r,9)):(d.toArray(r,3),o[7]===1?h.toArray(r,9):d.toArray(r,9),h.toArray(r,0));else{l.subVectors(I,T),u.set(l.y,-l.x),d.addVectors(l,u).add(T),h.subVectors(u,l).add(T);let gt=r.length;$?(d.toArray(r,gt-3),h.toArray(r,gt-6),h.toArray(r,gt-12)):(h.toArray(r,gt-6),d.toArray(r,gt-3),h.toArray(r,gt-12))}break;case"butt":default:break}}function ut(T){let F=!1;for(let $=1,K=T.length-1;$<K;$++)if(T[$].distanceTo(T[$+1])<s){F=!0;break}if(!F)return T;let I=[];I.push(T[0]);for(let $=1,K=T.length-1;$<K;$++)T[$].distanceTo(T[$+1])>=s&&I.push(T[$]);return I.push(T[T.length-1]),I}}},jh=/^\s*url\(\s*(?:["']\s*)?#([^)'"\s]+)(?:\s*["'])?\s*\)\s*$/;function g0(i,t,e=256){if(!i||!Array.isArray(i.stops)||i.stops.length===0)return null;let n=t.userData.transform,s=i.gradientUnits==="objectBoundingBox",r=null;if(s&&(r=_0(t,n),r===null))return null;function a(d,h,p){p.set(d,h,1),i.gradientTransform&&p.applyMatrix3(i.gradientTransform),s&&p.set(r.minX+p.x*r.width,r.minY+p.y*r.height,1),n&&p.applyMatrix3(n)}let o=document.createElement("canvas"),c;if(i.type==="linearGradient"){o.width=e,o.height=1;let d=o.getContext("2d"),h=d.createLinearGradient(0,0,e,0);Qh(h,i.stops),d.fillStyle=h,d.fillRect(0,0,e,1);let p=new W,x=new W;a(i.x1,i.y1,p),a(i.x2,i.y2,x);let S=x.x-p.x,g=x.y-p.y,f=S*S+g*g||1e-20,L=S/f,w=g/f,v=-(L*p.x+w*p.y);c=new Gt().set(L,w,v,0,0,.5,0,0,1)}else{let d=i.cx,h=i.cy,p=i.fx,x=i.fy,S=i.r;if(i.gradientTransform){let y=new W;y.set(d,h,1).applyMatrix3(i.gradientTransform),d=y.x,h=y.y,y.set(p,x,1).applyMatrix3(i.gradientTransform),p=y.x,x=y.y}if(s&&(d=r.minX+d*r.width,h=r.minY+h*r.height,p=r.minX+p*r.width,x=r.minY+x*r.height,S=S*Math.sqrt((r.width*r.width+r.height*r.height)/2)),S<=0)return null;o.width=e,o.height=e;let g=o.getContext("2d"),f=d-S,L=h-S,w=2*S,v=e/w;g.setTransform(v,0,0,v,-f*v,-L*v);let R=g.createRadialGradient(p,x,0,d,h,S);Qh(R,i.stops),g.fillStyle=R,g.fillRect(f,L,w,w);let A=n?n.clone().invert():new Gt;c=new Gt().set(1/w,0,-f/w,0,1/w,-L/w,0,0,1).multiply(A)}let l=new xs(o);l.colorSpace=Ks,l.flipY=!1,l.matrixAutoUpdate=!1,l.matrix=c;let u=i.spreadMethod==="reflect"?Di:i.spreadMethod==="repeat"?Ni:Ke;return l.wrapS=u,l.wrapT=u,l}function _0(i,t){let e=t?t.clone().invert():null,n=new yt,s=new Xi;for(let r of i.subPaths)for(let a of r.getPoints())n.copy(a),e&&n.applyMatrix3(e),s.expandByPoint(n);return s.isEmpty()?null:{minX:s.min.x,minY:s.min.y,width:s.max.x-s.min.x,height:s.max.y-s.min.y}}function Qh(i,t){let e=new Kt;for(let n of t){let s=n.color;if(n.opacity<1){e.setStyle(n.color,Ks);let r=/rgb\(([^)]+)\)/.exec(e.getStyle(Ks));r&&(s=`rgba(${r[1]},${n.opacity})`)}i.addColorStop(Math.max(0,Math.min(1,n.offset)),s)}}var Wl={gate:[{d:"M458,369 L486,384 L486,464 L458,448 Z M821,369 L823,369 L823,534 L811,534 L810,532 L797,526 L791,521 L773,512 L773,510 L791,500 L791,423 L788,423 L778,430 L772,432 L772,398 Z M512,406 L515,406 L516,408 L537,419 L537,446 L516,457 L515,459 L512,459 L511,457 L507,456 L506,454 L500,452 L490,445 L491,418 L497,416 L498,414 L502,413 Z M761,407 L762,435 Z M725,443 L736,449 L739,449 L740,447 L748,443 L748,446 L758,451 L757,521 L725,521 Z M583,451 L600,451 L632,469 L617,470 L616,476 L635,477 L642,490 L644,491 L644,494 L617,494 L617,501 L657,501 L657,521 L566,521 L566,500 L581,509 L583,509 L583,501 L593,501 L593,494 L583,494 L583,477 L593,477 L593,470 L583,470 Z M534,452 L537,452 L537,467 L555,477 L555,494 L541,501 L537,505 L529,508 L528,510 L522,512 L516,517 L513,517 L514,511 L512,507 L511,509 L486,523 L486,480 L513,496 L513,465 L518,461 L526,458 L527,456 L533,454 Z M690,471 L699,474 L701,477 L724,489 L720,493 L697,505 L697,507 L715,516 L721,521 L662,521 L662,515 L667,511 L675,508 L676,505 L654,492 L668,485 L672,481 L675,481 L676,479 L682,477 Z",fill:"leaf"},{d:"M757,405 L761,407 L761,436 L740,447 L739,449 L736,449 L713,435 L714,430 L718,429 L719,427 L730,422 L731,420 L742,415 L743,413 L747,412 Z M555,436 L583,451 L583,509 L575,506 L564,498 L555,494 Z M692,451 L715,463 L715,465 L700,474 L696,474 L690,471 L682,477 L676,479 L675,481 L671,481 L661,474 L657,473 L661,469 L674,463 L680,458 L691,453 Z M458,454 L486,470 L486,528 L478,532 L477,534 L458,534 Z",fill:"cream"}],text:[{d:"M704,534 L706,535 Z M813,534 L823,534 L823,540 Z M560,535 L561,584 L573,590 L573,596 L552,596 L552,588 L544,584 L544,544 Z M594,536 L608,537 Z M614,536 L623,537 Z M627,536 L637,536 L628,537 L628,552 Z M641,536 L650,537 Z M654,536 L661,537 Z M666,536 L675,537 Z M679,536 L689,536 L689,563 L688,537 L680,537 L679,544 Z M650,537 L651,539 Z M675,537 L676,542 Z M636,538 L637,548 Z M714,540 L715,547 Z M691,542 L692,556 Z M458,543 L460,544 Z M537,543 L540,543 L540,586 L548,590 L548,596 L523,596 L523,551 L527,550 Z M518,545 L519,596 Z M745,547 L759,547 L758,557 L747,556 L742,559 L742,564 L758,564 L758,573 L742,574 L742,581 L759,581 L759,596 L734,596 L734,553 L742,550 Z M639,548 L641,549 Z M650,548 L651,551 Z M700,548 L701,551 Z M711,548 L714,549 Z M771,549 L789,559 L788,569 L782,565 L775,567 L777,570 L789,576 L788,596 L763,596 L763,584 L769,586 L770,588 L777,586 L776,583 L763,577 L763,554 Z M716,550 L717,559 Z M704,553 L706,554 Z M675,556 L677,557 Z M611,557 L612,559 Z M679,558 L680,563 Z M587,559 L589,560 Z M631,559 L632,561 Z M632,561 L633,563 Z M715,562 L730,563 L730,582 L729,584 L725,585 L730,589 L729,596 L724,596 L720,593 L718,596 L707,596 L707,567 Z M614,563 L623,564 Z M633,563 L643,564 Z M654,563 L663,564 Z M680,563 L688,564 Z M704,563 L706,564 Z M703,569 L704,594 L700,596 L691,596 L687,594 L687,574 L693,571 L693,584 L695,584 L699,581 L699,571 Z M605,571 L617,571 L620,573 L620,586 L616,588 L620,591 L620,596 L615,596 L613,594 L611,594 L611,596 L602,595 L602,573 Z M624,571 L641,571 L641,576 L632,576 L633,581 L640,581 L640,586 L632,586 L632,590 L641,590 L641,596 L624,596 Z M649,571 L662,571 L666,596 L657,595 L658,587 L654,588 L653,596 L645,596 Z M665,571 L683,571 L683,578 L679,578 L679,596 L670,596 L670,578 L666,578 Z M594,580 L598,581 Z M587,583 L589,584 Z M501,589 L502,594 Z M587,595 L589,596 Z",fill:"leaf"},{d:"M458,534 L475,535 L471,536 L461,543 L458,543 Z M703,535 L707,535 L714,539 L714,548 L710,548 L707,545 L704,545 L700,548 L700,551 L706,554 L710,550 L716,550 L716,559 L712,559 L707,563 L703,563 L702,561 L692,556 L692,542 L702,537 Z M661,536 L663,537 L663,563 L654,563 L654,537 Z M594,537 L608,537 L608,556 L611,557 L611,559 L606,561 L605,563 L602,563 L594,558 Z M614,537 L623,537 L623,563 L614,563 Z M628,537 L637,537 L637,549 L641,549 L641,537 L650,537 L650,552 L646,557 L644,563 L633,563 L628,553 Z M666,537 L675,537 L675,542 L678,544 L680,544 L680,537 L688,537 L688,563 L680,563 L680,558 L677,556 L675,556 L675,563 L666,558 Z M517,545 L518,596 L510,596 L510,584 L501,589 L501,596 L493,596 L493,559 Z M586,560 L590,560 L599,566 L598,575 L593,575 L590,572 L583,574 L583,581 L587,584 L591,583 L592,581 L599,581 L599,589 L590,595 L586,595 L572,587 L572,569 L585,562 Z",fill:"cream"}]};var Mn=1280,Sn=720,_i=6;var tu={moon:!0,creatures:!0,bushes:!0,gate:!0,text:!0};var ql=i=>({cream:"#fdfbe5",outline:"#fdfbe5",leaf:i==="twilight"?"#6b91b0":i==="emerald"?"#4d9770":i==="golden"?"#b69a4d":i==="cyber"?"#ad71bb":"#84a046",lightLeaf:i==="original"?"#afc477":i==="twilight"?"#a1bfd1":i==="cyber"?"#d0a9da":"#bfd497",vein:"#b7c894",leafVeil:"#d6e0b7",spirit:"#fdfbe5",spiritEdge:"#e2e3c4"}),Yl=[{id:"ground",visibility:"bushes",start:1.66,end:2.04,pivot:[640,358],z:-170,depth:8,parts:[{d:"M456 353 L640 247 L825 354 Q827 357 820 361 L640 464 L459 360 Q452 357 456 353 Z",fill:"leaf"}]},{id:"back-leaves",visibility:"bushes",start:1.95,end:2.45,pivot:[640,357],z:-155,depth:10,parts:[{d:"M525 350 C490 355 456 350 443 327 C429 307 441 289 461 290 C486 288 512 312 533 321 Z",fill:"lightLeaf"},{d:"M765 346 C765 297 775 255 779 225 C783 195 808 190 824 204 C850 223 839 244 822 276 C843 263 862 279 848 300 C831 325 802 341 765 346 Z",fill:"leaf"}]},{id:"deer",visibility:"creatures",start:2.38,end:2.91,pivot:[485,319],z:-148,depth:26,motion:"rise",parts:[{d:"M445 172 C425 174 417 150 422 136 C425 122 437 124 443 132 C440 108 450 81 463 77 C474 71 482 83 477 96 C471 113 460 135 464 154 L445 172 Z",fill:"spirit",stroke:"outline",strokeWidth:4,opacity:.6},{d:"M508 163 C522 143 517 118 518 97 C517 83 527 75 535 84 C552 104 546 128 533 149 C549 126 558 127 561 139 C568 156 548 179 525 173 Z",fill:"spirit",stroke:"outline",strokeWidth:4,opacity:.6},{d:"M478 149 C448 151 437 169 435 200 C430 242 436 281 452 301 C469 322 509 326 541 319 C532 293 529 266 530 230 C531 188 528 165 506 154 C497 150 486 148 478 149 Z",fill:"spirit",stroke:"outline",strokeWidth:4,opacity:.6},{d:"M449 229 C438 200 457 186 476 201 C504 219 520 274 536 320 C498 317 465 272 449 229 Z",fill:"leafVeil"},{d:"M463 219 Q492 247 534 319 M462 240 Q482 260 505 269",stroke:"vein",strokeWidth:4},{d:"M464 190 L463 202 M493 192 L494 204",stroke:"outline",strokeWidth:5}]},{id:"moon",visibility:"moon",start:1.02,end:1.82,pivot:[654,265],z:0,depth:0,parts:[]},{id:"front-leaves",visibility:"bushes",start:1.93,end:2.5,pivot:[640,413],z:145,depth:9,parts:[{d:"M519 368 C509 347 523 328 542 333 C555 335 562 343 566 348 C560 322 563 302 578 300 C600 294 606 320 600 343 C621 320 640 329 639 346 C636 369 623 386 603 397 L557 410 Z",fill:"leaf"},{d:"M656 414 C648 395 648 377 658 370 C668 365 675 374 676 385 C674 368 682 353 691 356 C705 358 702 372 695 383 C709 371 721 377 720 390 C723 404 708 422 694 429 Z",fill:"leaf"}]},{id:"whale",visibility:"creatures",start:2.07,end:2.92,pivot:[764,326],z:157,depth:22,motion:"rise",parts:[{d:"M736 284 C715 285 700 298 699 318 C695 336 708 348 725 354 C750 364 786 365 801 345 C814 328 818 300 817 265 C842 260 845 244 832 240 C824 236 818 241 813 245 C818 225 800 213 793 228 C788 238 795 253 795 267 C784 284 764 282 736 284 Z",fill:"spirit",stroke:"spiritEdge",strokeWidth:4,opacity:.53},{d:"M786 330 Q812 325 809 338 Q803 350 777 345",stroke:"outline",strokeWidth:3,opacity:.72},{d:"M747 313 C755 313 756 331 747 332 C739 331 739 314 747 313 Z",fill:"leafVeil"}]},{id:"blob",visibility:"creatures",start:2.29,end:2.88,pivot:[574,407],z:159,depth:19,motion:"rise",parts:[{d:"M538 387 C539 368 555 357 574 360 C595 360 609 373 608 392 C607 405 590 407 573 408 C551 409 535 404 538 387 Z",fill:"spirit",stroke:"outline",strokeWidth:5,opacity:.58},{d:"M565 379 L566 393 M587 378 L588 392",stroke:"outline",strokeWidth:5,opacity:.75}]},{id:"gate",visibility:"gate",start:2.84,end:3.67,pivot:[640,369],z:-5,depth:20,motion:"reveal",parts:Wl.gate},{id:"cube",visibility:"gate",start:3.2,end:3.67,pivot:[737,422],z:165,depth:18,parts:[{d:"M737 394 L761 407 L761 435 L737 449 L713 436 L713 407 Z",fill:"cream"}]},{id:"text",visibility:"text",start:2.99,end:3.73,pivot:[640,535],z:0,depth:7,motion:"reveal",parts:Wl.text}],Xl=i=>Math.max(0,Math.min(1,i));function eu(i,t){let e=Xl((t-i.start)/(i.end-i.start)),n=1-Math.pow(1-e,3);return i.id==="moon"?{sx:n,sy:n,dy:0,opacity:e>0?1:0}:i.motion==="reveal"?{sx:1,sy:.93+.07*n,dy:-4*(1-n),opacity:e}:i.motion==="rise"?{sx:.55+.45*n,sy:.12+.88*n,dy:14*(1-n),opacity:Xl(e*4)}:{sx:n,sy:.2+.8*n,dy:0,opacity:e>0?1:0}}var nu=Array.from({length:28},(i,t)=>({angle:t*2.399963,radius:35+t*41%140,size:.5+t%4*.35,delay:t%6*.025}));function iu(i,t){let e=Xl((t-.76-i.delay)/.74),n=i.radius*(1-e);return{x:654+Math.cos(i.angle)*n,y:265+Math.sin(i.angle)*n*.75,opacity:e>0&&e<1?Math.sin(e*Math.PI):0}}var io=[{id:"original",label:"Classic Night",color:"#85A96F"},{id:"twilight",label:"Twilight Blue",color:"#74B9FF"},{id:"emerald",label:"Emerald Forest",color:"#2ED573"},{id:"golden",label:"Golden Dusk",color:"#F3C248"},{id:"cyber",label:"Cyber Neon",color:"#FD79A8"}],su=_i,so=Yl.find(i=>i.id==="gate"),Zl=so?so.start:2.84,Jl=so?so.end:3.67,y0=1.02;function $l(){if(typeof document=="undefined")return!1;try{let i=document.createElement("canvas");return!!(i.getContext("webgl2")||i.getContext("webgl")||i.getContext("experimental-webgl"))}catch{return!1}}var Qi=i=>Math.max(0,Math.min(_i,i));function ru(i,t={}){if(!i||!$l())return null;let e;try{e=new to({antialias:!0,alpha:!1,powerPreference:"high-performance"})}catch{return null}e.setClearColor(0),e.outputColorSpace=Te,e.toneMapping=Ze,e.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),e.domElement.setAttribute("aria-label","\u4F17\u751F\u4E4B\u95E8 3D \u590D\u73B0"),e.domElement.setAttribute("role","img"),e.domElement.style.display="block",e.domElement.style.width="100%",e.domElement.style.height="100%",i.appendChild(e.domElement);let n=new ps,s=new dn;n.add(s);let r=new $n(-Mn/2,Mn/2,Sn/2,-Sn/2,.1,4e3);r.position.set(0,0,1600),r.lookAt(0,0,0),n.add(new Bs(16777215,1.8));let a=new Os(16777215,2.5);a.position.set(-400,700,1e3),n.add(a);let o=io.some(m=>m.id===t.theme)?t.theme:"original",c={...tu,...t.layers||{}},l=ql(o),u=new gi,d=new Set,h=new Set,p=[],x=(m,j,ft=!1)=>(d.add(m),p.push({material:m,color:j,side:ft}),m),S=m=>(h.add(m),m),g=Yl.map((m,j)=>{let ft=new dn;s.add(ft),ft.name=m.id;let b={source:m,group:ft,materials:[]},_=(U,Z=1)=>(U.transparent=!0,U.opacity=Z,b.materials.push({material:U,base:Z}),U);if(m.id==="moon"){let U=_(x(new We({color:l.cream}),"cream")),Z=new be(S(new Ps(135,64,40)),U);Z.userData.layer=m.id,ft.add(Z)}else m.parts.forEach((U,Z)=>{var dt,Tt,Ut,wt,Et,zt;let[st,Mt]=m.pivot,St=`<svg xmlns="http://www.w3.org/2000/svg"><path d="${U.d}" fill="${U.fill?l[U.fill]:"none"}" fill-rule="evenodd" stroke="${U.stroke?l[U.stroke]:"none"}" stroke-width="${U.strokeWidth||1}" stroke-linejoin="round" stroke-linecap="round"/></svg>`,at=u.parse(St);for(let Ht of at.paths){if(U.fill){let Zt=_(x(new We({color:l[U.fill],side:Ae,depthWrite:((dt=U.opacity)!=null?dt:1)===1}),U.fill),(Tt=U.opacity)!=null?Tt:1),G=_(x(new Is({color:l[U.fill],side:Ae,depthWrite:((Ut=U.opacity)!=null?Ut:1)===1}),U.fill,!0),((wt=U.opacity)!=null?wt:1)*.9);for(let bt of gi.createShapes(Ht)){let ht=S(new Cs(bt,{depth:m.depth,bevelEnabled:!1,curveSegments:24,steps:1}));if(ht.scale(1,-1,1),ht.translate(-st,Mt,-m.depth),((Et=U.opacity)!=null?Et:1)<1){let Rt=S(new Ls(bt,24));Rt.scale(1,-1,1),Rt.translate(-st,Mt,.1);let xt=new be(Rt,Zt);xt.position.z=Z*.4,xt.renderOrder=j*10+Z,ft.add(xt),xt.userData.layer=m.id,ht.groups=ht.groups.filter(Ot=>Ot.materialIndex===1)}let At=new be(ht,[Zt,G]);At.position.z=Z*.4,At.renderOrder=j*10+Z,At.userData.layer=m.id,ft.add(At)}}if(U.stroke){let Zt=_(x(new We({color:l[U.stroke],side:Ae,depthWrite:!1}),U.stroke),U.fill?1:(zt=U.opacity)!=null?zt:1);for(let G of Ht.subPaths){let bt=gi.pointsToStroke(G.getPoints(48),gi.getStrokeStyle(U.strokeWidth||1,l[U.stroke],"round","round"));if(!bt)continue;S(bt),bt.scale(1,-1,1),bt.translate(-st,Mt,Z*.4+.2);let ht=new be(bt,Zt);ht.renderOrder=j*10+Z+1,ht.userData.layer=m.id,ft.add(ht)}}}});return b}),f=nu.map(m=>{let j=x(new We({color:l.cream,transparent:!0,depthWrite:!1}),"cream"),ft=new be(S(new vs(m.size,8)),j);return s.add(ft),{star:m,mesh:ft,material:j}}),L=0,w=0,v=1,R=0,A=0,N=.45,y=3,C=m=>Math.max(N,Math.min(y,m)),z=t.interactive!==!1;z&&(e.domElement.style.touchAction="none");let O=m=>{let j=i.getBoundingClientRect(),ft=j.width||1,b=j.height||1;return{x:(r.right-r.left)/(m*ft),y:(r.top-r.bottom)/(m*b),w:ft,h:b,left:j.left,top:j.top}},k=null,lt=m=>{m.pointerType!=="touch"&&m.button===0&&(k={id:m.pointerId,x:m.clientX,y:m.clientY},i.setPointerCapture(m.pointerId))},ot=m=>{!k||k.id!==m.pointerId||(w+=(m.clientX-k.x)*.006,L=Math.max(-.75,Math.min(.75,L+(m.clientY-k.y)*.004)),k.x=m.clientX,k.y=m.clientY)},J=m=>{!k||k.id!==m.pointerId||(k=null,i.hasPointerCapture(m.pointerId)&&i.releasePointerCapture(m.pointerId))},it=()=>{k=null},Y=m=>{m.preventDefault();let j=O(v),ft=C(v*Math.exp(-m.deltaY*.001)),b=O(ft),_=m.clientX-j.left-j.w/2,U=m.clientY-j.top-j.h/2;R+=_*(j.x-b.x),A+=-U*(j.y-b.y),v=ft},V=new Map,pt=null,mt=null,vt=()=>{let m=[...V.values()];if(m.length<2)return null;let[j,ft]=m;return{d:Math.max(1,Math.hypot(j.x-ft.x,j.y-ft.y)),cx:(j.x+ft.x)/2,cy:(j.y+ft.y)/2}},Ct=m=>{m.preventDefault();for(let j of Array.from(m.changedTouches))V.set(j.identifier,{x:j.clientX,y:j.clientY});if(V.size===1){let j=m.changedTouches[0];pt={x:j.clientX,y:j.clientY},mt=null}else{let j=vt();j&&(mt={d0:j.d,z0:v,cx:j.cx,cy:j.cy}),pt=null}},Xt=m=>{if(V.size){m.preventDefault();for(let j of Array.from(m.changedTouches))V.has(j.identifier)&&V.set(j.identifier,{x:j.clientX,y:j.clientY});if(mt&&V.size>=2){let j=vt();if(!j)return;let ft=O(v),b=C(mt.z0*j.d/mt.d0),_=O(b),U=j.cx-ft.left-ft.w/2,Z=j.cy-ft.top-ft.h/2;R+=U*(ft.x-_.x)+(j.cx-mt.cx)*_.x,A+=-Z*(ft.y-_.y)-(j.cy-mt.cy)*_.y,v=b,mt.cx=j.cx,mt.cy=j.cy;return}if(pt&&V.size===1){let j=[...V.values()][0];w+=(j.x-pt.x)*.006,L=Math.max(-.75,Math.min(.75,L+(j.y-pt.y)*.004)),pt.x=j.x,pt.y=j.y}}},Jt=m=>{m.preventDefault();for(let j of Array.from(m.changedTouches))V.delete(j.identifier);if(V.size<1)pt=null,mt=null;else if(V.size===1){let j=[...V.values()][0];pt={x:j.x,y:j.y},mt=null}};z&&(i.addEventListener("pointerdown",lt),i.addEventListener("pointermove",ot),i.addEventListener("pointerup",J),i.addEventListener("pointercancel",it),i.addEventListener("wheel",Y,{passive:!1}),i.addEventListener("touchstart",Ct,{passive:!1}),i.addEventListener("touchmove",Xt,{passive:!1}),i.addEventListener("touchend",Jt,{passive:!1}),i.addEventListener("touchcancel",Jt,{passive:!1}));let Yt=()=>{let m=i.clientWidth,j=i.clientHeight;if(!m||!j)return;e.setSize(m,j,!1);let ft=Mn/Sn,b=m/j,_=b>=ft?b/ft:ft/b;b>=ft?(r.left=-Mn/2*_,r.right=Mn/2*_,r.top=Sn/2,r.bottom=-Sn/2):(r.left=-Mn/2,r.right=Mn/2,r.top=Sn/2*_,r.bottom=-Sn/2*_),r.updateProjectionMatrix()},ct=new ResizeObserver(Yt);ct.observe(i),Yt();let X=typeof window.matchMedia=="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches,D=typeof t.loopStart=="number"?t.loopStart:y0,P=Qi(D),E=_i,B=t.loop===!0,et=X?Jl:0,ut=t.autoplay!==!1&&!X,T=!1,F=!1,I=0,$=performance.now(),K,rt="",gt=()=>{let m=JSON.stringify([et,o,c,L,w,v,R,A,i.clientWidth,i.clientHeight]);if(m!==rt){if(rt=m,s.rotation.set(L,w,0),s.position.set(R,A,0),r.zoom=v,r.updateProjectionMatrix(),K!==o){let j=ql(o);for(let ft of p)ft.material.color.set(j[ft.color]),ft.side&&ft.material.color.multiplyScalar(.65);K=o}for(let j of g){let ft=eu(j.source,et),[b,_]=j.source.pivot;j.group.visible=c[j.source.visibility]&&ft.opacity>0,j.group.position.set(b-Mn/2,Sn/2-_-ft.dy,j.source.z),j.group.scale.set(Math.max(ft.sx,1e-5),Math.max(ft.sy,1e-5),Math.max(ft.sx,1e-5));for(let U of j.materials)U.material.opacity=U.base*ft.opacity}for(let j of f){let ft=iu(j.star,et);j.mesh.position.set(ft.x-Mn/2,Sn/2-ft.y,200),j.mesh.visible=c.moon&&ft.opacity>0,j.material.opacity=ft.opacity}e.render(n,r),i.dataset.frame=String(Math.min(143,Math.floor(et*24+1e-6))),i.dataset.rotation=`${L.toFixed(3)},${w.toFixed(3)}`,i.dataset.zoom=v.toFixed(3)}},_t=m=>{if(I=requestAnimationFrame(_t),F)return;let j=Math.min((m-$)/1e3,1/30);if($=m,ut&&(et+=j,et>=(B?E:_i)))if(B){let _=Math.max(.001,E-P);et=P+(et-E)%_}else et=_i,ut=!1;let ft=et>=Zl;ft?T||(T=!0,t.onGateOpen&&t.onGateOpen()):T=!1,gt(),t.onFrame&&t.onFrame({t:et,frame:Math.min(143,Math.floor(et*24+1e-6)),gateOpen:ft})};I=requestAnimationFrame(_t);let H={play(){F||(et>=_i-1e-6&&(et=B?P:Qi(P)),ut=!0)},pause(){ut=!1},seek(m){F||(et=Qi(m),ut=!1,gt())},setTheme(m){F||io.some(j=>j.id===m)&&(o=m,gt(),t.onThemeChange&&t.onThemeChange(m))},getTheme(){return o},setLoop(m){B=!!m},setLoopRange(m){let j=Qi(m[0]),ft=Qi(m[1]);P=Math.min(j,ft),E=Math.max(j,ft),E-P<.001&&(E=Qi(P+.001))},resize(){F||(Yt(),gt())},destroy(){if(!F){F=!0,cancelAnimationFrame(I),ct.disconnect(),z&&(i.removeEventListener("pointerdown",lt),i.removeEventListener("pointermove",ot),i.removeEventListener("pointerup",J),i.removeEventListener("pointercancel",it),i.removeEventListener("wheel",Y),i.removeEventListener("touchstart",Ct),i.removeEventListener("touchmove",Xt),i.removeEventListener("touchend",Jt),i.removeEventListener("touchcancel",Jt));for(let m of h)m.dispose();for(let m of d)m.dispose();e.dispose(),e.forceContextLoss(),e.domElement.remove()}},getTime(){return et},get canvas(){return e.domElement}};return gt(),H}var au={THEMES:io,DURATION:su,GATE_OPEN_AT:Zl,GATE_FULLY_OPEN_AT:Jl,hasWebGL:$l,createScene:ru};typeof window!="undefined"&&(window.LXHGate=au);return yu(v0);})();
