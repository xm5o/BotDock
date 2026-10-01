# Getting started with BotDock

This guide shows how to install BotDock and add your first bot.

## Option 1: Use the Windows release

1. Open the GitHub Releases page.
2. Download the installer or portable `.exe` file.
3. Open BotDock.
4. If Windows SmartScreen appears, check that the file came from the official repository before you continue.

## Option 2: Run the source code

Install Node.js 20 or newer, then run:

```bash
git clone https://github.com/xm5o/BotDock.git
cd BotDock
npm install
npm start
```

## Add a Node.js Discord bot

1. Press `Add project`.
2. Pick the folder that contains your `package.json`.
3. BotDock checks the project and tries to find a start command.
4. If your `package.json` has a `start` script, BotDock uses `npm start`.
5. Press `Add project`.
6. Press `Start`.

## Add a Python bot

BotDock looks for these common files:

```text
main.py
bot.py
app.py
```

If one is found, the default command is `python <file>` on Windows.

## Use a custom command

Open the Settings tab and enter the command you normally use in a terminal.

Examples:

```text
node src/index.js
npm run bot
python main.py
```

Press `Save settings`, then start the project again.

## Install dependencies

BotDock detects common install commands.

For Node.js:

```text
npm install
```

For Python projects with `requirements.txt`:

```text
python -m pip install -r requirements.txt
```

Press `Install dependencies` to run the saved command and read the output in the Console tab.

## Read logs

The Console tab shows standard output and errors from the running project.

Use `Copy` to copy the current log view. Use `Clear` to clear only the BotDock view. It does not change your project files.

## Automatic restart

1. Open Settings.
2. Enable `Restart this project after a crash`.
3. Save the settings.

If the process crashes, BotDock starts it again after two seconds.

## Edit .env

1. Open the `.env` tab.
2. Edit the file.
3. Press `Save .env`.
4. Restart your bot if it needs to reload the values.

Never share screenshots that show private tokens or API keys.

## Where BotDock stores its own settings

BotDock stores the project list in Electron's normal user data folder. It does not copy your bot source files into BotDock.

## Troubleshooting

### The bot does not start

Check the start command in Settings. Run the same command in a normal terminal inside the bot folder. If it fails there too, fix the project first.

### npm is not found

Install Node.js and make sure `node` and `npm` are available in a new terminal window.

### python is not found

Install Python and enable the option that adds Python to PATH.

### The app shows high memory use

The memory number belongs to the bot process, not to the full BotDock app.
