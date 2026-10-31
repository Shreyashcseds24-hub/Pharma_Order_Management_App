import click
from flask.cli import with_appcontext

from .extensions import db
from .seed import seed_database


def register_cli(app):
    @app.cli.command("seed")
    @click.option("--reset", is_flag=True, help="Drop every table before seeding (destructive).")
    @with_appcontext
    def seed_command(reset):
        """Load the demo dataset into the configured database."""
        try:
            seed_database(reset=reset)
        except RuntimeError as error:
            raise click.ClickException(str(error))
        click.echo("Demo dataset loaded.")

    @app.cli.command("init-db")
    @with_appcontext
    def init_db_command():
        """Create tables without migrations (useful for a quick local SQLite run)."""
        db.create_all()
        click.echo("Tables created.")
