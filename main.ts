import { readFile } from "fs/promises";

import { ComfyUI, UploadResult } from "./comfyui.js";
import { randomUUID } from "crypto";
import * as express from 'express';

const app = express();

app.use(express.json());

app.put('/upload', async (req, res) => {

  
    const comfyui = new ComfyUI("test", server);

    await comfyui.upload()
    comfyui.upload(req.body.file).then((uploadResult) => {;
}


app.listen(8190, () => {
  
})

const server = "172.20.50.213:8189"

const comfyui = new ComfyUI("test", server);



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



async function process(generatePromptTemplate:any, uploadResult:UploadResult) {

    let prompt:any = JSON.parse(JSON.stringify(generatePromptTemplate));

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
        progress= 100;

        const outputs = [];
        for (const nodeId of Object.keys(result.outputs)) {
            const output = result.outputs[nodeId];

            const resolvedOutput:any = comfyui.resolveOutputData(output);


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

    const buffer  = await readFile("./vlaams_snippet.mp3");
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
} );


