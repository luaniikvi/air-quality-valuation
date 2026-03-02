import { WebSocketServer, WebSocket } from 'ws';
let wss;
export function startWebSocketServer(arg) {
    if (typeof arg === 'number') {
        const port = arg;
        wss = new WebSocketServer({ port }, () => {
            console.log(`[WS] WebSocket Server đang chạy ở port ${port}`);
        });
    }
    else {
        const path = arg.path ?? '/ws';
        wss = new WebSocketServer({ server: arg.server, path }, () => {
            console.log(`[WS] WebSocket Server đang chạy ở path ${path}`);
        });
    }
    wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'hello', msg: 'connected' }));
        ws.on('message', (buf) => {
            try {
                const m = JSON.parse(buf.toString());
                if (m?.type === 'sub' && typeof m.deviceId === 'string') {
                    ws.deviceId = m.deviceId;
                    ws.send(JSON.stringify({ type: 'sub_ok', deviceId: ws.deviceId }));
                }
            }
            catch { }
        });
    });
}
export function broadcastToDevice(deviceId, payload) {
    if (!wss)
        return;
    wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN)
            return;
        if (client.deviceId !== deviceId)
            return;
        client.send(payload);
    });
}
//# sourceMappingURL=websocket.js.map