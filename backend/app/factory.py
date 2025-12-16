from flask import Flask, jsonify
from flask_cors import CORS
from api.routes import api

def create_app():
    app = Flask(__name__)
    app.config.from_object("config.Config")

    CORS(app)

    app.register_blueprint(api, url_prefix="/api")

    @app.route("/health")
    def health():
        return jsonify({"ok": True})

    return app
