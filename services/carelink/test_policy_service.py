import copy
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import policy_service as service


TODAY = date(2026, 9, 19)


class PolicyServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.old_path = service.DB_PATH
        service.DB_PATH = Path(self.temp.name) / "test.sqlite3"
        self.db = service.connect()
        self.item = copy.deepcopy(service.load_config()["policies"][0])
        self.source = " ".join(self.item["evidence"].values())

    def tearDown(self):
        self.db.close()
        service.DB_PATH = self.old_path
        self.temp.cleanup()

    def put(self, item=None):
        policy = service.verified_policy(item or self.item, self.source, TODAY)
        self.db.execute("REPLACE INTO policies VALUES(?,?,?)",
                        (policy["id"], json.dumps(policy, ensure_ascii=False), policy["crawledAt"]))
        self.db.commit()
        return policy

    def test_missing_quote_blocks_policy(self):
        with self.assertRaisesRegex(ValueError, "evidence missing"):
            service.verified_policy(self.item, self.source.replace("免申即享", "自动发放"), TODAY)

    def test_expiry_and_closed_application_window_block_policy(self):
        expired = copy.deepcopy(self.item)
        expired["expiresAt"] = "2026-09-18"
        expired["evidence"]["expiresAt"] = "有效期至2026年9月18日"
        with self.assertRaisesRegex(ValueError, "evidence missing"):
            service.verified_policy(expired, self.source, TODAY)
        with self.assertRaisesRegex(ValueError, "policy expired"):
            service.verified_policy(expired, self.source + "有效期至2026年9月18日", TODAY)
        closed = copy.deepcopy(self.item)
        closed["applicationDeadline"] = "2026-09-18"
        with self.assertRaisesRegex(ValueError, "core application window closed"):
            service.verified_policy(closed, self.source, TODAY)

    def test_region_age_and_hukou_filter(self):
        self.put()
        for req in (
            {"recipientId": "r", "region": "济南市", "age": 82},
            {"recipientId": "r", "region": "天津市", "age": 79},
            {"recipientId": "r", "region": "天津市", "age": 82, "localHukou": False},
        ):
            self.assertEqual(service.pull(self.db, req, TODAY)["count"], 0)

    def test_timing_gate_rechecked_on_every_pull(self):
        self.put()
        self.assertEqual(service.pull(self.db, {"recipientId": "r", "region": "天津市"}, TODAY)["count"], 1)
        self.assertEqual(service.pull(self.db, {"recipientId": "r", "region": "天津市"}, date(2027, 1, 1))["count"], 0)

    def test_sms_contains_official_original_url(self):
        self.put()
        message = service.pull(self.db, {"recipientId": "r", "region": "天津市"}, TODAY)["messages"][0]
        self.assertIn("原文链接：" + message["originalUrl"], message["smsText"])

    def test_ack_prevents_duplicate_and_deadline_allows_one_reminder(self):
        policy = self.put()
        req = {"recipientId": "r", "region": "天津市", "age": 82}
        first = service.pull(self.db, req, TODAY)
        self.assertEqual(first["count"], 1)
        self.assertEqual(service.pull(self.db, req, TODAY)["count"], 1)  # no send confirmation yet
        service.ack(self.db, {"recipientId": "r", "deliveryId": first["messages"][0]["deliveryId"]})
        self.assertEqual(service.pull(self.db, req, TODAY)["count"], 0)
        policy["applicationDeadline"] = "2026-09-25"
        self.db.execute("UPDATE policies SET payload=? WHERE id=?", (json.dumps(policy), policy["id"]))
        self.db.execute("UPDATE sent SET sent_at=?", ((datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),))
        self.db.commit()
        reminder = service.pull(self.db, req, TODAY)
        self.assertEqual(reminder["count"], 1)
        self.assertTrue(reminder["messages"][0]["reminder"])
        service.ack(self.db, {"recipientId": "r", "deliveryId": reminder["messages"][0]["deliveryId"]})
        self.assertEqual(service.pull(self.db, req, TODAY)["count"], 0)

    def test_urgency_is_first_and_response_never_exceeds_three(self):
        base = self.put()
        for number, days in enumerate((3, 12, 45, 80), start=1):
            policy = copy.deepcopy(base)
            policy["id"] = f"test-{number}"
            policy["applicationDeadline"] = (TODAY + timedelta(days=days)).isoformat()
            policy["benefitImpact"] = 3 + number % 2
            self.db.execute("INSERT INTO policies VALUES(?,?,?)",
                            (policy["id"], json.dumps(policy), policy["crawledAt"]))
        self.db.commit()
        result = service.pull(self.db, {"recipientId": "r", "region": "天津市"}, TODAY)
        self.assertEqual(result["count"], 3)
        self.assertEqual([x["actionUrgency"] for x in result["messages"]], [5, 4, 3])


if __name__ == "__main__":
    unittest.main()
