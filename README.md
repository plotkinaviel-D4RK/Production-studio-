# Production Studio

Local browser prototype for building 2D scenes and 3D creature-battle scenes.

## What Is Included In This Repo

- Local Node server: `server.js`
- 2D scene creator: `studio-site/app.js`
- 3D Battle Lab: `studio-site/three-battle.js`
- Character Studio for PNG fighters
- Modular Character Outfits glTF assets
- Three.js dependency in `package.json`
- Setup notes for optional OpenToonz and Man Hunt/Hunyuan3D integrations

## What Is Not Included

- `node_modules/` is not pushed. Recreate it with `npm install`.
- `opentoonz/` is not pushed because it is a large separate upstream repo.
- Man Hunt/Hunyuan3D is not pushed because it is a separate sibling app and was
  not fully installed locally.
- Secrets like `OPENAI_API_KEY` are not pushed.

## Fresh Computer Setup

Clone the repo:

```sh
git clone git@github.com:plotkinaviel-D4RK/Production-studio-.git
cd Production-studio-
```

If SSH is not set up on that computer, use HTTPS:

```sh
git clone https://github.com/plotkinaviel-D4RK/Production-studio-.git
cd Production-studio-
```

Install dependencies:

```sh
npm install
```

Run the local site:

```sh
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Main Workflow

1. Open the 3D Battle Lab.
2. Use `Scene Setup` to create or randomize an arena.
3. Use `Character Studio` to make PNG character cards.
4. Use `Saved Characters` to place PNG fighters into left/right slots.
5. Use `Outfit Asset Library` to place real 3D outfit models into left/right slots.
6. Use `Start Fight Animation` to make the assigned fighters move.

## Modular Character Outfits

The downloaded `Modular Character Outfits - Fantasy[Standard]` glTF outfits are
included in this repo here:

```text
studio-site/assets/modular-character-outfits/Outfits
```

Available in the site:

- Male Ranger
- Female Ranger
- Male Peasant
- Female Peasant

Click `Left` or `Right` on an outfit card to place that 3D character into the
battle scene.

## AI Scene Generation

The site works without an OpenAI key by using local fallback prompt logic.

To enable OpenAI-backed scene generation:

```sh
export OPENAI_API_KEY="your_api_key_here"
npm run dev
```

Optionally choose a model:

```sh
export OPENAI_MODEL="gpt-5.2"
```

## Optional: Restore OpenToonz Locally

OpenToonz was used as reference, but it is not committed to this repo.

To restore it on another computer:

```sh
git clone --depth 1 https://github.com/opentoonz/opentoonz.git opentoonz
```

OpenToonz official install page:

```text
https://opentoonz.github.io/e/index.html
```

OpenToonz macOS build dependencies from upstream:

```sh
brew install glew lz4 libjpeg libpng lzo pkg-config libusb cmake git-lfs libmypaint qt@5 boost jpeg-turbo opencv
```

For day-to-day animation work, installing the official app build is usually much
faster than compiling from source.

## Optional: Man Hunt/Hunyuan3D Generator

The `Generate 3D From PNG` buttons are a bridge to a sibling app expected at:

```text
../Man Hunt
```

The bridge expects this script:

```text
../Man Hunt/tools/generate_profile_model.py
```

That generator must have Hunyuan3D installed here:

```text
../Man Hunt/tools/Hunyuan3D-2
```

It also needs Python dependencies such as Pillow and the Hunyuan3D packages.
On this machine, the generator was not ready and failed with:

```text
No module named 'PIL'
```

Until that setup exists, use the working options:

- PNG fighters from Character Studio
- Imported `.glb` files
- Included Modular Character Outfits

If the Python executable is not `python3`, run with:

```sh
MANHUNT_PYTHON="/path/to/python" npm run dev
```

## Useful Commands

Check git state:

```sh
git status
```

Pull latest changes:

```sh
git pull
```

Run the site:

```sh
npm run dev
```
