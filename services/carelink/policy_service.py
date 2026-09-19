"""Official eldercare policy crawler and OpenHex pull API (Python 3.10+)."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import hmac
import html
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("POLICY_DB_PATH", ROOT / "data" / "policies.sqlite3"))
CONFIG_PATH = ROOT / "sources.json"
MAX_BODY = 2_000_000
FRESH_HOURS = 24
BATCH_LEASE_MINUTES = 10
MANUAL_COOLDOWN_SECONDS = 60
ELDER_WORDS = ("老年人", "高龄", "养老", "退休", "长护险")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def norm(value: str) -> str:
    return re.sub(r"[\s\u200b\ufeff]+", "", html.unescape(value or ""))


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.href: str | None = None
        self.label: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.label = []

    def handle_data(self, data: str) -> None:
        if self.href is not None:
            self.label.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.href:
            self.links.append((self.href, "".join(self.label).strip()))
            self.href = None


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def approved_url(url: str, hosts: list[str]) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in hosts and not parsed.username


class RestrictedRedirect(HTTPRedirectHandler):
    def __init__(self, hosts: list[str]) -> None:
        self.hosts = hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not approved_url(newurl, self.hosts):
            raise ValueError("redirect left official host whitelist")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_markup(url: str, hosts: list[str]) -> str:
    if not approved_url(url, hosts):
        raise ValueError("source URL is not on the HTTPS government whitelist")
    opener = build_opener(RestrictedRedirect(hosts))
    request = Request(url, headers={"User-Agent": "AnxuPolicyV1/1.0 (policy monitoring; contact via operator)", "Accept": "text/html"})
    with opener.open(request, timeout=20) as response:
        if not approved_url(response.url, hosts):
            raise ValueError("final URL left official host whitelist")
        if "text/html" not in response.headers.get("Content-Type", ""):
            raise ValueError("source is not HTML")
        raw = response.read(MAX_BODY + 1)
        if len(raw) > MAX_BODY:
            raise ValueError("source exceeds size limit")
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def fetch_official(url: str, hosts: list[str]) -> str:
    markup = fetch_markup(url, hosts)
    parser = TextParser()
    parser.feed(markup)
    return " ".join(parser.parts)


def date_value(raw: str | None) -> date | None:
    return date.fromisoformat(raw) if raw else None


def quote_contains_date(quote: str, value: str) -> bool:
    year, month, day = value.split("-")
    return bool(re.search(rf"{year}(?:-|年){int(month):0{2}d}(?:-|月){int(day):0{2}d}", norm(quote))) or bool(
        re.search(rf"{year}年{int(month)}月{int(day)}日", norm(quote)))


def timely(policy: dict, today: date) -> bool:
    published = date_value(policy["publishedAt"])
    effective = date_value(policy.get("effectiveAt"))
    deadline = date_value(policy.get("applicationDeadline"))
    return bool(published >= today - timedelta(days=90) or
                (effective and today <= effective <= today + timedelta(days=90)) or
                (deadline and today <= deadline <= today + timedelta(days=90)))


def verified_policy(item: dict, text: str, today: date) -> dict:
    page = norm(text)
    if not any(word in page for word in ELDER_WORDS):
        raise ValueError("not an eldercare policy")
    evidence = item.get("evidence", {})
    required = ("title", "institution", "publishedAt", "effectiveAt", "audience", "benefitChange", "actionRequired")
    for key in required:
        if not evidence.get(key) or norm(evidence[key]) not in page:
            raise ValueError(f"source evidence missing or changed: {key}")
    for key, quote in evidence.items():
        if quote and norm(quote) not in page:
            raise ValueError(f"source evidence missing or changed: {key}")
    if not quote_contains_date(evidence["publishedAt"], item["publishedAt"]):
        raise ValueError("publication date does not match its quote")
    if "印发之日起" not in evidence["effectiveAt"] and not quote_contains_date(evidence["effectiveAt"], item["effectiveAt"]):
        raise ValueError("effective date does not match its quote")
    if "印发之日起" in evidence["effectiveAt"] and item["effectiveAt"] != item["publishedAt"]:
        raise ValueError("effective-on-issue date does not match publication")
    published = date_value(item["publishedAt"])
    effective = date_value(item["effectiveAt"])
    expires = date_value(item.get("expiresAt"))
    deadline = date_value(item.get("applicationDeadline"))
    if published > today:
        raise ValueError("future publication date")
    if expires and expires < today:
        raise ValueError("policy expired")
    if deadline and deadline < today:
        raise ValueError("core application window closed")
    if item.get("expiresAt") and "expiresAt" not in evidence:
        raise ValueError("expiry date has no source evidence")
    term_years = item.get("expiryTermYears")
    if term_years is not None:
        if not isinstance(term_years, int) or term_years <= 0 or not effective or not expires:
            raise ValueError("invalid derived expiry term")
        if expires != effective.replace(year=effective.year + term_years) - timedelta(days=1):
            raise ValueError("derived expiry does not match effective date and term")
        if norm(f"有效期{term_years}年") not in norm(evidence.get("expiresAt", "")):
            raise ValueError("derived expiry requires source term")
    # Eligibility is a public-pool gate; narrow groups require a matched recipient profile.
    if item["universality"] < 3:
        raise ValueError("universality below public-pool threshold")
    if not timely(item, today):
        raise ValueError("outside timely notification window")
    facts = {key: item.get(key) for key in (
        "id", "title", "institution", "region", "publishedAt", "effectiveAt", "expiresAt",
        "applicationDeadline", "category", "audience", "benefitChange", "actionRequired", "actionMode",
        "universality", "benefitImpact")}
    facts["evidence"] = {key: {"quote": quote, "url": item["url"]} for key, quote in evidence.items()}
    facts["sourceUrl"] = item["url"]
    facts["expiresAtDerived"] = term_years is not None
    facts["policyStatus"] = "upcoming" if effective and effective > today else "effective"
    facts["factsVersion"] = hashlib.sha256(json.dumps(facts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    facts["crawledAt"] = now_utc().isoformat()
    return facts


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS crawl_log (id INTEGER PRIMARY KEY AUTOINCREMENT, policy_id TEXT, status TEXT, detail TEXT, at TEXT);
        CREATE TABLE IF NOT EXISTS proposals (delivery_id TEXT PRIMARY KEY, recipient_id TEXT, policy_id TEXT, facts_version TEXT, reminder INTEGER, at TEXT);
        CREATE TABLE IF NOT EXISTS sent (recipient_id TEXT, policy_id TEXT, facts_version TEXT, reminder INTEGER, sent_at TEXT,
            PRIMARY KEY(recipient_id, policy_id, facts_version, reminder));
        CREATE TABLE IF NOT EXISTS discovered (url TEXT PRIMARY KEY, title TEXT, region TEXT, discovered_at TEXT);
        CREATE TABLE IF NOT EXISTS subscriptions (
            recipient_id TEXT PRIMARY KEY,
            sp_user_ref TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            region TEXT NOT NULL,
            age INTEGER,
            local_hukou INTEGER,
            needs_certification INTEGER,
            enabled INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS push_batches (
            batch_id TEXT PRIMARY KEY,
            recipient_id TEXT NOT NULL,
            marker TEXT NOT NULL UNIQUE,
            delivery_ids TEXT NOT NULL,
            messages TEXT NOT NULL,
            status TEXT NOT NULL,
            trigger_kind TEXT NOT NULL,
            lease_owner TEXT NOT NULL,
            lease_expires_at TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 1,
            claimed_at TEXT NOT NULL,
            submitted_at TEXT,
            user_event_id TEXT,
            last_error TEXT,
            updated_at TEXT NOT NULL
        );
    """)
    return db


def crawl(db: sqlite3.Connection, fetcher=fetch_official, today: date | None = None) -> dict:
    today = today or date.today()
    config = load_config()
    report = {"fetched": 0, "accepted": 0, "discoveredForReview": 0, "rejected": []}
    reviewed_urls = {item["url"] for item in config["policies"]}
    if fetcher is fetch_official:
        for index in config.get("indexes", []):
            try:
                parser = LinkParser()
                parser.feed(fetch_markup(index["url"], config["allowedHosts"]))
                for href, title in parser.links:
                    url = urljoin(index["url"], href)
                    if (approved_url(url, config["allowedHosts"]) and url not in reviewed_urls and
                            any(word in title for word in ELDER_WORDS) and url.endswith(".html")):
                        changed = db.execute("INSERT OR IGNORE INTO discovered VALUES (?,?,?,?)",
                                             (url, title, index["region"], now_utc().isoformat())).rowcount
                        report["discoveredForReview"] += changed
            except Exception as exc:
                report["rejected"].append({"indexUrl": index["url"], "reason": str(exc)})
    def fetch_and_verify(item: dict) -> tuple[dict, dict | None, str | None]:
        try:
            content = fetcher(item["url"], config["allowedHosts"])
            return item, verified_policy(item, content, today), None
        except Exception as exc:
            return item, None, str(exc)

    workers = max(1, min(4, len(config["policies"])))
    results = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(fetch_and_verify, item) for item in config["policies"]]
        for future in as_completed(futures):
            results.append(future.result())

    for item, policy, failure in results:
        report["fetched"] += 1
        if policy is not None:
            db.execute("REPLACE INTO policies VALUES (?, ?, ?)",
                       (item["id"], json.dumps(policy, ensure_ascii=False), policy["crawledAt"]))
            report["accepted"] += 1
            status, detail = "accepted", "all quoted facts verified"
        else:
            # Fail closed: a changed, unavailable or expired source cannot be pushed from cache.
            db.execute("DELETE FROM policies WHERE id = ?", (item["id"],))
            status, detail = "rejected", failure or "unknown verification failure"
            report["rejected"].append({"policyId": item["id"], "reason": detail})
        db.execute("INSERT INTO crawl_log(policy_id,status,detail,at) VALUES (?,?,?,?)",
                   (item["id"], status, detail, now_utc().isoformat()))
    db.commit()
    return report


def urgency(policy: dict, today: date, needs_certification: bool = False) -> int:
    deadline = date_value(policy.get("applicationDeadline"))
    if deadline:
        days = (deadline - today).days
        return 5 if days <= 7 else 4 if days <= 30 else 3 if days <= 90 else 2
    mode = policy["actionMode"]
    if mode == "conditional_certification":
        return 2 if needs_certification else 1
    return 2 if mode == "apply_no_deadline" else 1


def priority(urgency_score: int, impact: int) -> str | None:
    if impact <= 2 and urgency_score <= 2:
        return None
    if urgency_score >= 4 and impact >= 4:
        return "P0"
    if (urgency_score >= 4 and impact == 3) or (urgency_score >= 3 and impact >= 4) or impact >= 4:
        return "P1"
    if urgency_score >= 4 or (urgency_score >= 3 and impact >= 2) or impact == 3:
        return "P2"
    return "P3"


def sms(policy: dict) -> str:
    if policy["id"].startswith("tj-"):
        body = "【安序智护】天津高龄津贴实行免申即享。符合条件的本市户籍老人如未获发放，可向当地民政部门咨询保留的申领渠道。"
    elif policy["id"].startswith("jinan-"):
        body = "【安序智护】济南高龄津贴新办法10月2日起实施。符合条件的本市户籍80岁及以上老人，可由本人或代理人向户籍地村（居）委会申请。"
    else:
        body = "【安序智护】新疆高龄津贴实行免申即享。符合条件的自治区户籍80岁及以上老人，如无法共享认证，请按当地要求完成资格认证。"
    return f"{body}原文链接：{policy['sourceUrl']}"


def recipient_key(recipient_id: str) -> str:
    secret = os.environ.get("POLICY_API_KEY", "local-development-only")
    return hmac.new(secret.encode(), recipient_id.encode(), hashlib.sha256).hexdigest()


def pull(db: sqlite3.Connection, req: dict, today: date | None = None, commit: bool = True) -> dict:
    today = today or date.today()
    recipient = str(req.get("recipientId", "")).strip()
    region = str(req.get("region", "")).strip()
    if not recipient or not region:
        raise ValueError("recipientId and region are required")
    recipient = recipient_key(recipient)
    age = req.get("age")
    if age is not None and (not isinstance(age, int) or isinstance(age, bool) or age < 0 or age > 120):
        raise ValueError("age must be an integer from 0 to 120")
    if "localHukou" in req and not isinstance(req["localHukou"], bool):
        raise ValueError("localHukou must be boolean")
    candidates = []
    for row in db.execute("SELECT payload,fetched_at FROM policies"):
        policy = json.loads(row["payload"])
        if policy["region"] != region or (age is not None and age < 80) or req.get("localHukou") is False:
            continue
        if now_utc() - datetime.fromisoformat(row["fetched_at"]) > timedelta(hours=FRESH_HOURS):
            continue
        if date_value(policy.get("expiresAt")) and date_value(policy["expiresAt"]) < today:
            continue
        if date_value(policy.get("applicationDeadline")) and date_value(policy["applicationDeadline"]) < today:
            continue
        if not timely(policy, today) or policy["universality"] < 3:
            continue
        sent = db.execute("SELECT reminder,sent_at FROM sent WHERE recipient_id=? AND policy_id=? AND facts_version=? ORDER BY reminder DESC LIMIT 1",
                          (recipient, policy["id"], policy["factsVersion"])).fetchone()
        reminder = 0
        if sent:
            deadline = date_value(policy.get("applicationDeadline"))
            if not deadline or sent["reminder"] >= 1 or not 0 <= (deadline - today).days <= 7:
                continue
            if now_utc() - datetime.fromisoformat(sent["sent_at"]) < timedelta(days=7):
                continue
            reminder = 1
        u = urgency(policy, today, req.get("needsCertification") is True)
        p = priority(u, policy["benefitImpact"])
        if not p:
            continue
        response = {
            "policyId": policy["id"], "title": policy["title"], "sourceInstitution": policy["institution"],
            "originalUrl": policy["sourceUrl"], "region": policy["region"], "publishedAt": policy["publishedAt"],
            "effectiveAt": policy["effectiveAt"], "expiresAt": policy["expiresAt"],
            "applicationDeadline": policy["applicationDeadline"], "category": policy["category"],
            "audience": policy["audience"], "benefitChange": policy["benefitChange"],
            "actionRequired": policy["actionRequired"], "actionUrgency": u, "benefitImpact": policy["benefitImpact"],
            "priority": p, "smsText": sms(policy), "evidence": policy["evidence"],
            "expiresAtDerived": policy["expiresAtDerived"], "policyStatus": policy["policyStatus"],
            "reminder": bool(reminder),
        }
        candidates.append((u, policy["benefitImpact"], policy["publishedAt"], response, policy, reminder))
    candidates.sort(key=lambda entry: (entry[0], entry[1], entry[2]), reverse=True)
    messages = []
    for _, _, _, response, policy, reminder in candidates[:3]:
        token = hashlib.sha256(f"{recipient}|{policy['id']}|{policy['factsVersion']}|{reminder}".encode()).hexdigest()[:24]
        db.execute("INSERT OR IGNORE INTO proposals VALUES (?,?,?,?,?,?)",
                   (token, recipient, policy["id"], policy["factsVersion"], reminder, now_utc().isoformat()))
        response["deliveryId"] = token
        messages.append(response)
    if commit:
        db.commit()
    return {"generatedAt": now_utc().isoformat(), "region": region, "count": len(messages), "messages": messages}


def ack(db: sqlite3.Connection, req: dict) -> dict:
    token = str(req.get("deliveryId", ""))
    recipient = recipient_key(str(req.get("recipientId", "")))
    proposal = db.execute("SELECT * FROM proposals WHERE delivery_id=? AND recipient_id=?", (token, recipient)).fetchone()
    if not proposal:
        raise ValueError("unknown deliveryId for recipient")
    db.execute("INSERT OR IGNORE INTO sent VALUES (?,?,?,?,?)",
               (recipient, proposal["policy_id"], proposal["facts_version"], proposal["reminder"], now_utc().isoformat()))
    db.commit()
    return {"acknowledged": True, "policyId": proposal["policy_id"], "deliveryId": token}


def _required_text(req: dict, key: str, max_length: int = 256) -> str:
    value = str(req.get(key, "")).strip()
    if not value or len(value) > max_length:
        raise ValueError(f"{key} is required")
    return value


def upsert_subscription(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    sp_user_ref = _required_text(req, "spUserRef", 128)
    conversation_id = _required_text(req, "conversationId", 128)
    region = _required_text(req, "region", 64)
    age = req.get("age")
    if age is not None and (not isinstance(age, int) or isinstance(age, bool) or age < 0 or age > 120):
        raise ValueError("age must be an integer from 0 to 120")
    local_hukou = req.get("localHukou")
    if not isinstance(local_hukou, bool):
        raise ValueError("localHukou must be boolean")
    needs_certification = req.get("needsCertification", False)
    if not isinstance(needs_certification, bool):
        raise ValueError("needsCertification must be boolean")
    updated_at = now_utc().isoformat()
    db.execute(
        """INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(recipient_id) DO UPDATE SET
          sp_user_ref=excluded.sp_user_ref,
          conversation_id=excluded.conversation_id,
          region=excluded.region,
          age=excluded.age,
          local_hukou=excluded.local_hukou,
          needs_certification=excluded.needs_certification,
          enabled=1,
          updated_at=excluded.updated_at""",
        (recipient_id, sp_user_ref, conversation_id, region, age, int(local_hukou),
         int(needs_certification), 1, updated_at),
    )
    db.commit()
    return {
        "enabled": True,
        "region": region,
        "conversationSuffix": conversation_id[-6:],
        "updatedAt": updated_at,
    }


def subscription_status(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    sp_user_ref = str(req.get("spUserRef", "")).strip()
    row = db.execute("SELECT * FROM subscriptions WHERE recipient_id=? AND enabled=1", (recipient_id,)).fetchone()
    if not row or (sp_user_ref and not hmac.compare_digest(row["sp_user_ref"], sp_user_ref)):
        return {"enabled": False, "region": "天津市", "schedule": "每天 09:00"}
    latest = db.execute(
        "SELECT status,submitted_at,last_error,updated_at FROM push_batches WHERE recipient_id=? ORDER BY updated_at DESC LIMIT 1",
        (recipient_id,),
    ).fetchone()
    return {
        "enabled": True,
        "region": row["region"],
        "schedule": "每天 09:00",
        "conversationSuffix": row["conversation_id"][-6:],
        "lastPushAt": latest["submitted_at"] if latest else None,
        "lastOutcome": latest["status"].lower() if latest else None,
    }


def delete_subscription(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    sp_user_ref = _required_text(req, "spUserRef", 128)
    row = db.execute("SELECT sp_user_ref FROM subscriptions WHERE recipient_id=?", (recipient_id,)).fetchone()
    if row and hmac.compare_digest(row["sp_user_ref"], sp_user_ref):
        db.execute("DELETE FROM subscriptions WHERE recipient_id=?", (recipient_id,))
        db.commit()
    return {"enabled": False}


def _batch_payload(row: sqlite3.Row, subscription: sqlite3.Row) -> dict:
    return {
        "status": "claimed",
        "batchId": row["batch_id"],
        "marker": row["marker"],
        "messages": json.loads(row["messages"]),
        "subscription": {
            "spUserRef": subscription["sp_user_ref"],
            "conversationId": subscription["conversation_id"],
            "region": subscription["region"],
        },
    }


def claim_push(db: sqlite3.Connection, req: dict, today: date | None = None) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    run_id = _required_text(req, "runId", 128)
    trigger_kind = str(req.get("trigger", "cron")).strip()
    if trigger_kind not in ("cron", "manual"):
        raise ValueError("trigger must be cron or manual")
    now = now_utc()
    db.execute("BEGIN IMMEDIATE")
    subscription = db.execute(
        "SELECT * FROM subscriptions WHERE recipient_id=? AND enabled=1", (recipient_id,),
    ).fetchone()
    if not subscription:
        db.commit()
        return {"status": "not_subscribed"}
    if trigger_kind == "manual":
        latest_manual = db.execute(
            "SELECT claimed_at FROM push_batches WHERE recipient_id=? AND trigger_kind='manual' ORDER BY claimed_at DESC LIMIT 1",
            (recipient_id,),
        ).fetchone()
        if latest_manual:
            elapsed = (now - datetime.fromisoformat(latest_manual["claimed_at"])).total_seconds()
            if elapsed < MANUAL_COOLDOWN_SECONDS:
                db.commit()
                return {"status": "cooldown", "retryAfterSeconds": max(1, int(MANUAL_COOLDOWN_SECONDS - elapsed))}
    pending = db.execute(
        "SELECT * FROM push_batches WHERE recipient_id=? AND status IN ('CLAIMED','FAILED') ORDER BY claimed_at DESC LIMIT 1",
        (recipient_id,),
    ).fetchone()
    if pending:
        lease_expired = datetime.fromisoformat(pending["lease_expires_at"]) <= now
        if pending["lease_owner"] != run_id and not lease_expired:
            db.commit()
            return {"status": "busy"}
        lease_expires = (now + timedelta(minutes=BATCH_LEASE_MINUTES)).isoformat()
        db.execute(
            "UPDATE push_batches SET status='CLAIMED',lease_owner=?,lease_expires_at=?,attempt_count=attempt_count+1,updated_at=? WHERE batch_id=?",
            (run_id, lease_expires, now.isoformat(), pending["batch_id"]),
        )
        db.commit()
        refreshed = db.execute("SELECT * FROM push_batches WHERE batch_id=?", (pending["batch_id"],)).fetchone()
        return _batch_payload(refreshed, subscription)
    profile = {
        "recipientId": recipient_id,
        "region": subscription["region"],
        "age": subscription["age"],
        "localHukou": bool(subscription["local_hukou"]),
        "needsCertification": bool(subscription["needs_certification"]),
    }
    result = pull(db, profile, today=today, commit=False)
    if not result["messages"]:
        db.commit()
        return {"status": "no_new"}
    delivery_ids = [message["deliveryId"] for message in result["messages"]]
    batch_seed = "|".join([recipient_id, *delivery_ids])
    batch_id = hashlib.sha256(batch_seed.encode()).hexdigest()[:24]
    marker = f"CARELINK_POLICY_PUSH:{batch_id}"
    lease_expires = (now + timedelta(minutes=BATCH_LEASE_MINUTES)).isoformat()
    db.execute(
        "INSERT INTO push_batches VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (batch_id, recipient_id, marker, json.dumps(delivery_ids),
         json.dumps(result["messages"], ensure_ascii=False), "CLAIMED", trigger_kind, run_id,
         lease_expires, 1, now.isoformat(), None, None, None, now.isoformat()),
    )
    db.commit()
    row = db.execute("SELECT * FROM push_batches WHERE batch_id=?", (batch_id,)).fetchone()
    return _batch_payload(row, subscription)


def complete_push(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    batch_id = _required_text(req, "batchId", 128)
    run_id = _required_text(req, "runId", 128)
    user_event_id = str(req.get("userEventId", "")).strip() or None
    db.execute("BEGIN IMMEDIATE")
    row = db.execute(
        "SELECT * FROM push_batches WHERE batch_id=? AND recipient_id=?", (batch_id, recipient_id),
    ).fetchone()
    if not row:
        db.rollback()
        raise ValueError("unknown push batch")
    if row["status"] == "COMPLETED":
        db.commit()
        return {"completed": True, "batchId": batch_id, "idempotent": True}
    if row["lease_owner"] != run_id:
        db.rollback()
        raise ValueError("push batch lease mismatch")
    recipient = recipient_key(recipient_id)
    for token in json.loads(row["delivery_ids"]):
        proposal = db.execute(
            "SELECT * FROM proposals WHERE delivery_id=? AND recipient_id=?", (token, recipient),
        ).fetchone()
        if not proposal:
            db.rollback()
            raise ValueError("unknown deliveryId for recipient")
        db.execute(
            "INSERT OR IGNORE INTO sent VALUES (?,?,?,?,?)",
            (recipient, proposal["policy_id"], proposal["facts_version"], proposal["reminder"], now_utc().isoformat()),
        )
    completed_at = now_utc().isoformat()
    db.execute(
        "UPDATE push_batches SET status='COMPLETED',submitted_at=?,user_event_id=?,last_error=NULL,updated_at=? WHERE batch_id=?",
        (completed_at, user_event_id, completed_at, batch_id),
    )
    db.commit()
    return {"completed": True, "batchId": batch_id, "idempotent": False}


def fail_push(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    batch_id = _required_text(req, "batchId", 128)
    run_id = _required_text(req, "runId", 128)
    error_category = str(req.get("errorCategory", "upstream"))[:64]
    now = now_utc().isoformat()
    changed = db.execute(
        "UPDATE push_batches SET status='FAILED',lease_expires_at=?,last_error=?,updated_at=? WHERE batch_id=? AND recipient_id=? AND lease_owner=? AND status!='COMPLETED'",
        (now, error_category, now, batch_id, recipient_id, run_id),
    ).rowcount
    db.commit()
    if not changed:
        raise ValueError("unknown push batch or lease mismatch")
    return {"failed": True, "batchId": batch_id}


def reset_recipient(db: sqlite3.Connection, req: dict) -> dict:
    recipient_id = _required_text(req, "recipientId", 128)
    sp_user_ref = str(req.get("spUserRef", "")).strip()
    subscription = db.execute("SELECT sp_user_ref FROM subscriptions WHERE recipient_id=?", (recipient_id,)).fetchone()
    if subscription and sp_user_ref and not hmac.compare_digest(subscription["sp_user_ref"], sp_user_ref):
        raise ValueError("subscription identity mismatch")
    recipient = recipient_key(recipient_id)
    db.execute("DELETE FROM subscriptions WHERE recipient_id=?", (recipient_id,))
    db.execute("DELETE FROM push_batches WHERE recipient_id=?", (recipient_id,))
    db.execute("DELETE FROM proposals WHERE recipient_id=?", (recipient,))
    db.execute("DELETE FROM sent WHERE recipient_id=?", (recipient,))
    db.commit()
    return {"reset": True}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        configured = os.environ.get("POLICY_API_KEY", "")
        return not configured or hmac.compare_digest(self.headers.get("X-API-Key", ""), configured)

    def do_GET(self) -> None:
        if self.path == "/openapi.json":
            self.reply(200, json.loads((ROOT / "openapi.json").read_text(encoding="utf-8")))
            return
        if self.path != "/health":
            self.reply(404, {"error": "not found"})
            return
        with connect() as db:
            count = db.execute("SELECT COUNT(*) FROM policies").fetchone()[0]
        self.reply(200, {"status": "ok", "verifiedPolicies": count})

    def do_POST(self) -> None:
        if not self.authorized():
            self.reply(401, {"error": "unauthorized"})
            return
        routes = {
            "/v1/admin/crawl": lambda db, req: crawl(db),
            "/v1/openhex/policies/pull": pull,
            "/v1/openhex/policies/ack": ack,
            "/v1/openhex/subscriptions/upsert": upsert_subscription,
            "/v1/openhex/subscriptions/status": subscription_status,
            "/v1/openhex/subscriptions/delete": delete_subscription,
            "/v1/openhex/push/claim": claim_push,
            "/v1/openhex/push/complete": complete_push,
            "/v1/openhex/push/fail": fail_push,
            "/v1/admin/reset-recipient": reset_recipient,
        }
        if self.path not in routes:
            self.reply(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 16_384 or length < 0:
                raise ValueError("request too large")
            req = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(req, dict):
                raise ValueError("JSON object required")
            with connect() as db:
                result = routes[self.path](db, req)
            self.reply(200, result)
        except (ValueError, json.JSONDecodeError) as exc:
            self.reply(400, {"error": str(exc)})
        except Exception:
            self.reply(500, {"error": "internal error"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Anxu official eldercare policy service")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("crawl")
    sub.add_parser("review-queue")
    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    serve.add_argument("--refresh-hours", type=float, default=0)
    args = parser.parse_args()
    if args.command == "crawl":
        with connect() as db:
            print(json.dumps(crawl(db), ensure_ascii=False, indent=2))
    elif args.command == "review-queue":
        with connect() as db:
            rows = db.execute("SELECT url,title,region,discovered_at FROM discovered ORDER BY discovered_at DESC").fetchall()
            print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))
    else:
        if args.host not in ("127.0.0.1", "localhost", "::1") and not os.environ.get("POLICY_API_KEY"):
            parser.error("POLICY_API_KEY is required when binding a non-local address")
        def refresh_loop() -> None:
            while True:
                try:
                    with connect() as db:
                        result = crawl(db)
                    print("crawl: " + json.dumps(result, ensure_ascii=False), flush=True)
                except Exception as exc:
                    print(f"crawl failed: {exc}", flush=True)
                threading.Event().wait(args.refresh_hours * 3600)
        if args.refresh_hours > 0:
            threading.Thread(target=refresh_loop, daemon=True).start()
        print(f"Policy API listening on http://{args.host}:{args.port}", flush=True)
        ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
