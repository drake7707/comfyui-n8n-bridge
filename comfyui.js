export class ComfyUI {
    constructor(clientId, server) {
        this.clientId = clientId;
        this.server = server;
        this.registeredPrompts = {};
        this.ws = null;
    }
    async connect() {
        if (this.connected) {
            throw new Error("Already connected");
        }
        const promise = new Promise((resolve, error) => {
            this.ws = new WebSocket(`ws://${this.server}/ws?clientId=${this.clientId}`);
            this.ws.onopen = async () => {
                //console.log("Connected to websocket");
                resolve(true);
            };
            this.ws.onclose = async () => {
                //console.log("Disconnected from websocket");
                this.ws = null;
            };
            this.ws.onerror = (ev) => {
                //console.error("Websocket connection failed");
                error(ev);
            };
            this.ws.onmessage = async (ev) => {
                if (typeof ev.data == "string") {
                    const msg = JSON.parse(ev.data);
                    if (msg.type == "execution_start") {
                        const status = this.registeredPrompts[msg.data.prompt_id];
                        if (typeof status !== "undefined") {
                            status.onStart();
                        }
                    }
                    else if (msg.type == "execution_cached") {
                        const status = this.registeredPrompts[msg.data.prompt_id];
                        if (typeof status !== "undefined") {
                            for (let node of msg.data.nodes) {
                                status.onNodeExecuted(node, undefined);
                            }
                        }
                    }
                    else if (msg.type == "executing") {
                        //console.log(ev.data);
                        const status = this.registeredPrompts[msg.data.prompt_id];
                        if (typeof status !== "undefined") {
                            if (msg.data.node != null) {
                                status.onNodeExecuting(msg.data.node);
                            }
                            else {
                                status.onFinish();
                            }
                        }
                    }
                    else if (msg.type == "executed") {
                        //console.log(ev.data);
                        const status = this.registeredPrompts[msg.data.prompt_id];
                        if (typeof status !== "undefined") {
                            if (msg.data.node != null) {
                                status.onNodeExecuted(msg.data.node, msg.data.output);
                            }
                        }
                    }
                    else if (msg.type == "execution_success") {
                        const status = this.registeredPrompts[msg.data.prompt_id];
                        if (typeof status !== "undefined") {
                            status.onFinish();
                        }
                    }
                    else if (msg.type == "crystools.monitor") {
                        this.monitoringData = msg.data;
                    }
                    else {
                        //console.log(ev.data);
                    }
                }
                else {
                    // raw data
                }
            };
        });
    }
    get connected() {
        return this.ws != null && this.ws.readyState == WebSocket.OPEN;
    }
    disconnect() {
        if (this.ws != null) {
            this.ws.close();
            this.ws = null;
        }
    }
    getMonitoringData() {
        return this.monitoringData;
    }
    resolveOutputData(output) {
        const result = [];
        if (typeof output.images !== "undefined") {
            for (let img of output.images) {
                const params = new URLSearchParams();
                params.set("filename", img.filename);
                params.set("subfolder", img.subfolder);
                params.set("type", img.type);
                result.push({
                    type: "image",
                    src: `http://${this.server}/view?` + params.toString()
                });
            }
            return result;
        }
        else if (typeof output.text !== "undefined") {
            return [{
                    "type": "text",
                    "text": output.text.join("")
                }];
        }
        return null;
    }
    async queue(prompt, onUpdate) {
        const result = await fetch(`http://${this.server}/prompt`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                client_id: this.clientId
            })
        });
        const data = await result.json();
        const promiseResult = new Promise((onResolve, onError) => {
            //console.log(data);
            if (typeof data.error !== "undefined") {
                onError(data);
                return;
            }
            if (result.status != 200) {
                onError(result.statusText);
                return;
            }
            const promptId = data['prompt_id'];
            //console.log(`Request registered with prompt id ${promptId}`);
            const outputs = {};
            const entry = {
                id: promptId,
                status: 'queued',
                onStart: () => {
                    entry.status = "executing";
                    onUpdate(entry);
                },
                onNodeExecuting: (nodeId) => {
                    entry.status = "executing";
                    entry.activeNode = nodeId;
                    entry.nodesExecuted.push(nodeId);
                    entry.nodesToExecute.splice(entry.nodesToExecute.indexOf(nodeId), 1);
                    entry.progress = entry.nodesExecuted.length / (entry.nodesExecuted.length + entry.nodesToExecute.length);
                    onUpdate(entry);
                },
                onNodeExecuted: (nodeId, output) => {
                    if (typeof output !== "undefined")
                        outputs[nodeId] = output;
                    onUpdate(entry);
                },
                onFinish: () => {
                    entry.status = "finished";
                    onResolve(entry);
                    delete this.registeredPrompts[promptId];
                },
                outputs: outputs,
                activeNode: null,
                nodesToExecute: Object.keys(prompt),
                nodesExecuted: [],
                progress: 0
            };
            this.registeredPrompts[promptId] = entry;
        });
        return promiseResult;
    }
    async upload(file) {
        const formData = new FormData();
        formData.append("image", file);
        //formData.append("subfolder", "connector_uploads");
        try {
            const response = await fetch(`http://${this.server}/api/upload/image`, {
                method: "POST",
                body: formData,
            });
            if (response.status === 200) {
                // {"name": "vlaams_snippet.mp3", "subfolder": "", "type": "input"}
                const data = await response.json();
                return data;
            }
            else {
                throw new Error(`Upload failed with status ${response.status}`);
            }
        }
        catch (err) {
            console.error("Error during upload: " + err);
            throw err;
        }
    }
}
