from models.base import db

# Centralized extension access point.
# Keeping db object reference stable avoids breaking existing models.
__all__ = ["db"]
