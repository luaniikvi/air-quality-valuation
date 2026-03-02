import { WebSocketServer, WebSocket } from 'ws';
import type http from 'http';

type WSClient = WebSocket & { deviceId?: string };

let wss: WebSocketServer;

export function startWebSocketServer(port: number): void;
export function startWebSocketServer(opts: { server: http.Server; path?: string }): void;
export function startWebSocketServer(arg: number | { server: http.Server; path?: string }): void {
    if (typeof arg === 'number') {
        const port = arg;
        wss = new WebSocketServer({ port }, () => {
            console.log(`[WS] WebSocket Server đang chạy ở port ${port}`);
        });
    } else {
        const path = arg.path ?? '/ws';
        wss = new WebSocketServer({ server: arg.server, path }, () => {
            console.log(`[WS] WebSocket Server đang chạy ở path ${path}`);
        });
    }

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