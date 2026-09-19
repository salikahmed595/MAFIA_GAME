// Original synthesized ambience. No samples, external downloads, or paid assets.
// Regenerate with: node tools/generate-music.mjs
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
const rate=22050,seconds=24,count=rate*seconds;
const buffer=Buffer.alloc(44+count*2);
buffer.write('RIFF');buffer.writeUInt32LE(36+count*2,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
const notes=[110,130.8128,164.8138,196,164.8138,130.8128,146.8324,123.4708];
for(let i=0;i<count;i++){
 const t=i/rate;const edge=Math.min(1,t/2,(seconds-t)/2);let sample=0;
 for(const f of [55,82.4069,110])sample+=Math.sin(t*Math.PI*2*f)*.035*(.8+.2*Math.sin(t*.7));
 for(let j=0;j<8;j++){const age=t-j*3;if(age>=0)sample+=(Math.sin(2*Math.PI*notes[j]*age)+.35*Math.sin(2*Math.PI*notes[j]*2*age))*.12*Math.min(1,age*8)*Math.exp(-age/1.6);}
 buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample*edge))*32767),44+i*2);
}
writeFileSync(new URL('../public/music.wav',import.meta.url),buffer);
