"""ai conversations and messages

Revision ID: f3a1c9d2b7e4
Revises: e7d5069faf7b
Create Date: 2026-11-19 00:00:00.000000

Additive migration for the LLM assistant. Existing tables and rows are not
touched, so it is safe to apply to a populated database.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3a1c9d2b7e4"
down_revision = "e7d5069faf7b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.String(length=30), nullable=False),
        sa.Column("user_id", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ai_conversations_user_id"),
        "ai_conversations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_conversations_last_message_at"),
        "ai_conversations",
        ["last_message_at"],
        unique=False,
    )

    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.String(length=30), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role IN ('user','assistant')", name="ck_ai_messages_role_valid"
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["ai_conversations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ai_messages_conversation_id"),
        "ai_messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_messages_created_at"),
        "ai_messages",
        ["created_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_ai_messages_created_at"), table_name="ai_messages")
    op.drop_index(op.f("ix_ai_messages_conversation_id"), table_name="ai_messages")
    op.drop_table("ai_messages")

    op.drop_index(
        op.f("ix_ai_conversations_last_message_at"), table_name="ai_conversations"
    )
    op.drop_index(
        op.f("ix_ai_conversations_user_id"), table_name="ai_conversations"
    )
    op.drop_table("ai_conversations")
