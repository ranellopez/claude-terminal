"""tag chat_sessions with bot name

Revision ID: 003
Revises: 002
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chat_sessions",
        sa.Column("bot", sa.Text(), server_default="gymbot", nullable=False),
    )


def downgrade():
    op.drop_column("chat_sessions", "bot")
