import fs from 'fs';
import path from 'path';


const SERVER_URL = 'http://localhost:8190'; // adjust if different

async function uploadFile(filePath: string) {
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

async function queueWorkflow(workflow: any, callbackUrl: string) {
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

async function deleteFile(filename: string) {
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
        const filePath = path.resolve('./vlaams_snippet.mp3'); // your test file

        // 1️⃣ Upload the file
        const uploadedFilename = await uploadFile(filePath);

        // 2️⃣ Queue a workflow (demo workflow referencing the uploaded file)
        const demoWorkflow = {
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
                    "audio": "vlaams_snippet.mp3",
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

        await queueWorkflow(demoWorkflow, "http://172.20.50.213:5678/webhook/1552bb05-82e5-4ccc-bb05-aa173889c3fc");

        // 3️⃣ Delete the uploaded file
        await deleteFile(uploadedFilename);

        console.log('Demo complete.');
    } catch (err) {
        console.error('Error in demo client:', err);
    }
}

runDemo();