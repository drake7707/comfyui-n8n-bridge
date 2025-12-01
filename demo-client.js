import fs from 'fs';
import path from 'path';
const SERVER_URL = 'http://localhost:8190'; // adjust if different
async function uploadFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const file = new File([buffer], filename, { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${SERVER_URL}/upload`, {
        method: 'PUT',
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('Upload result:', result);
    return result.filename;
}
async function queueWorkflow(workflow, callbackUrl) {
    const body = { workflow, callbackUrl: callbackUrl };
    const response = await fetch(`${SERVER_URL}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Queue failed: ${response.statusText}`);
    }
    const data = await response.json().catch(() => null); // might be partial stream response
    console.log('Queue response:', data);
    return data;
}
async function deleteFile(filename) {
    const response = await fetch(`${SERVER_URL}/upload/${filename}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Delete result:', data);
}
async function runDemo() {
    try {
        //  const filePath = path.resolve('./vlaams_snippet.mp3'); // your test file
        // 1️⃣ Upload the file
        //    const uploadedFilename = await uploadFile(filePath);
        // 2️⃣ Queue a workflow (demo workflow referencing the uploaded file)
        const demoWorkflow = {
            "11": {
                "inputs": {
                    "text": "Dit is een test",
                    "model": "VibeVoice7b-low-vram",
                    "attention_type": "auto",
                    "quantize_llm": "full precision",
                    "free_memory_after_generate": true,
                    "diffusion_steps": 10,
                    "seed": 3523606388,
                    "cfg_scale": 1.3,
                    "use_sampling": false,
                    "temperature": 0.95,
                    "top_p": 0.95,
                    "max_words_per_chunk": 250,
                    "voice_speed_factor": 1,
                    "voice_to_clone": [
                        "13",
                        0
                    ]
                },
                "class_type": "VibeVoiceSingleSpeakerNode",
                "_meta": {
                    "title": "VibeVoice Single Speaker"
                }
            },
            "12": {
                "inputs": {
                    "audioUI": "",
                    "audio": [
                        "11",
                        0
                    ]
                },
                "class_type": "PreviewAudio",
                "_meta": {
                    "title": "Preview Audio"
                }
            },
            "13": {
                "inputs": {
                    "audio": "vlaams_snippet.mp3",
                    "audioUI": ""
                },
                "class_type": "LoadAudio",
                "_meta": {
                    "title": "Load Audio"
                }
            }
        };
        await queueWorkflow(demoWorkflow, "http://172.20.50.213:5678/webhook/1552bb05-82e5-4ccc-bb05-aa173889c3fc");
        // 3️⃣ Delete the uploaded file
        //     await deleteFile(uploadedFilename);
        console.log('Demo complete.');
    }
    catch (err) {
        console.error('Error in demo client:', err);
    }
}
runDemo();
//# sourceMappingURL=demo-client.js.map