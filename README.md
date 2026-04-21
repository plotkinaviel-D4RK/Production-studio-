# Production Studio

This workspace currently vendors the OpenToonz source code for local exploration
and possible integration work.

## Local Prototype Site

- Source: `./studio-site`
- Run: `npm run dev`
- Open: http://localhost:5173

The prototype is a dependency-free browser app for testing a 2D scene creator
workflow. It currently supports canvas layers, object dragging, a frame timeline,
basic keyframes, playback, JSON export, JSON import, and local prompt-to-scene
generation.

The site also includes a Three.js-based 3D battle lab. It serves Three.js from
local `node_modules` and supports importing local `.glb` creature models, which
is the easiest path for testing Quaternius assets in the browser.

Good Quaternius packs for this direction:

- Cute Animated Monsters Pack: https://quaternius.com/packs/cutemonsters.html
- Ultimate Monsters: https://quaternius.com/packs/ultimatemonsters.html
- Ultimate Platformer Pack: https://quaternius.itch.io/ultimate-platformer-pack
- Stylized Nature MegaKit: https://quaternius.com/

### Modular Character Outfits

The downloaded `Modular Character Outfits - Fantasy[Standard]` glTF outfits are
copied into:

```text
studio-site/assets/modular-character-outfits/Outfits
```

The 3D Battle Lab now shows an `Outfit Asset Library` with:

- Male Ranger
- Female Ranger
- Male Peasant
- Female Peasant

Click `Left` or `Right` on an outfit card to place that 3D character into the
battle scene.

### Man Hunt Character Generator Bridge

This prototype can also call the sibling `../Man Hunt` app's character
generator. In the 3D Battle Lab:

1. Create a PNG in `PNG Character Maker`, or upload a PNG with
   `Upload Character PNG`.
2. Click `Place PNG Left` or `Place PNG Right` to use the PNG immediately as a
   flat 2D billboard fighter.
3. Click `Generate Left` or `Generate Right` to send the PNG into Man Hunt's 3D
   generator.
4. The backend writes the PNG to Man Hunt's expected source path, runs
   `../Man Hunt/tools/generate_profile_model.py`, serves the generated
   `profile-character.glb`, and loads it into the chosen fighter slot.

The generator depends on Man Hunt's Hunyuan3D Python environment being installed
and runnable with `python3`. Override the Python command with `MANHUNT_PYTHON`
if needed:

```sh
MANHUNT_PYTHON="/path/to/python" npm run dev
```

### AI Scene Generation

Set an OpenAI API key before starting the server to enable AI prompt generation:

```sh
export OPENAI_API_KEY="your_api_key_here"
npm run dev
```

Optionally choose a different model:

```sh
export OPENAI_MODEL="gpt-5.2"
```

If `OPENAI_API_KEY` is not set, the site automatically uses the local prompt
parser instead.

## OpenToonz

- Source: `./opentoonz`
- Upstream: https://github.com/opentoonz/opentoonz
- Imported as a shallow clone from the upstream `master` branch.
- Current imported commit: `c87207c`

OpenToonz is a full open-source 2D animation application. The main code is in
`opentoonz/toonz`, with documentation in `opentoonz/doc`.

## Useful Links

- Build on macOS: `opentoonz/doc/how_to_build_macosx.md`
- Main README: `opentoonz/README.md`
- Releases: https://github.com/opentoonz/opentoonz/releases
- Official download page: https://opentoonz.github.io/e/index.html

## macOS Build Notes

The upstream macOS build guide requires Xcode, Homebrew, CMake, Qt 5, Boost, and
several native dependencies. The first dependency command from upstream is:

```sh
brew install glew lz4 libjpeg libpng lzo pkg-config libusb cmake git-lfs libmypaint qt@5 boost jpeg-turbo opencv
```

After dependencies are available, the upstream flow builds from
`opentoonz/toonz/build` using CMake against `opentoonz/toonz/sources`.

```sh
cd opentoonz/toonz
mkdir -p build
cd build
export PKG_CONFIG_PATH="/opt/homebrew/opt/jpeg-turbo/lib/pkgconfig:$PKG_CONFIG_PATH"
cmake ../sources -DQT_PATH="/opt/homebrew/opt/qt@5/lib"
make
```

For day-to-day animation work, installing the official app build is usually much
faster than compiling from source. Use the source folder when you want to modify
OpenToonz itself or build custom tooling around it.
