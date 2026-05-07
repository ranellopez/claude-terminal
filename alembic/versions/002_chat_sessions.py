"""add chat_sessions table

Revision ID: 002
Revises: 001
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.Text()),
        sa.Column("messages_json", sa.Text(), server_default="[]"),
        sa.Column("is_ready", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.Text()),
        sa.Column("updated_at", sa.Text()),
    )


def downgrade():
    op.drop_table("chat_sessions")
