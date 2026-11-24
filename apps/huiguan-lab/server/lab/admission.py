"""Single-gateway admission reservations and durable priority-code redemption."""
import time
from dataclasses import dataclass

from .auth import RateLimiter, normalize


@dataclass
class Ticket:
    state: str
    expires: float
    sequence: int
    proof: str = ""
    lease: object = None
    reconnect_used: bool = False
    legacy: bool = False


class Admission:
    WAIT = 60
    READY = 25
    RECONNECT = 8

    def __init__(self, capacity, max_waiters, auth, *, legacy_players=False, clock=time.monotonic):
        self.capacity, self.max_waiters, self.auth, self.clock = capacity, max_waiters, auth, clock
        self.tickets = {}
        self.legacy_players = legacy_players
        self.sequence = 0
        self.limiter = RateLimiter()
        auth.store.exec("""CREATE TABLE IF NOT EXISTS admission_priority_claims (
            test_code_id TEXT PRIMARY KEY REFERENCES codes(id) ON DELETE CASCADE,
            account_code_id TEXT NOT NULL UNIQUE REFERENCES codes(id) ON DELETE CASCADE
        )""")

    def prove(self, principal, code, address):
        """Priority only: no login/session mint, staff role, usage write or save transfer."""
        if self.limiter.locked(address):
            return False
        store = self.auth.store
        with store.tx():
            row = (store.one("""SELECT id FROM codes
                                WHERE digest=? AND status='active' AND role='player'""",
                             (self.auth.code_digest(code),))
                   if 16 <= len(normalize(code)) <= 24 else None)
            if row and row["id"].startswith("c_"):
                proof = row["id"]
                owner = store.one("SELECT code_id FROM account_links WHERE code_id=?", (proof,))
                if (owner and owner["code_id"] == principal) or (not owner and not self.legacy_players):
                    store.exec("INSERT OR IGNORE INTO admission_priority_claims VALUES(?,?)", (proof, principal))
                    if self._verified(principal, proof):
                        self.limiter.success(address)
                        return True
        self.limiter.fail(address)
        return False

    def _verified(self, principal, proof):
        return self.auth.store.one("""SELECT 1 FROM admission_priority_claims a JOIN codes c ON c.id=a.test_code_id
                    WHERE a.account_code_id=? AND a.test_code_id=? AND c.status='active' AND c.role='player'
                    AND NOT EXISTS(SELECT 1 FROM account_links l WHERE l.code_id=c.id AND l.code_id != a.account_code_id)""",
                                   (principal, proof)) is not None

    def legacy_available(self, principal):
        """Only an existing valid raw-code principal with no conflicting account lane."""
        if not self.legacy_players or not principal.startswith("c_"):
            return False
        return self.auth.store.one("""SELECT 1 FROM codes c WHERE c.id=? AND c.status='active'
                    AND c.role='player'
                    AND NOT EXISTS(SELECT 1 FROM account_links l WHERE l.code_id=c.id)
                    AND NOT EXISTS(SELECT 1 FROM admission_priority_claims a WHERE a.test_code_id=c.id)""",
                                   (principal,)) is not None

    def _proof(self, principal):
        row = self.auth.store.one("SELECT test_code_id FROM admission_priority_claims WHERE account_code_id=?",
                                  (principal,))
        return row["test_code_id"] if row and self._verified(principal, row["test_code_id"]) else ""

    def _rank(self):
        return sorted(((key, ticket) for key, ticket in self.tickets.items() if ticket.state == "queued"),
                      key=lambda item: (not bool(item[1].proof), item[1].sequence))

    def _advance(self):
        now = self.clock()
        for key, ticket in list(self.tickets.items()):
            if ticket.state not in ("starting", "playing") and ticket.expires <= now:
                del self.tickets[key]
            elif ticket.state == "queued" and ticket.legacy and not self.legacy_available(key):
                del self.tickets[key]
            elif ticket.state == "queued" and ticket.proof and not ticket.legacy and not self._verified(key, ticket.proof):
                ticket.proof = ""
        free = max(0, self.capacity - sum(t.state != "queued" for t in self.tickets.values()))
        for _, ticket in self._rank()[:free]:
            ticket.state, ticket.expires = "ready", now + self.READY

    def status(self, principal, *, touch=False):
        self._advance()
        ticket = self.tickets.get(principal)
        if ticket is None:
            return {"state": "idle"}
        if ticket.state == "queued":
            if touch:
                ticket.expires = self.clock() + self.WAIT
            position = next(i for i, (key, _) in enumerate(self._rank(), 1) if key == principal)
            return {"state": "queued", "position": position, "retry_after": 3}
        if ticket.state == "starting":
            return {"state": "playing"}
        return {"state": ticket.state}

    def join(self, principal, *, legacy=False):
        self._advance()
        if legacy and not self.legacy_available(principal):
            return {"state": "idle", "error": "legacy_admission_unavailable"}
        ticket = self.tickets.get(principal)
        if ticket is None:
            if len(self.tickets) >= self.capacity + self.max_waiters:
                return {"state": "full", "retry_after": 8}
            self.sequence += 1
            self.tickets[principal] = Ticket("queued", self.clock() + self.WAIT, self.sequence,
                                             principal if legacy else self._proof(principal), legacy=legacy)
        elif ticket.state == "queued" and not ticket.proof:
            proof = self._proof(principal)
            if proof:
                self.sequence += 1
                ticket.proof, ticket.sequence = proof, self.sequence
        return self.status(principal, touch=True)

    def begin(self, principal):
        self._advance()
        ticket = self.tickets.get(principal)
        if ticket is None or ticket.state != "ready":
            return None
        ticket.state, ticket.lease = "starting", object()
        return ticket.lease

    def confirm(self, principal, lease):
        ticket = self.tickets.get(principal)
        if ticket and ticket.lease is lease:
            ticket.state = "playing"

    def release(self, principal, lease, *, connected):
        ticket = self.tickets.get(principal)
        if not ticket or ticket.lease is not lease:
            return
        if connected and not ticket.reconnect_used:
            ticket.reconnect_used = True
            ticket.state, ticket.expires, ticket.lease = "ready", self.clock() + self.RECONNECT, None
        else:
            del self.tickets[principal]
        self._advance()

    def cancel(self, principal):
        ticket = self.tickets.get(principal)
        if ticket and ticket.state in ("queued", "ready"):
            del self.tickets[principal]
            self._advance()
