# Devices API quick checks

Simple commands to validate the new devices management endpoints.

## List devices

```bash
curl -s http://localhost:4000/api/v1/devices | jq .
```

## Create with invalid payload (should return 400)

Missing required `name` and `config.ip` for a network device:

```bash
curl -i -X POST http://localhost:4000/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{ "type":"FINGERPRINT","connectionType":"NETWORK","enabled":true,"config":{"port":4370} }'
```

Expect `HTTP/1.1 400` with message `Validation failed` and field issues under `config.ip` and `name`.

## Create a network device

```bash
curl -s -X POST http://localhost:4000/api/v1/devices \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gate Relay 1",
    "type": "RELAY",
    "connectionType": "NETWORK",
    "enabled": true,
    "config": { "ip": "192.168.1.50", "port": 8080, "protocol": "generic-relay", "timeoutMs": 3000 }
  }'
```

## Test connectivity

```bash
curl -s -X POST http://localhost:4000/api/v1/devices/<deviceId>/test | jq .
```

Response example: `{ "ok": false, "status": "OFFLINE", "message": "Connection timed out" }`.
