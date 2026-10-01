# BotDock

BotDock is a small desktop app for running Discord bots and other local background projects from one place.

It is made for people who keep several Node.js or Python bots on the same PC and do not want to open many terminal windows every time.

## Main features

- Add a bot by choosing its folder
- Detect common Node.js and Python project layouts
- Start, stop, and restart a project
- Read live console output
- See CPU, memory, uptime, and process ID
- Restart a project after a crash
- Run the dependency install command from the app
- Edit the local `.env` file when you need it
- Open the project folder quickly
- Keep project settings between app restarts

BotDock runs projects on your own computer. It does not upload your bot code, tokens, `.env` file, or logs.

## Download

The easiest way to use BotDock is the Windows build from the GitHub Releases page.

Two Windows files are built for each tagged release:

- Installer build: installs BotDock like a normal app
- Portable build: runs without installing

The release workflow is included in `.github/workflows/release.yml`.

For release steps, read [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Run from source

You need Node.js 20 or newer.

```bash
git clone https://github.com/xm5o/BotDock.git
cd BotDock
npm install
npm start
```

## Build the Windows app

```bash
npm install
npm run dist
```

The build files will be placed in `dist/`.

## Quick start

1. Open BotDock.
2. Press `Add project`.
3. Choose your bot folder.
4. Check the detected start command.
5. Add the project.
6. Press `Start`.
7. Open the Console tab to read the bot output.

For a longer guide, read [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

## Supported project types

BotDock has basic automatic detection for:

- Node.js projects with `package.json`
- Node.js projects with `index.js`
- Python projects with `main.py`, `bot.py`, or `app.py`
- Custom projects with a command you enter yourself

Examples of valid commands:

```text
npm start
node index.js
node src/index.js
python bot.py
```

## Auto restart

Open the Settings tab for a project and enable `Restart this project after a crash`.

BotDock waits two seconds, then starts the project again if it exits without you pressing Stop.

## .env editor

The `.env` tab reads and writes the `.env` file inside the selected project folder.

BotDock does not send the file anywhere. Still, treat `.env` files as private because they often contain bot tokens and API keys.

## Windows warning

The first public builds are unsigned. Windows SmartScreen might show a warning because the executable does not have a paid code signing certificate.

Always download BotDock from the official repository release page.

## Project status

BotDock is an early open source project. The first version focuses on local bot management. Remote VPS support is a possible future feature.

## License

MIT. See [LICENSE](LICENSE).
