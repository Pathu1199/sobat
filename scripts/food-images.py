"""Generates a small photo thumbnail per food with the Higgsfield CLI (z_image),
and writes src/data/foodImages.ts. Run: python3 scripts/food-images.py
Skips ids that already have assets/food/<id>.webp, so it can be re-run."""
import json, os, re, subprocess, sys, urllib.request
from PIL import Image

BOWL = "Served in a small plain white steel bowl on a dark slate background, soft natural light, top-down, centered, square, no text, no hands, no cutlery."
PLATE = "Served on a plain white plate on a dark slate background, soft natural light, top-down, centered, square, no text, no hands."
GLASS = "In a plain clear glass on a dark slate background, soft natural light, 45-degree view, centered, square, no text, no hands."

D = {
 'steamed-rice': ("plain steamed white rice, fluffy", BOWL), 'chapati': ("two soft round Indian chapati, lightly browned, folded", PLATE),
 'phulka': ("two thin puffed phulka rotis with light char spots", PLATE), 'jowar-bhakri': ("two rustic jowar bhakri, pale grey-white millet flatbreads, hand-patted", PLATE),
 'bajra-bhakri': ("two bajra bhakri, dark grey pearl millet flatbreads, hand-patted", PLATE), 'idli': ("three white steamed idli", PLATE),
 'upma': ("semolina upma, pale yellow with mustard seeds, curry leaves, peas", BOWL), 'poha': ("Maharashtrian kanda poha, turmeric-yellow flattened rice with onion, peanuts, curry leaves, coriander and lemon", BOWL),
 'dal-tadka': ("yellow dal tadka with a tempering of cumin, garlic and red chilli on top", BOWL), 'dal-makhani': ("dark creamy dal makhani with a swirl of cream", BOWL),
 'rajma': ("rajma, red kidney beans in thick brown gravy", BOWL), 'chole': ("chole, chickpeas in dark spiced gravy with onion rings", BOWL), 'sambar': ("sambar, thin lentil-vegetable stew with drumstick and tomato", BOWL),
 'matki-usal': ("matki usal, sprouted moth beans in thin red Maharashtrian gravy with coriander", BOWL), 'dalimbi-usal': ("dalimbi usal, val beans in brown coconut gravy", BOWL),
 'moong-usal': ("moong usal, sprouted green gram cooked dry with turmeric and coconut", BOWL), 'amti': ("Maharashtrian amti, thin tangy toor dal with goda masala and tamarind", BOWL),
 'varan': ("varan, plain yellow toor dal, soft and mild, with a dot of ghee", BOWL), 'akha-masoor-usal': ("akha masoor usal, whole brown lentils in red gravy", BOWL),
 'sprouts-boiled': ("boiled mixed sprouts, moong and matki, lightly steamed", BOWL), 'paneer-bhurji': ("paneer bhurji, crumbled paneer with onion, tomato, turmeric", BOWL),
 'palak-paneer': ("palak paneer, green spinach gravy with paneer cubes", BOWL), 'mixed-veg': ("mixed vegetable bhaji, carrot, beans, peas and cauliflower, dry", BOWL),
 'aloo-gobi': ("flower batata bhaji, dry cauliflower florets and potato cubes with turmeric and coriander", BOWL), 'bhindi-masala': ("bhindi masala, okra pieces in onion-tomato masala", BOWL),
 'baingan-bharta': ("vangyache bharit, mashed roasted aubergine with onion and coriander, grey-green", BOWL), 'dum-aloo': ("dum aloo, baby potatoes in red gravy", BOWL),
 'matar-paneer': ("matar paneer, peas and paneer cubes in tomato gravy", BOWL), 'kadai-paneer': ("kadai paneer, paneer with capsicum in thick red masala", BOWL),
 'malai-kofta': ("malai kofta, two koftas in creamy orange gravy", BOWL), 'veg-kofta-curry': ("vegetable kofta curry, koftas in brown gravy", BOWL), 'paneer-tikka': ("paneer tikka, charred paneer cubes with capsicum and onion", PLATE),
 'thecha': ("green chilli thecha, coarse crushed green chillies, garlic and peanuts, small portion", BOWL), 'zunka': ("zunka, dry crumbly gram-flour with onion and green chilli, yellow", BOWL),
 'pithla': ("pithla, soft yellow gram-flour curry, semi-liquid", BOWL), 'batata-bhaji': ("batatyachi bhaji, dry turmeric potato pieces with mustard seeds and curry leaves", BOWL),
 'bharli-vangi': ("bharli vangi, small stuffed aubergines in peanut-coconut masala gravy", BOWL), 'methi-bhaji': ("methichi bhaji, dry fenugreek leaves with garlic", BOWL),
 'palak-bhaji': ("palakachi bhaji, chopped spinach cooked dry with garlic and dal", BOWL), 'toned-milk': ("plain white milk", GLASS), 'curd': ("thick white curd, set, spoon mark", BOWL),
 'chai-without-sugar': ("Indian milk tea in a small glass cup", GLASS), 'taak': ("taak, thin spiced buttermilk with coriander and cumin on top", GLASS),
 'buttermilk-masala': ("masala chaas, buttermilk with green chilli, coriander and roasted cumin", GLASS), 'banana': ("one ripe yellow banana", PLATE), 'apple': ("one red apple, whole", PLATE),
 'papaya': ("cubed ripe orange papaya", BOWL), 'roasted-chana': ("roasted chana, brown roasted chickpeas", BOWL), 'murmura-bhel': ("murmura bhel, puffed rice with onion, tomato, coriander, lemon, roasted chana, no sev", BOWL),
 'sprouts-chaat': ("sprouts chaat, mixed sprouts with onion, tomato, coriander, lemon", BOWL), 'oats-porridge': ("oats porridge, creamy, with a few almonds", BOWL), 'dalia': ("dalia, broken wheat porridge with vegetables", BOWL),
 'khichdi': ("moong dal khichdi, soft yellow rice and lentils with ghee", BOWL), 'almonds': ("a handful of almonds", BOWL), 'dudhi-bhaji': ("dudhi bhopla bhaji, pale green bottle gourd cubes cooked dry with moong dal", BOWL),
 'cabbage-matar-bhaji': ("kobi matar bhaji, shredded cabbage with green peas, dry, turmeric", BOWL), 'tomato-kanda-bhaji': ("tomato kanda patal bhaji, thin red onion-tomato curry", BOWL),
 'bhindi-bhaji': ("sukhi bhendi, dry okra slices, low oil, lightly crisp", BOWL), 'shepu-bhaji': ("shepu bhaji, chopped dill leaves cooked dry with moong dal and crushed peanuts", BOWL),
 'moong-dal': ("plain yellow moong dal, thin", BOWL), 'masoor-dal': ("plain cooked red masoor dal, orange-yellow", BOWL), 'walnuts': ("a handful of walnut halves", BOWL),
 'black-tea': ("black tea without milk, dark amber", GLASS), 'flower-rassa': ("flower rassa, cauliflower florets in thin red Maharashtrian gravy", BOWL),
 'vangi-batata': ("vangi batata bhaji, dry aubergine and potato pieces with kala masala, dark", BOWL), 'kanda-batata-rassa': ("kanda batata rassa, potato pieces in thin red onion gravy", BOWL),
 'methi-batata': ("methi batata bhaji, fenugreek leaves and potato cubes, dry", BOWL), 'farasbi-bhaji': ("farasbi bhaji, chopped French beans cooked dry with coconut", BOWL),
 'gavar-bhaji': ("gavar bhaji, cluster beans cooked dry with peanut powder", BOWL), 'dodka-bhaji': ("dodka bhaji, ridge gourd pieces cooked soft with moong dal, light green", BOWL),
 'padwal-bhaji': ("padwal bhaji, snake gourd rings cooked dry with coconut", BOWL), 'karle-bhaji': ("karle bhaji, bitter gourd slices fried dry with onion and jaggery, brownish", BOWL),
 'tondli-bhaji': ("tondli bhaji, ivy gourd slices cooked dry with peanut powder", BOWL), 'vatana-usal': ("vatana usal, green peas in thin spiced gravy with coriander", BOWL),
 'pavta-bhaji': ("pavta bhaji, pale lima beans in light gravy", BOWL), 'chavli-usal': ("chavli usal, black-eyed beans in brown gravy", BOWL), 'shevga-amti': ("shevga amti, dal with drumstick pieces", BOWL),
 'aluchi-patal-bhaji': ("aluchi patal bhaji, dark green thick colocasia-leaf curry with peanuts and chana", BOWL), 'batata-rassa-pivla': ("pivla batata rassa, yellow turmeric potato curry, thin, puri-bhaji style", BOWL),
}

out_dir = 'assets/food'
done = 0
for fid, (desc, scene) in D.items():
    path = f'{out_dir}/{fid}.webp'
    if os.path.exists(path):
        continue
    prompt = f"Top-down food photo of {desc}. {scene}"
    for attempt in range(2):
        try:
            res = subprocess.run(['higgsfield', 'generate', 'create', 'z_image', '--prompt', prompt, '--aspect_ratio', '1:1', '--wait', '--json'], capture_output=True, text=True, timeout=600)
            urls = re.findall(r'https://[^"\s]+\.(?:png|jpg|jpeg|webp)[^"\s]*', res.stdout)
            if not urls:
                raise RuntimeError(res.stdout[-300:] + res.stderr[-300:])
            tmp = f'/tmp/sobat-food-{fid}'
            urllib.request.urlretrieve(urls[0], tmp)
            im = Image.open(tmp).convert('RGB')
            # Tight square crop of the middle, then a small thumbnail: ~6 KB each.
            w, h = im.size; s = int(min(w, h) * 0.86); l = (w - s) // 2; t = (h - s) // 2
            im.crop((l, t, l + s, t + s)).resize((192, 192), Image.LANCZOS).save(path, 'WEBP', quality=78, method=6)
            done += 1
            print('ok', fid, flush=True)
            break
        except Exception as e:
            print('retry' if attempt == 0 else 'FAILED', fid, str(e)[:160], flush=True)

ids = sorted(f[:-5] for f in os.listdir(out_dir) if f.endswith('.webp'))
lines = ["import type { ImageSourcePropType } from 'react-native';", '', '/** Generated by scripts/food-images.py. Small photo per food; foods not listed fall back to a pictogram. */', 'export const FOOD_IMAGES: Record<string, ImageSourcePropType> = {']
lines += [f"  '{i}': require('../../assets/food/{i}.webp')," for i in ids]
lines += ['};', '']
open('src/data/foodImages.ts', 'w').write('\n'.join(lines))
print(f'wrote {len(ids)} images into src/data/foodImages.ts (new this run: {done})')
