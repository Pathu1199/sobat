#!/usr/bin/env python3
"""One clear instructional photo per asana: a person in plain clothes on a mat,
side view, so the shape of the pose is readable at thumbnail size.
Writes assets/yoga/<id>.webp (288 px) and src/data/yogaImages.ts. Skips done ones."""
import os, re, subprocess, urllib.request
from PIL import Image

SCENE = ("exactly one person, a single Indian man in his late twenties, plain dark grey t-shirt and black track pants, barefoot on a sage-green yoga mat, "
         "pale cream wall, soft daylight from a window, full body visible, side view, calm expression, clean minimal photo, "
         "no text, no watermark, correct anatomy")
D = {
 'tadasana': 'standing perfectly straight in Tadasana Mountain pose, both feet together flat on the mat, both arms raised straight up overhead with fingers interlocked and palms facing the ceiling, legs straight and together, not balancing on one leg',
 'vrikshasana': 'Vrikshasana Tree pose, one man alone standing on the left leg, right foot sole pressed against the inner left thigh, palms joined in namaste above the head',
 'trikonasana': 'Triangle pose, legs wide, bending sideways to the right with the right hand on the shin and the left arm straight up, looking at the upper hand',
 'surya-namaskar': 'Surya Namaskar sun salutation, standing in Hasta Uttanasana with both arms raised overhead and the upper body arched slightly back, facing a sunlit window',
 'vajrasana': 'Vajrasana, kneeling and sitting back on the heels, spine straight, hands resting on the thighs, eyes closed',
 'bhujangasana': 'Cobra pose, lying on the stomach with the chest lifted, elbows bent and close to the body, navel on the mat',
 'balasana': "Child's pose, kneeling folded forward with the forehead on the mat and arms stretched ahead",
 'marjariasana': 'Cat pose on hands and knees, back rounded upward, chin tucked',
 'adho-mukha': 'Downward dog, hands and feet on the mat, hips lifted high into an inverted V, head between the arms',
 'setu-bandhasana': 'Bridge pose, lying on the back with knees bent and hips lifted, feet flat, arms along the mat',
 'pawanmuktasana': 'Wind-relieving pose, lying on the back hugging both knees to the chest with the arms',
 'paschimottanasana': 'Seated forward bend, legs straight, folding forward from the hips holding the feet, back long',
 'ardha-matsyendrasana': 'seated spinal twist yoga pose, sitting on the mat with both buttocks on the floor, left leg folded flat, right knee pointing up with the right foot flat beside the left knee, torso rotated to look back over the right shoulder, left arm wrapped around the raised right knee, right palm on the mat behind the hips, view from the back-right so the twist is visible',
 'naukasana': 'Naukasana boat pose, balancing on the buttocks with the straight legs raised at 45 degrees and the upper body also raised at 45 degrees so the body forms a V shape, arms straight forward parallel to the floor toward the knees, side view',
 'shalabhasana': 'Locust pose, lying on the stomach with both straight legs lifted off the mat, chin down, arms beside the body',
 'utkatasana': 'Chair pose, standing with knees bent as if sitting on a chair, arms raised straight overhead, chest up',
 'anulom-vilom': 'seated cross-legged doing alternate-nostril breathing, right thumb closing the right nostril, eyes closed, spine tall, front three-quarter view',
 'bhramari': 'seated cross-legged doing Bhramari breathing, index fingers gently on the ear flaps, eyes closed, calm, front view',
 'kapalbhati': 'one man alone seated cross-legged in Kapalbhati breathing, hands resting on the knees, spine tall, eyes closed, belly drawn in sharply, side view, nobody else in the room',
 'shavasana': 'Shavasana, lying flat on the back fully relaxed, legs slightly apart, arms away from the body with palms up, eyes closed, view from slightly above',
}
out = 'assets/yoga'; done = 0
for aid, desc in D.items():
    path = f'{out}/{aid}.webp'
    if os.path.exists(path): continue
    prompt = f'{SCENE}, {desc}'
    for attempt in range(2):
        try:
            res = subprocess.run(['higgsfield', 'generate', 'create', 'z_image', '--prompt', prompt, '--aspect_ratio', '4:3', '--wait', '--json'], capture_output=True, text=True, timeout=600)
            urls = re.findall(r'https://[^"\s]+\.(?:png|jpg|jpeg|webp)[^"\s]*', res.stdout)
            if not urls: raise RuntimeError(res.stdout[-300:] + res.stderr[-300:])
            tmp = f'/tmp/sobat-yoga-{aid}'
            urllib.request.urlretrieve(urls[0], tmp)
            im = Image.open(tmp).convert('RGB')
            w, h = im.size; tw = int(h * 4 / 3)
            if w > tw: l = (w - tw) // 2; im = im.crop((l, 0, l + tw, h))
            im.resize((384, 288), Image.LANCZOS).save(path, 'WEBP', quality=80, method=6)
            done += 1; print('ok', aid, flush=True); break
        except Exception as e:
            print('retry' if attempt == 0 else 'FAILED', aid, str(e)[:160], flush=True)
ids = sorted(f[:-5] for f in os.listdir(out) if f.endswith('.webp'))
lines = ["import type { ImageSourcePropType } from 'react-native';", '', '/** Generated by scripts/yoga-images.py. One instructional photo per asana. */', 'export const YOGA_IMAGES: Record<string, ImageSourcePropType> = {']
lines += [f"  '{i}': require('../../assets/yoga/{i}.webp')," for i in ids]
lines += ['};', '']
open('src/data/yogaImages.ts', 'w').write('\n'.join(lines))
print(f'wrote {len(ids)} images (new: {done})')
