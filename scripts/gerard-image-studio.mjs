import { readFile, mkdir, writeFile } from 'node:fs/promises';
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
 return [config.subject, config.style ? 'Style: '+config.style : '', 'Aspect ratio: '+config.aspectRatio, 'No readable text or logos unless explicitly provided.'].filter(Boolean).join('. ');
}
export async function runImageStudio(seed,{ request, download, outputDir, templateUrl=TEMPLATE }={}) {
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
 await writeFile(new URL(filename,outputDir),buffer);
 const metadata={status:'generated',parcelId:config.parcelId,seedId:config.seedId,provider:'mistral',fileId,prompt,filename,bytes:buffer.length,createdAt:new Date().toISOString(),published:false};
 await writeFile(new URL('image-studio.json',outputDir),JSON.stringify(metadata,null,2)+'\n');
 return metadata;
}
