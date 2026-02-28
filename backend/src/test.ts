// import { processor } from "./telemetryProcessor.js";

// export const cac: number = 0;
// console.log(processor.ingest({
//     deviceId: "test2",
//     ts: Date.now(),
//     temp: 24.8,
//     hum: 41.5,
//     dust: 0,
//     gas: 401
// })) // 100-SAFE

import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "3014",
    database: "air_quality_monitor",
    waitForConnections: true,
    connectionLimit: 10,
});

type Level = "SAFE" | "WARN" | "DANGER";

type TelemetryInput = {
    deviceId: string;
    ts?: number;      // unix seconds; nếu không truyền thì tự lấy Date.now()
    temp: number;
    hum: number;
    gas: number;
    dust: number;
    iaq: number;      // tinyint unsigned (0-255)
    level: Level;
};

export async function insertTelemetry(t: TelemetryInput) {
    const sql = `
    INSERT INTO telemetry (device_id, ts, temp, hum, gas, dust, iaq, level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const ts = t.ts ?? Math.floor(Date.now() / 1000);

    const [result] = await pool.execute<mysql.ResultSetHeader>(sql, [
        t.deviceId,
        ts,
        t.temp,
        t.hum,
        t.gas,
        t.dust,
        t.iaq,
        t.level,
    ]);

    return result.insertId; // id vừa tạo
}

export async function insertDevice(t: TelemetryInput) {
    const sql = `
    INSERT INTO devices (device_id, name, created_ts, last_seen_ts)
    VALUES (?, ?, ?, ?)
  `;

    const ts = Math.floor(Date.now() / 1000);

    const [result] = await pool.execute<mysql.ResultSetHeader>(sql, [
        t.deviceId,
        'no name',
        ts,
        ts
    ]);

    return result.insertId; // id vừa tạo
}

// Ví dụ gọi:
(async () => {
    console.log('before');
    const id = await insertDevice({
        deviceId: "esp32-test",
        temp: 27.5,
        hum: 60.2,
        gas: 120.0,
        dust: 35.4,
        iaq: 42,
        level: "SAFE",
    });

    console.log("Inserted id =", id);
    await true;
})();