import json
from .base import db


class LoginAttempt(db.Model):
    __tablename__ = "login_attempt"

    id = db.Column(db.Integer, primary_key=True)
    rate_key = db.Column(db.String(255), unique=True, nullable=False, index=True)
    failure_timestamps = db.Column(db.Text, default="[]")
    blocked_until = db.Column(db.Float, default=0.0)

    def get_timestamps(self):
        try:
            return json.loads(self.failure_timestamps or "[]")
        except Exception:
            return []

    def set_timestamps(self, ts_list):
        self.failure_timestamps = json.dumps(ts_list)
