// Keep imports (express, http, socket.io, path, url)
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
// Use fs.promises for async operations
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs'; // Keep sync for initial check/create
import { exec } from 'child_process'; // Import exec function

// Keep __filename, __dirname calculations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep app, server, io setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3001;
let currentGsiState = {};
let previousGameState = null;

// --- Screenshot Folder ---
const screenshotsDir = path.join(__dirname, 'screenshots');
// Create the directory if it doesn't exist (using sync here is okay on startup)
try {
    if (!existsSync(screenshotsDir)) {
        mkdirSync(screenshotsDir, { recursive: true });
        console.log(`Created screenshot directory: ${screenshotsDir}`);
    }
} catch (err) {
    console.error("Error creating screenshot directory:", err);
}
// ---

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'overlay.html'));
});

// !!! Make the callback async to use await for file operations !!!
app.post('/', async (req, res) => { // <<< Added async keyword
  try {
    currentGsiState = req.body;
    let currentGameState = currentGsiState.map ? currentGsiState.map.game_state : null;

    // --- Check for Transition into Strategy Time ---
    if (currentGameState === "DOTA_GAMERULES_STATE_STRATEGY_TIME" && previousGameState !== "DOTA_GAMERULES_STATE_STRATEGY_TIME") {
        console.log(`*** State changed to STRATEGY_TIME - Preparing screenshot... ***`);

        const staticFilename = 'strategy_time_screenshot.png';
        const filename = path.join(screenshotsDir, staticFilename);
        const escapedFilename = filename.replace(/\\/g, '\\\\');

        // --- Delete Existing PNGs First ---
        try {
            console.log(`Attempting to delete existing PNGs in ${screenshotsDir}...`);
            const files = await fs.readdir(screenshotsDir); // Read directory contents
            const pngFiles = files.filter(file => path.extname(file).toLowerCase() === '.png'); // Filter for .png files

            if (pngFiles.length > 0) {
                const deletionPromises = pngFiles.map(file =>
                    fs.unlink(path.join(screenshotsDir, file)).catch(err => { // Add catch to each unlink
                         console.error(`Failed to delete ${file}: ${err.message}`);
                         // Don't let one failed deletion stop others or the screenshot
                    })
                );
                await Promise.all(deletionPromises); // Wait for all deletions to attempt
                console.log(`Finished attempting to delete ${pngFiles.length} PNG file(s).`);
            } else {
                console.log('No existing PNG files found to delete.');
            }

        } catch (err) {
            console.error(`Error reading/deleting files in screenshots directory: ${err.message}`);
            // Decide if you still want to attempt screenshot even if deletion failed
        }
        // --- End Delete Existing PNGs ---

        // --- Take Screenshot ---
        console.log(`*** Triggering Screenshot! Saving to ${filename} ***`);
        const command = `powershell -Command "Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $ScreenBounds = [System.Windows.Forms.SystemInformation]::VirtualScreen; $Bitmap = New-Object System.Drawing.Bitmap $ScreenBounds.Width, $ScreenBounds.Height; $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap); $Graphics.CopyFromScreen($ScreenBounds.Location, [System.Drawing.Point]::Empty, $ScreenBounds.Size); try { $Bitmap.Save('${escapedFilename}', [System.Drawing.Imaging.ImageFormat]::Png) } finally { $Graphics.Dispose(); $Bitmap.Dispose() }"` // Added try/finally for dispose

        exec(command, (error, stdout, stderr) => {
            // Keep error handling the same...
            if (error) {
                console.error(`Screenshot execution error: ${error.message}`);
                if (stderr) { console.error(`Screenshot stderr: ${stderr}`); }
                return;
            }
             // Log stderr cautiously, PowerShell often writes non-errors here
            if (stderr && stderr.trim() !== "" && !stderr.includes("parameter is incorrect")) {
                console.warn(`Screenshot stderr: ${stderr}`);
            }
            // Check if file actually exists after command execution
            fs.access(filename).then(() => {
                 console.log(`Screenshot saved successfully: ${filename}`);
            }).catch(() => {
                 console.error(`Screenshot command finished, but file not found at: ${filename}. Check command/permissions.`);
            });
            // io.emit('screenshot_taken', { file: staticFilename });
        });
        // --- End Take Screenshot ---

    } else if (currentGameState === "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS") {
        const relevantData = extractRelevantInfo(currentGsiState);
        if (relevantData) {
            io.emit('gsi_update', relevantData);
        }
    }
    // --- End Check State ---

    // Update previous state for next check
    previousGameState = currentGameState;
    res.status(200).send('OK');

  } catch (error) {
    console.error("Error processing GSI data:", error);
    res.status(500).send('Error processing data');
  }
});

// Keep the rest of the code (WebSocket, extractRelevantInfo, static serves, listen)
function extractRelevantInfo(gsiData) { /* ... */ return null; }
app.use('/ability_icons', express.static(path.join(__dirname, 'ability_icons')));
// ...
server.listen(PORT, '127.0.0.1', () => { /* ... */ });