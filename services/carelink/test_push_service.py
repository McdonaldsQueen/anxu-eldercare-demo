import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import threading
import unittest

import policy_service as service


TODAY = date(2026, 9, 19)


class PushServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.old_path = service.DB_PATH
        self.old_key = os.environ.get("POLICY_API_KEY")
        os.environ["POLICY_API_KEY"] = "test-policy-key"
        service.DB_PATH = Path(self.temp.name) / "test.sqlite3"
        self.db = service.connect()
        item = copy.deepcopy(service.load_config()["policies"][0])
        source = " ".join(item["evidence"].values())
        policy = service.verified_policy(item, source, TODAY)
        self.db.execute("REPLACE INTO policies VALUES(?,?,?)",
                        (policy["id"], json.dumps(policy, ensure_ascii=False), policy["crawledAt"]))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        service.DB_PATH = self.old_path
        if self.old_key is None:
            os.environ.pop("POLICY_API_KEY", None)
        else:
            os.environ["POLICY_API_KEY"] = self.old_key
        self.temp.cleanup()

    def subscribe(self, conversation="conversation_one", visitor="web_visitor_one"):
        return service.upsert_subscription(self.db, {
            "recipientId": "E001",
            "spUserRef": visitor,
            "conversationId": conversation,
            "region": "天津市",
            "age": 82,
            "localHukou": True,
            "needsCertification": False,
        })

    def test_subscription_rebind_status_and_delete_require_same_visitor(self):
        self.subscribe()
        status = service.subscription_status(self.db, {"recipientId": "E001", "spUserRef": "web_visitor_one"})
        self.assertTrue(status["enabled"])
        self.assertEqual(status["conversationSuffix"], "on_one")
        self.subscribe("conversation_two", "web_visitor_two")
        self.assertFalse(service.subscription_status(
            self.db, {"recipientId": "E001", "spUserRef": "web_visitor_one"})["enabled"])
        service.delete_subscription(self.db, {"recipientId": "E001", "spUserRef": "web_visitor_one"})
        self.assertTrue(service.subscription_status(
            self.db, {"recipientId": "E001", "spUserRef": "web_visitor_two"})["enabled"])
        service.delete_subscription(self.db, {"recipientId": "E001", "spUserRef": "web_visitor_two"})
        self.assertFalse(service.subscription_status(self.db, {"recipientId": "E001"})["enabled"])

    def test_claim_fail_retry_complete_and_deduplicate(self):
        self.subscribe()
        first = service.claim_push(self.db, {
            "recipientId": "E001", "runId": "run-one", "trigger": "cron",
        }, TODAY)
        self.assertEqual(first["status"], "claimed")
        self.assertEqual(len(first["messages"]), 1)
        self.assertTrue(first["marker"].startswith("CARELINK_POLICY_PUSH:"))
        busy = service.claim_push(self.db, {
            "recipientId": "E001", "runId": "run-two", "trigger": "cron",
        }, TODAY)
        self.assertEqual(busy["status"], "busy")
        service.fail_push(self.db, {
            "recipientId": "E001", "batchId": first["batchId"], "runId": "run-one",
            "errorCategory": "network",
        })
        retry = service.claim_push(self.db, {
            "recipientId": "E001", "runId": "run-two", "trigger": "cron",
        }, TODAY)
        self.assertEqual(retry["batchId"], first["batchId"])
        completed = service.complete_push(self.db, {
            "recipientId": "E001", "batchId": retry["batchId"], "runId": "run-two",
            "userEventId": "evt-1",
        })
        self.assertTrue(completed["completed"])
        self.assertEqual(service.claim_push(self.db, {
            "recipientId": "E001", "runId": "run-three", "trigger": "cron",
        }, TODAY)["status"], "no_new")

    def test_concurrent_claim_only_leases_once(self):
        self.subscribe()
        self.db.close()
        barrier = threading.Barrier(2)

        def claim(run_id):
            with service.connect() as db:
                barrier.wait()
                return service.claim_push(db, {
                    "recipientId": "E001", "runId": run_id, "trigger": "cron",
                }, TODAY)["status"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(claim, ("run-one", "run-two")))
        self.assertEqual(statuses, ["busy", "claimed"])
        self.db = service.connect()

    def test_manual_cooldown_and_reset_preserve_policy_cache(self):
        self.subscribe()
        claimed = service.claim_push(self.db, {
            "recipientId": "E001", "runId": "manual-one", "trigger": "manual",
        }, TODAY)
        cooldown = service.claim_push(self.db, {
            "recipientId": "E001", "runId": "manual-two", "trigger": "manual",
        }, TODAY)
        self.assertEqual(cooldown["status"], "cooldown")
        service.reset_recipient(self.db, {"recipientId": "E001", "spUserRef": "web_visitor_one"})
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM policies").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM push_batches").fetchone()[0], 0)
        self.assertEqual(claimed["status"], "claimed")


if __name__ == "__main__":
    unittest.main()
