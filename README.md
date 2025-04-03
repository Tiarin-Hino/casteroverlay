# Dota 2 GSI Strategy Time Screenshotter

A simple Node.js application using Dota 2's Game State Integration (GSI) to automatically capture a full-screen screenshot when the game enters the Strategy Time phase.

## Features

* Listens locally for Dota 2 GSI data via HTTP POST requests.
* Detects the transition from any state into Strategy Time (`DOTA_GAMERULES_STATE_STRATEGY_TIME`).
* Automatically attempts to delete any existing `.png` files within the `/screenshots` folder upon trigger.
* Executes an OS-specific command to take a full-screen screenshot.
* Saves the new screenshot as `screenshots/strategy_time_screenshot.png`, overwriting any previous file with that name.

## Requirements

* [Node.js](https://nodejs.org/) (e.g., v18+ / v22+)
* npm (comes bundled with Node.js)
* Dota 2 installed
* **OS-Specific Screenshot Capability:** The script relies on executing an external command-line tool to capture the screen.
    * **Windows:** Uses a built-in PowerShell command (requires appropriate .NET assemblies, usually present).
    * **macOS/Linux:** Requires modification of the command in `server.js` and potentially installing tools (e.g., `scrot` for Linux).

## Setup & Installation

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <project-folder-name>
    ```
2.  **Install Dependencies (Minimal):**
    * While this script has no external `npm` dependencies currently, running `npm install` is good practice in case any are added later.
    ```bash
    npm install
    ```
3.  **Screenshots Folder:** A folder named `screenshots` will be created automatically in the project root directory by the server on its first run if it doesn't already exist. Ensure Node.js has write permissions in the project directory.

## Configuration

1.  **Dota 2 GSI Configuration:**
    * Navigate to your Dota 2 Game State Integration configuration folder (usually `Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\`).
    * Create a new text file named `gamestate_integration_screenshotter.cfg` (or similar ending in `.cfg`).
    * Paste the following content into the file:
        ```cfg
        "GSI Screenshotter Config"
        {
            "uri"           "[http://127.0.0.1:3001](http://127.0.0.1:3001)" // Default port, change if needed
            "timeout"       "5.0"
            // Low buffer/throttle ensures quick state change detection
            "buffer"        "0.1"
            "throttle"      "0.1"
            "heartbeat"     "30.0"
            "data"
            {
                // Only need provider and map (for game_state)
                "provider"      "1"
                "map"           "1"
                // Other flags like player, hero, abilities are not needed by this script
            }
        }
        ```
    * Verify the `uri` port (e.g., `3001`) matches the `PORT` constant defined in your `server.js`.
    * **Restart Dota 2 completely** if it was running while you created or modified this file.

2.  **Screenshot Command (If NOT on Windows):**
    * Open the `server.js` file.
    * Find the section marked `// --- Take Screenshot ---`.
    * Locate the line defining the `command` variable for Windows PowerShell.
    * Comment out the Windows `const command = ...` line (add `//` at the start).
    * Uncomment the line corresponding to your Operating System:
        * **macOS:** `// const command = \`screencapture "${screenshotFilePath}"\`;` -> `const command = \`screencapture "${screenshotFilePath}"\`;`
        * **Linux:** `// const command = \`scrot -o "${screenshotFilePath}"\`;` -> `const command = \`scrot -o "${screenshotFilePath}"\`;` (Requires the `scrot` utility: `sudo apt install scrot` or your distro's equivalent).
    * Save the `server.js` file.

## Usage

1.  **Start the Server:**
    * Open your terminal/command prompt.
    * Navigate to the project's root directory.
    * Run: `node server.js` (or `node server.cjs` if applicable).
    * The console will show it's listening for GSI requests.
2.  **Launch Dota 2:** Play a game mode that includes a Strategy Time phase (like Ability Draft, All Pick, etc.).
3.  **Screenshot Trigger:** When the game transitions from the drafting/hero selection phase *into* Strategy Time, the server console should log a message indicating it's triggering the screenshot process. It will attempt to delete old PNGs and save the new `screenshots/strategy_time_screenshot.png`.
4.  **OBS Setup (or other software):**
    * Add an `Image` source to your scene.
    * Set the `Image File` path to the **full, absolute path** of the generated screenshot file (e.g., `C:\path\to\strategy_time_screenshot.png`).
    * **Optional:** Check the box for "Unload image when not showing" or similar options. This can sometimes help ensure OBS re-reads the file when it's updated, although it should generally detect file changes.
    * Use OBS's transform tools (e.g., hold Alt while dragging edges) or add filters (like Crop/Pad) to crop the displayed image source to show only the relevant part of the screenshot (e.g., the draft results grid).
    * The image displayed by this source in OBS will automatically update shortly after the script saves the new screenshot file at the start of each game's Strategy Time.

## Troubleshooting

* **Screenshot Not Taken/Updated:**
    * Check the Node.js server console output carefully when the game should be entering Strategy Time. Look for the trigger message (`*** State changed to STRATEGY_TIME... ***`) and any subsequent error messages related to file deletion (`Error reading/deleting files...`) or screenshot execution (`Screenshot execution error...`, `Screenshot stderr...`).
    * Verify the screenshot command line in `server.js` is correct for your OS and works if you try running it manually in your OS terminal.
    * Ensure Node.js has permission to write files in the project directory and execute external commands. Antivirus or security software could potentially interfere.
    * Check if the `screenshots` folder exists and is writable.
* **Server Not Receiving GSI Data:**
    * Double-check the GSI `.cfg` file path and content (especially the `uri` and port).
    * Ensure Dota 2 was fully restarted after saving the `.cfg` file.
    * Check OS firewall settings to ensure connections to `127.0.0.1` on the specified port (e.g., 3001) are allowed for Node.js.
    * Make sure no other application is already using the same port for GSI.