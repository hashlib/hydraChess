"""Initial migration

Revision ID: e930fad89f1e
Revises:
Create Date: 2020-04-04 20:10:16.393180

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'e930fad89f1e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('celery_task_types',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id')
    )
    op.execute("""INSERT INTO celery_task_types (id, name) VALUES
                  (0, 'ON_FIRST_MOVE_TIMED_OUT'),
                  (1, 'ON_DISCONNECT_TIMED_OUT'),
                  (2, 'ON_TIME_IS_UP')""")
    op.create_table('celery_tasks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type_id', sa.Integer(), nullable=False),
    sa.Column('game_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('eta', sqlite.DATETIME(), nullable=True),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], ),
    sa.ForeignKeyConstraint(['type_id'], ['celery_task_types.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id', 'type_id'),
    sa.UniqueConstraint('id')
    )
    op.create_table('game_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('time', sa.Time(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id')
    )
    op.create_table('games',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('white_user_id', sa.Integer(), nullable=True),
    sa.Column('black_user_id', sa.Integer(), nullable=True),
    sa.Column('fen', sa.String(), nullable=True),
    sa.Column('is_started', sa.Boolean(), nullable=True),
    sa.Column('is_finished', sa.Boolean(), nullable=True),
    sa.Column('white_clock', sa.Interval(), nullable=True),
    sa.Column('black_clock', sa.Interval(), nullable=True),
    sa.Column('last_move_datetime', sqlite.DATETIME(), nullable=True),
    sa.Column('result', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['black_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['white_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('login', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=True),
    sa.Column('games_played', sa.Integer(), nullable=True),
    sa.Column('k_factor', sa.Integer(), nullable=True),
    sa.Column('cur_game_id', sa.Integer(), nullable=True),
    sa.Column('in_search', sa.Boolean(), nullable=True),
    sa.Column('sid', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['cur_game_id'], ['games.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id'),
    sa.UniqueConstraint('login')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('users')
    op.drop_table('games')
    op.drop_table('game_requests')
    op.drop_table('celery_tasks')
    op.drop_table('celery_task_types')
    # ### end Alembic commands ###