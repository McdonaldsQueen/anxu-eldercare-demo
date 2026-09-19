"""Run against a locally started policy_service.py serve instance."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from uuid import uuid4

BASE = os.environ.get("POLICY_API_BASE_URL", "http://127.0.0.1:8765").rstrip("/")
API_KEY = os.environ.get("POLICY_API_KEY", "")


def post(path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    req = Request(BASE + path, data=data, headers=headers)
    with urlopen(req, timeout=10) as response:
        return json.load(response)


with urlopen(BASE + "/health", timeout=10) as response:
    health = json.load(response)

run_id = uuid4().hex[:12]
cases = [
    {"recipientId": f"smoke-tj-{run_id}", "region": "天津市", "age": 82, "localHukou": True},
    {"recipientId": f"smoke-jn-{run_id}", "region": "济南市", "age": 82, "localHukou": True},
    {"recipientId": f"smoke-xj-{run_id}", "region": "新疆维吾尔自治区", "age": 82, "localHukou": True},
]
results = [post("/v1/openhex/policies/pull", payload) for payload in cases]
Path("api-response-example.json").write_text(json.dumps(results[0], ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"health": health, "counts": [r["count"] for r in results],
                  "priorities": [r["messages"][0]["priority"] if r["count"] else None for r in results]}, ensure_ascii=False))
first = results[0]["messages"][0]
ack = post("/v1/openhex/policies/ack", {"recipientId": cases[0]["recipientId"], "deliveryId": first["deliveryId"]})
again = post("/v1/openhex/policies/pull", cases[0])
print(json.dumps({"acknowledged": ack["acknowledged"], "secondPullCount": again["count"]}, ensure_ascii=False))
