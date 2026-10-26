import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = new URL('../templates/short-studio.v1.json', import.meta.url);

function localPath(value, name) {
  if (typeof value !== 'string' || !value.trim() || /^(https?:|data:)/i.test(value)) {
    throw new Error(`${name}-must-be-local-file`);
  }
  return resolve(value);
}

export function planShort(seed, template) {
  const declaration = seed?.templates?.find(t => t.id === 'short-studio' && t.enabled !== false);
  if (!declaration) return null;
  if (!seed.parcelId || !seed.seedId) throw new Error('invalid-short-studio-seed');
  const options = { ...template.defaults, ...(declaration.config ?? {}) };
  if (!Array.isArray(options.scenes) || !options.scenes.length || options.scenes.length > options.maxScenes) {
    throw new Error('invalid-short-scene-count');
  }
  if (typeof options.title !== 'string' || !options.title.trim()) throw new Error('short-title-required');
  const scenes = options.scenes.map((scene, index) => ({
    image: localPath(scene.image, `scene-${index}`),
    seconds: scene.seconds ?? options.secondsPerScene,
  }));
  const duration = scenes.reduce((sum, scene) => {
    if (!Number.isFinite(scene.seconds) || scene.seconds < 1 || scene.seconds > 15) throw new Error('invalid-scene-duration');
    return sum + scene.seconds;
  }, 0);
  if (duration > options.maxDurationSeconds || options.width !== 1080 || options.height !== 1920 || options.fps !== 30) {
    throw new Error('unsupported-short-format');
  }
  const narration = localPath(options.narrationAudio, 'narration');
  const music = options.musicAudio ? localPath(options.musicAudio, 'music') : null;
  if (music && options.musicLicenseVerified !== true) throw new Error('music-license-not-verified');
  for (const volume of [options.voiceVolume, options.musicVolume]) {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('invalid-audio-volume');
  }
  return { parcelId: seed.parcelId, seedId: seed.seedId, title: options.title.trim(),
    width: options.width, height: options.height, fps: options.fps,
    scenes, narration, music, duration, voiceVolume: options.voiceVolume,
    musicVolume: options.musicVolume, publishingEnabled: false };
}

export function ffmpegArguments(plan, output) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const scene of plan.scenes) args.push('-loop', '1', '-t', String(scene.seconds), '-i', scene.image);
  args.push('-i', plan.narration);
  if (plan.music) args.push('-stream_loop', '-1', '-i', plan.music);
  const filters = plan.scenes.map((scene, index) =>
    `[${index}:v]scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,` +
    `pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2,` +
    `fps=${plan.fps},setsar=1,trim=duration=${scene.seconds},setpts=PTS-STARTPTS[v${index}]`);
  filters.push(plan.scenes.map((_, index) => `[v${index}]`).join('') +
    `concat=n=${plan.scenes.length}:v=1:a=0[video]`);
  const voiceInput = plan.scenes.length;
  filters.push(`[${voiceInput}:a]volume=${plan.voiceVolume},apad,atrim=duration=${plan.duration}[voice]`);
  if (plan.music) {
    filters.push(`[${voiceInput + 1}:a]volume=${plan.musicVolume},atrim=duration=${plan.duration}[music]`);
    filters.push('[voice][music]amix=inputs=2:duration=first:dropout_transition=0[audio]');
  } else {
    filters.push('[voice]anull[audio]');
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[video]', '-map', '[audio]',
    '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(plan.fps),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(plan.duration), output);
  return args;
}

function run(binary, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-3000); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolveRun() : reject(new Error(`${binary}-failed-${code}: ${errors}`)));
  });
}

export async function renderShort(seed, { outputDir, templateUrl = TEMPLATE, execute = run } = {}) {
  const template = JSON.parse(await readFile(templateUrl, 'utf8'));
  const plan = planShort(seed, template);
  if (!plan) return { status: 'disabled' };
  if (!outputDir) throw new Error('output-directory-required');
  for (const source of [...plan.scenes.map(s => s.image), plan.narration, ...(plan.music ? [plan.music] : [])]) {
    if (!(await stat(source)).isFile()) throw new Error('missing-short-source-file');
  }
  await mkdir(outputDir, { recursive: true });
  const output = join(resolve(outputDir instanceof URL ? fileURLToPath(outputDir) : outputDir), 'short.mp4');
  await execute('ffmpeg', ffmpegArguments(plan, output));
  const probe = await stat(output);
  if (probe.size < 1024) throw new Error('short-render-empty');
  const metadata = { status: 'rendered-awaiting-review', ...plan, output, bytes: probe.size,
    createdAt: new Date().toISOString(), published: false };
  await writeFile(join(resolve(outputDir instanceof URL ? fileURLToPath(outputDir) : outputDir), 'short-studio.json'),
    JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}
