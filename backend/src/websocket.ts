import { WebSocketServer, WebSocket } from 'ws';

type WSClient = WebSocket & { deviceId?: string };

let wss: WebSocketServer;

export function startWebSocketServer(port: number): void {
    wss = new WebSocketServer({ port }, () => {
        console.log(`[WS] WebSocket Server đang chạy ở port ${port}`);
    });

    wss.on('connection', (ws: WSClient) => {
        ws.send(JSON.stringify({ type: 'hello', msg: 'connected' }));

        ws.on('message', (buf) => {
            try {
                const m = JSON.parse(buf.toString());
                if (m?.type === 'sub' && typeof m.deviceId === 'string') {
                    ws.deviceId = m.deviceId;
                    ws.send(JSON.stringify({ type: 'sub_ok', deviceId: ws.deviceId }));
                }
            } catch { }
        });
    });
}

export function broadcastToDevice(deviceId: string, payload: string): void {
    if (!wss) return;
    wss.clients.forEach((client: WSClient) => {
        if (client.readyState !== WebSocket.OPEN) return;
        if (client.deviceId !== deviceId) return;
        client.send(payload);
    });
}