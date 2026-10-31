import re

import click
from flask.cli import with_appcontext
from werkzeug.security import generate_password_hash

from .extensions import db
from .models import Role, User
from .seed import seed_database
from .utils import initials_for, next_business_id

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def register_cli(app):
    @app.cli.command("seed")
    @click.option("--reset", is_flag=True, help="Drop every table before seeding (destructive).")
    @with_appcontext
    def seed_command(reset):
        """Load the demo dataset into the configured database (explicit opt-in)."""
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

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True, help="Administrator email address.")
    @click.option(
        "--password",
        prompt=True,
        hide_input=True,
        confirmation_prompt=True,
        help="Password (at least 8 characters).",
    )
    @click.option("--name", prompt=True, help="Full name.")
    @click.option("--title", default="Administrator", show_default=True)
    @with_appcontext
    def create_admin_command(email, password, name, title):
        """Create a single administrator without loading demo data."""
        email = str(email).strip().lower()
        name = str(name).strip()
        if not EMAIL_RE.match(email):
            raise click.ClickException("Enter a valid email address.")
        if len(name) < 3:
            raise click.ClickException("Enter at least 3 characters for the name.")
        if len(password) < 8:
            raise click.ClickException("Use a password with at least 8 characters.")

        role = Role.query.filter_by(name="admin").first()
        if role is None:
            raise click.ClickException(
                "Admin role not found. Run `flask --app run.py db upgrade` first."
            )
        if User.query.filter(db.func.lower(User.email) == email).first():
            raise click.ClickException("An account with this email already exists.")

        user = User(
            id=next_business_id("user", "USR", 3),
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            title=str(title or "Administrator").strip()[:120] or "Administrator",
            initials=initials_for(name),
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
        click.echo(f"Administrator created: {email}")
