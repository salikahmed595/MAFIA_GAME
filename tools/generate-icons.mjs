// Dependency-free PNG export of the original public/icon.svg geometry.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),8+data.length);return out;}
function inside(x,y,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)yes=!yes;}return yes;}
const mask=[[42,121],[42,64],[96,99],[150,64],[150,121],[96,150]];
const eyes=[[[60,93],[85,110],[69,118]],[[132,93],[107,110],[123,118]]];
for(const size of [192,512]){const raw=Buffer.alloc(size*(1+size*4));for(let y=0;y<size;y++){raw[y*(1+size*4)]=0;for(let x=0;x<size;x++){let coverage=0;for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++){const px=(x+(sx+.5)/2)*192/size,py=(y+(sy+.5)/2)*192/size;if(inside(px,py,mask)&&!eyes.some(e=>inside(px,py,e)))coverage+=.25;}const i=y*(1+size*4)+1+x*4;[17,23,23].forEach((v,c)=>raw[i+c]=Math.round(v*(1-coverage)+[212,183,123][c]*coverage));raw[i+3]=255;}}
const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;writeFileSync(new URL(`../public/icon-${size}.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
