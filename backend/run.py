"""Development entry point.

    python run.py
    flask --app run.py seed

Production uses the WSGI server configured in the Docker image/entrypoint
(gunicorn). Debug defaults to off whenever ENVIRONMENT/FLASK_ENV=production.
"""

from app import create_app

app = create_app()


if __name__ == "__main__":
    app.run(
        host=app.config.get("HOST", "127.0.0.1"),
        port=app.config.get("PORT", 5000),
        debug=bool(app.config.get("DEBUG")),
    )
