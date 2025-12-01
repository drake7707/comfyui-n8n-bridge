import { ComfyUI } from "./comfyui.js";
import express from 'express';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import multer from 'multer';
import { randomUUID } from 'crypto';

dotenv.config();


const app = express();

app.use(express.json());


// Multer setup
const upload = multer({
  limits: { fileSize: 1024 * 1024 * 1024 },
  dest: process.env.TEMP_UPLOAD_PATH,
});

fs.ensureDirSync(<string>process.env.TEMP_UPLOAD_PATH);
fs.ensureDirSync(<string>process.env.COMFYUI_UPLOAD_PATH);

const server = <string>process.env.COMFYUI_HOST;
const comfyui = new ComfyUI("n8n", server);


app.put('/upload', upload.any(), async (req: any, res: any) => {
  try {
    const file = req.files[0];
    if (file) {
      const uploadDir = process.env.COMFYUI_UPLOAD_PATH as string;

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
    } else {
      res.status(400).json({ error: 'No files uploaded.' });
    }
  } catch (err) {
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
  const uploadDir = process.env.COMFYUI_UPLOAD_PATH as string;
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'File deletion error.' });
  }
});


app.post("/queue", async (req, res) => {

  const data = req.body;

  const prompt = data.workflow;

  if (!comfyui.connected) {
    console.log("Comfyui not connected, connecting to server")
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

      const resolvedOutput: any = comfyui.resolveOutputData(nodeId,output);
      outputs.push(resolvedOutput);
    }
    await doCallback(data.callbackUrl, outputs)
  }
  catch (err) {
    console.error("Error: " + JSON.stringify(err));
    throw err;
  }
});

async function doCallback(callbackUrl: string, data: any) {
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
  } catch (err) {
    console.error("Error in callback: " + err);
  }
}

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});


/*

const generatePromptTemplate = {
  "10": {
    "inputs": {
      "model_type": "large-v3",
      "batch_size": 4,
      "if_mutiple_speaker": true,
      "use_auth_token": "",
      "if_translate": false,
      "translator": "alibaba",
      "to_language": "en",
      "audio": [
        "76",
        0
      ]
    },
    "class_type": "WhisperX",
    "_meta": {
      "title": "WhisperX Node"
    }
  },
  "40": {
    "inputs": {
      "srt": [
        "10",
        0
      ]
    },
    "class_type": "SRTToString",
    "_meta": {
      "title": "SRT to String"
    }
  },
  "76": {
    "inputs": {
      "audio": "sp_a2_bts5_lockeddoor05.wav",
      "choose audio file to upload": "Audio"
    },
    "class_type": "LoadAudioVideoPath",
    "_meta": {
      "title": "LoadAudioVideoPath"
    }
  },
  "78": {
    "inputs": {
      "text": "",
      "anything": [
        "40",
        0
      ]
    },
    "class_type": "easy showAnything",
    "_meta": {
      "title": "Show Any"
    }
  }
}



async function processRequest(generatePromptTemplate: any, uploadResult: UploadResult) {

  let prompt: any = JSON.parse(JSON.stringify(generatePromptTemplate));

  prompt["76"].inputs.audio = uploadResult.name;

  if (!comfyui.connected) {
    console.log("Comfyui not connected, connecting to server")
    await comfyui.connect();
  }

  let status = "";
  let progress = 0;
  try {
    status = "Waiting";

    const result = await comfyui.queue(prompt, (entry) => {
      status = entry.status;
      progress = entry.progress;
    });

    console.log("Succesfully executed");
    status = "";
    progress = 100;

    const outputs = [];
    for (const nodeId of Object.keys(result.outputs)) {
      const output = result.outputs[nodeId];

      const resolvedOutput: any = comfyui.resolveOutputData(nodeId, output);


      outputs.push(resolvedOutput);
    }
    return outputs;
  }
  catch (err) {
    console.error("Error: " + JSON.stringify(err));
    throw err;
  }
}



async function run() {
  const filename = randomUUID().toString();

  const buffer = await readFile("./vlaams_snippet.mp3");
  const file = new File([buffer], filename + ".mp3", {
    type: "audio/mpeg"
  });


  const uploadResult = await comfyui.upload(file);


  const resolvedOutput = await process(generatePromptTemplate, uploadResult);
  for (let o of resolvedOutput) {
    if (o.type == "image") {
      //img.src = o.src;
      console.log("Image URL: " + o.src);
    } else if (o.type == "text") {
      //o.text;
      console.log("Text output: " + o.text);
    }
  }
}


run().then(() => {
  console.log("Done");
}).catch((err) => {
  console.error("Error in run: " + err);
});


*/