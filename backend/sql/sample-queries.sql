-- Sample queries

-- 1) Latest telemetry for a device
SELECT device_id, ts, temp, hum, gas, dust, iaq, level
FROM telemetry
WHERE device_id = 'esp32-001'
ORDER BY ts DESC
LIMIT 1;

-- 2) History in a time range (raw points)
SELECT device_id, ts, temp, hum, gas, dust, iaq, level
FROM telemetry
WHERE device_id = 'esp32-001'
  AND ts BETWEEN 1700000000 AND 1700003600
ORDER BY ts ASC;

-- 3) History sampled by N seconds (e.g. 60s). One row per bucket (latest ts in bucket)
SET @dev = 'esp32-001';
SET @from = 1700000000;
SET @to = 1700003600;
SET @step = 60;

SELECT t.device_id, t.ts, t.temp, t.hum, t.gas, t.dust, t.iaq, t.level
FROM telemetry t
JOIN (
  SELECT MAX(ts) AS ts
  FROM telemetry
  WHERE device_id = @dev AND ts BETWEEN @from AND @to
  GROUP BY FLOOR(ts / @step)
) b ON b.ts = t.ts
WHERE t.device_id = @dev
ORDER BY t.ts ASC;

-- 4) Alerts in a range
SELECT id, device_id, ts, type, value, level, message
FROM alerts
WHERE device_id = 'esp32-001'
  AND ts BETWEEN 1700000000 AND 1700003600
ORDER BY ts DESC;
