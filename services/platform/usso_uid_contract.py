"""Validate the configured USSO UID field before resolving an Account."""

from dataclasses import dataclass
import json
import re

MAX_UID_LENGTH = 255


@dataclass(frozen=True)
class UssoUidContract:
    field: str
    value_type: str
    pattern: re.Pattern
    allow_new_accounts: bool

    def read_uid(self, user):
        """只读约定字段，保留字符串原值以精确匹配已存账户键。"""
        if not isinstance(user, dict):
            return None
        value = user.get(self.field)
        if type(value) is int and self.value_type in {"integer", "string_or_integer"}:
            # 在转成十进制文本前限制整数大小，避免处理远超存储上限的输入。
            if value.bit_length() > MAX_UID_LENGTH * 4:
                return None
            value = str(value)
        elif not isinstance(value, str) or self.value_type == "integer":
            return None
        return value if self._matches_uid_text(value) else None

    def matches_stored_uid(self, value):
        """Check a persisted TEXT key without guessing which provider field supplied it."""
        if not self._matches_uid_text(value):
            return False
        if self.value_type != "integer":
            return True
        try:
            return str(int(value)) == value
        except ValueError:
            return False

    def _matches_uid_text(self, value):
        return (isinstance(value, str) and 0 < len(value) <= MAX_UID_LENGTH
                and value.isprintable() and value.strip() == value
                and self.pattern.fullmatch(value) is not None)


def parse_usso_uid_contract(raw):
    """An absent or invalid deployment policy leaves the OAuth entry unavailable."""
    try:
        config = json.loads(raw)
        if not isinstance(config, dict) or set(config) - {
            "field", "value_type", "pattern", "allow_new_accounts",
        }:
            return None
        field = config.get("field")
        value_type = config.get("value_type")
        pattern = config.get("pattern")
        allow_new_accounts = config.get("allow_new_accounts", False)
        if (field not in ("id", "sub", "social_uid")
                or value_type not in ("string", "integer", "string_or_integer")
                or not isinstance(pattern, str) or not pattern
                or type(allow_new_accounts) is not bool):
            return None
        return UssoUidContract(field, value_type, re.compile(pattern), allow_new_accounts)
    except (ValueError, TypeError, re.error, RecursionError, OverflowError):
        return None
