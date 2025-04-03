// --- Required Modules ---
import http from 'http'; // Use Node's built-in HTTP server
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises'; // Use promises for async file operations
import { existsSync, mkdirSync } from 'fs'; // Sync for initial check/create
import { exec } from 'child_process'; // To run the screenshot command

// --- Basic Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3001; // Port for GSI to send data to
let previousGameState = null; // Track previous state for transition detection

// --- Screenshot Configuration ---
const screenshotsDir = path.join(__dirname, 'screenshots');
const staticFilename = 'strategy_time_screenshot.png'; // The static name for the screenshot
const screenshotFilePath = path.join(screenshotsDir, staticFilename);
const escapedScreenshotFilePath = screenshotFilePath.replace(/\\/g, '\\\\'); // For PowerShell command

// Ensure screenshot directory exists (Sync is OK here on startup)
try {
    if (!existsSync(screenshotsDir)) {
        mkdirSync(screenshotsDir, { recursive: true });
        console.log(`Created screenshot directory: ${screenshotsDir}`);
    }
} catch (err) {
    console.error("Error creating screenshot directory:", err);
    // Exit if we can't create the essential directory
    process.exit(1);
}

// --- Create Minimal HTTP Server for GSI POST Requests ---
const server = http.createServer(async (req, res) => { // Make request listener async
    // We only care about POST requests to the root path specified in GSI config
    if (req.method === 'POST' && req.url === '/') {
        let body = '';
        // Collect data chunks as they arrive
        req.on('data', chunk => {
            body += chunk.toString();
        });

        // Process the full body when the request ends
        req.on('end', async () => { // Make this specific handler async too
            try {
                const currentGsiState = JSON.parse(body); // Parse the JSON data from Dota 2
                const currentGameState = currentGsiState.map?.game_state;

                // --- Check for Transition into Strategy Time ---
                if (currentGameState === "DOTA_GAMERULES_STATE_STRATEGY_TIME" && previousGameState !== "DOTA_GAMERULES_STATE_STRATEGY_TIME") {
                    console.log(`*** State changed to STRATEGY_TIME - Preparing screenshot... ***`);

                    // --- Delete Existing PNGs First ---
                    try {
                        console.log(`Attempting to delete existing PNGs in ${screenshotsDir}...`);
                        const files = await fs.readdir(screenshotsDir);
                        const pngFiles = files.filter(file => path.extname(file).toLowerCase() === '.png');

                        if (pngFiles.length > 0) {
                            const deletionPromises = pngFiles.map(file =>
                                fs.unlink(path.join(screenshotsDir, file)).catch(err => {
                                    console.error(`Failed to delete ${file}: ${err.message}`);
                                    // Continue even if one deletion fails
                                })
                            );
                            await Promise.all(deletionPromises);
                            console.log(`Finished attempting to delete ${pngFiles.length} PNG file(s).`);
                        } else {
                            console.log('No existing PNG files found to delete.');
                        }
                    } catch (err) {
                        console.error(`Error reading/deleting files in screenshots directory: ${err.message}`);
                    }
                    // --- End Delete Existing PNGs ---

                    // --- Take Screenshot ---
                    console.log(`*** Triggering Screenshot! Saving to ${screenshotFilePath} ***`);
                    // ** Windows PowerShell Command ** (Keep the one for your OS)
                    const command = `powershell -Command "Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Windows.Forms; $ScreenBounds = [System.Windows.Forms.SystemInformation]::VirtualScreen; $Bitmap = New-Object System.Drawing.Bitmap $ScreenBounds.Width, $ScreenBounds.Height; $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap); $Graphics.CopyFromScreen($ScreenBounds.Location, [System.Drawing.Point]::Empty, $ScreenBounds.Size); try { $Bitmap.Save('${escapedScreenshotFilePath}', [System.Drawing.Imaging.ImageFormat]::Png) } finally { $Graphics.Dispose(); $Bitmap.Dispose() }"`
                    // ** macOS Command **
                    // const command = `screencapture "${screenshotFilePath}"`;
                    // ** Linux Command **
                    // const command = `scrot -o "${screenshotFilePath}"`;

                    exec(command, (error, stdout, stderr) => {
                         if (error) { console.error(`Screenshot execution error: ${error.message}`); if (stderr) { console.error(`Screenshot stderr: ${stderr}`); } return; }
                         if (stderr && stderr.trim() !== "" && !stderr.includes("parameter is incorrect")) { console.warn(`Screenshot stderr: ${stderr}`); }
                         // Check file existence
                         fs.access(screenshotFilePath).then(() => console.log(`Screenshot saved successfully: ${screenshotFilePath}`)).catch(() => console.error(`Screenshot command finished, but file not found at: ${screenshotFilePath}.`));
                    });
                    // --- End Take Screenshot ---
                }

                // Update previous state for the *next* comparison
                previousGameState = currentGameState;

                // Send success response to Dota 2 client
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('OK');

            } catch (parseError) {
                console.error('Error parsing GSI JSON:', parseError);
                res.writeHead(400, { 'Content-Type': 'text/plain' }); // Bad Request
                res.end('Error parsing JSON');
            }
        });
    } else {
        // Ignore other requests (like browser trying to GET '/')
        res.writeHead(404); // Not Found
        res.end();
    }
});

// --- Start the Server ---
server.listen(PORT, '127.0.0.1', () => {
    console.log(`[GSI Screenshot Server] Listening for GSI POST requests on http://127.0.0.1:${PORT}`);
    console.log(`Will trigger screenshot on transition to STRATEGY_TIME.`);
});

// Basic server error handling
server.on('error', (err) => {
    console.error('[GSI Screenshot Server] Server error:', err);
});