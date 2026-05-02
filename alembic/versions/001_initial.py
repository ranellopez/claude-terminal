"""initial tables

Revision ID: 001
Revises:
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("goal", sa.Text()),
        sa.Column("gym_days", sa.Text()),
        sa.Column("rest_days", sa.Text()),
        sa.Column("meal_prep_day", sa.Text()),
        sa.Column("fitness_level", sa.Text()),
        sa.Column("equipment", sa.Text()),
        sa.Column("dietary_preference", sa.Text()),
        sa.Column("allergies", sa.Text()),
        sa.Column("daily_calorie_target", sa.Integer()),
        sa.Column("protein_target_g", sa.Integer()),
    )
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("week_start", sa.Text(), nullable=False, unique=True),
        sa.Column("plan_json", sa.Text()),
        sa.Column("created_at", sa.Text()),
    )
    op.create_table(
        "check_offs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("week_start", sa.Text()),
        sa.Column("day", sa.Text()),
        sa.Column("item_type", sa.Text()),
        sa.Column("item_name", sa.Text()),
        sa.Column("done", sa.Integer(), server_default="0"),
        sa.Column("nutrition_feedback", sa.Text()),
    )
    op.create_table(
        "custom_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_type", sa.Text()),
        sa.Column("data_json", sa.Text()),
    )


def downgrade():
    op.drop_table("custom_items")
    op.drop_table("check_offs")
    op.drop_table("weekly_plans")
    op.drop_table("profile")
