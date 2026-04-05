import mysql from "mysql2/promise";

type LatencyStats = {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
};

function calculateStats(times: number[]): LatencyStats {
    const sorted = [...times].sort((a, b) => a - b);

    const percentile = (p: number) =>
        sorted[Math.floor((p / 100) * sorted.length)];

    const sum = times.reduce((a, b) => a + b, 0);

    return {
        avg: sum / times.length,
        p50: percentile(50)!,
        p95: percentile(95)!,
        p99: percentile(99)!,
        max: sorted[sorted.length - 1]!,
    };
}

async function testDbLatency() {
    const connection = await mysql.createPool({
        host: "localhost",
        user: "root",
        password: "3014",
        database: "air_quality_monitor",
        connectionLimit: 10,
    });

    const iterations = 100; // số lần test
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();

        await connection.query("SELECT * FROM air_quality_monitor.telemetry WHERE device_id = ?", ['esp32-001']);

        const end = process.hrtime.bigint();

        const latencyMs = Number(end - start) / 1e6;
        times.push(latencyMs);
    }

    const stats = calculateStats(times);

    console.log("📊 MySQL Latency Stats:");
    console.log(`Avg:  ${stats.avg.toFixed(2)} ms`);
    console.log(`P50:  ${stats.p50.toFixed(2)} ms`);
    console.log(`P95:  ${stats.p95.toFixed(2)} ms`);
    console.log(`P99:  ${stats.p99.toFixed(2)} ms`);
    console.log(`Max:  ${stats.max.toFixed(2)} ms`);

    await connection.end();
}

testDbLatency().catch(console.error);