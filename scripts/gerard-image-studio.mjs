import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { runParcelStudio, studioImagePrompt } from './gerard-av-studio.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const TEMPLATE = new URL('../templates/image-studio.v1.json', import.meta.url);
export function imageStudioConfig(seed, template) {
 const declaration = seed?.templates?.find(t => t.id === 'image-studio' && t.enabled !== false);
 if (!declaration) return null;
 if (!seed.parcelId || !seed.seedId) throw new Error('invalid-image-studio-seed');
 const config = declaration.config || {};
 if (typeof config.subject !== 'string' || !config.subject.trim()) throw new Error('image-studio-subject-required');
 return { ...template.defaults, ...config, parcelId:seed.parcelId, seedId:seed.seedId, provider:'mistral' };
}
export function imageStudioPrompt(config) {
 return studioImagePrompt(config);
}
export async function runImageStudio(seed,{ request, download, outputDir, templateUrl=TEMPLATE, submit, operationId, publisherUrl, verifyFile }={}) {
 if(submit)return runParcelStudio(seed,{kind:'image',submit,operationId,outputDir,publisherUrl,download,verifyFile});
 const template=JSON.parse(await readFile(templateUrl,'utf8'));
 const config=imageStudioConfig(seed,template);
 if (!config) return {status:'disabled'};
 if (!request || !download || !outputDir) throw new Error('image-studio-adapters-required');
 const prompt=imageStudioPrompt(config);
 const response=await request(prompt);
 const fileId=response?.result?.fileId || response?.result?.file_id;
 if (response?.status !== 'generated' || !fileId) return {status:'failed',reason:'no-confirmed-generated-file'};
 const bytes=await download(fileId);
 if (!bytes || bytes.length < 1000) return {status:'failed',reason:'empty-image'};
 const buffer=Buffer.from(bytes);
 const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=buffer[0]===255 && buffer[1]===216 && buffer[2]===255;
 const webp=buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
 if (!png && !jpg && !webp) return {status:'failed',reason:'invalid-image-signature'};
 const ext=png?'png':jpg?'jpg':'webp';
 await mkdir(outputDir,{recursive:true});
 const filename='image-studio.'+ext;
 const dir=outputDir instanceof URL?fileURLToPath(outputDir):path.resolve(outputDir);
 const target=path.join(dir,filename);
 await writeFile(target,buffer);
 // Signatures alone accept truncated or fabricated files. Decode before success.
 const exec=promisify(execFile);
 let probe;
 try {
  probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',target],{timeout:30000})).stdout);
  await exec('ffmpeg',['-v','error','-xerror','-i',target,'-f','null','-'],{timeout:30000});
 } catch {return {status:'failed',reason:'image-file-not-decodable',filename};}
 const stream=probe.streams?.find(s=>s.codec_type==='video');
 if(!stream?.width||!stream?.height)return {status:'failed',reason:'image-dimensions-missing'};
 const metadata={status:'generated',parcelId:config.parcelId,seedId:config.seedId,provider:'mistral',fileId,prompt,filename,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),width:stream.width,height:stream.height,verifiedFile:true,rights:{scope:'local-preview',reviewRequired:true,source:'https://legal.mistral.ai/terms'},createdAt:new Date().toISOString(),published:false};
 await writeFile(path.join(dir,'image-studio.json'),JSON.stringify(metadata,null,2)+'\n');
 return metadata;
}
