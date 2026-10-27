from flask import Flask

from backend.config import Config
from backend.database import init_db
from backend.routes import api


def create_app(test_config=None):
    app = Flask(
        __name__,
        instance_relative_config=True,
        template_folder="../templates",
        static_folder="../static",
        static_url_path="/static",
    )
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)

    init_db(app)
    app.register_blueprint(api, url_prefix="/api")

    from flask import render_template

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.errorhandler(413)
    def request_too_large(_error):
        from flask import jsonify

        return jsonify({"error": "Requests must be 2 MB or smaller."}), 413

    return app
