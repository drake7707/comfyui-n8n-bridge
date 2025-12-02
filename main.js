import { ComfyUI } from "./comfyui.js";
import express from 'express';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import multer from 'multer';
import { randomUUID } from 'crypto';
dotenv.config();
const app = express();
app.use(express.json({ limit: '50mb' }));
// Multer setup
const upload = multer({
    limits: { fileSize: 1024 * 1024 * 1024 },
    dest: process.env.TEMP_UPLOAD_PATH,
});
fs.ensureDirSync(process.env.TEMP_UPLOAD_PATH);
fs.ensureDirSync(process.env.COMFYUI_INPUT_PATH);
const server = process.env.COMFYUI_HOST;
const comfyui = new ComfyUI("n8n", server);
app.put('/upload', upload.any(), async (req, res) => {
    try {
        const file = req.files[0];
        if (file) {
            const uploadDir = process.env.COMFYUI_INPUT_PATH;
            // Extract original extension
            const ext = path.extname(file.originalname); // e.g., ".mp3"
            // Generate a new filename with original extension
            const newFilename = randomUUID() + ext;
            const destPath = path.join(uploadDir, newFilename);
            await fs.move(file.path, destPath, { overwrite: false });
            console.log(`File uploaded: ${destPath}`);
            res.json({
                filename: newFilename,
                message: 'File uploaded successfully.'
            });
        }
        else {
            res.status(400).json({ error: 'No files uploaded.' });
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'File transfer error.' });
    }
});
app.delete('/upload/:filename', async (req, res) => {
    const filename = req.params.filename;
    // Reject filenames with directory traversal
    if (filename.includes('..') || path.isAbsolute(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }
    // Resolve the full path
    const uploadDir = process.env.COMFYUI_INPUT_PATH;
    const filePath = path.join(uploadDir, filename);
    try {
        // Check if file exists before deleting
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            return res.status(404).json({ error: 'File not found.' });
        }
        await fs.remove(filePath);
        console.log(`File deleted: ${filePath}`);
        res.json({ message: 'File deleted successfully.' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'File deletion error.' });
    }
});
app.delete('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    const subfolder = req.query.subfolder || '';
    const filetype = req.query.filetype || '';
    // Reject filenames with directory traversal
    if (filename.includes('..') || path.isAbsolute(filename)) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }
    let filePath;
    if (filetype === "temp") {
        // Resolve the full path
        const outputDir = process.env.COMFYUI_TEMP_PATH;
        filePath = path.join(outputDir, subfolder, filename);
    }
    else {
        // Resolve the full path
        const outputDir = process.env.COMFYUI_OUTPUT_PATH;
        filePath = path.join(outputDir, subfolder, filename);
    }
    try {
        // Check if file exists before deleting
        const exists = await fs.pathExists(filePath);
        if (!exists) {
            return res.status(404).json({ error: 'File not found.' });
        }
        await fs.remove(filePath);
        console.log(`File deleted: ${filePath}`);
        res.json({ message: 'File deleted successfully.' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'File deletion error.' });
    }
});
app.post("/queue", async (req, res) => {
    const data = req.body;
    const prompt = data.workflow;
    if (!comfyui.connected) {
        console.log("Comfyui not connected, connecting to server");
        await comfyui.connect();
    }
    let status = "";
    let progress = 0;
    let promptId = "";
    try {
        status = "Waiting";
        let handledReponse = false;
        const result = await comfyui.queue(prompt, (entry) => {
            promptId = entry.id;
            status = entry.status;
            progress = entry.progress;
            console.log(`Prompt ${promptId} - Status: ${status} - Progress: ${progress}%`);
            if (!handledReponse) {
                res.write(JSON.stringify({
                    promptId: promptId,
                    status: status,
                    progress: progress
                }));
                res.end();
                handledReponse = true;
            }
        });
        console.log(`Succesfully executed prompt ${promptId}`);
        status = "";
        progress = 100;
        const outputs = [];
        for (const nodeId of Object.keys(result.outputs)) {
            const output = result.outputs[nodeId];
            const resolvedOutput = comfyui.resolveOutputData(nodeId, output);
            if (resolvedOutput !== null) {
                for (let o of resolvedOutput) {
                    // remove the absolute path from subfolder to make it relative
                    // so the file delete actually works
                    // note that the  COMFYUI_OUTPUT_BASE_PATH is likely different from COMFYUI_OUTPUT_PATH because
                    // it's mapped in different containers
                    if (o.filetype === "output") {
                        const basePath = process.env.COMFYUI_OUTPUT_BASE_PATH;
                        if (o.subfolder.startswith(basePath))
                            o.subfolder = o.subfolder.substring(basePath.length);
                    }
                    outputs.push(o);
                }
            }
        }
        await doCallback(data.callbackUrl, outputs);
    }
    catch (err) {
        console.error("Error: " + JSON.stringify(err));
        throw err;
    }
});
async function doCallback(callbackUrl, data) {
    console.log("Doing callback to " + callbackUrl);
    try {
        const response = await fetch(callbackUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const json = await response.json();
        console.log("Callback response: " + JSON.stringify(json));
    }
    catch (err) {
        console.error("Error in callback: " + err);
    }
}
app.get("/status", async (req, res) => {
    try {
        const status = comfyui.getStatus();
        res.json(status);
    }
    catch (err) {
        res.status(500).json({ error: 'Error getting status.' });
    }
});
app.listen(process.env.PORT, () => {
    console.log(`Server listening on port ${process.env.PORT}`);
});
//# sourceMappingURL=main.js.map