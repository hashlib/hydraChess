"""Initial migration

Revision ID: 8cd23c3fe7f7
Revises: 
Create Date: 2020-04-03 05:22:50.957160

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8cd23c3fe7f7'
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
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id'),
    sa.UniqueConstraint('login')
    )
    op.create_table('games',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_white_pieces_id', sa.Integer(), nullable=True),
    sa.Column('user_black_pieces_id', sa.Integer(), nullable=True),
    sa.Column('fen', sa.String(), nullable=True),
    sa.Column('is_started', sa.Boolean(), nullable=True),
    sa.Column('is_finished', sa.Boolean(), nullable=True),
    sa.Column('result', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['user_black_pieces_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['user_white_pieces_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id')
    )
    op.create_table('celery_tasks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('type_id', sa.Integer(), nullable=False),
    sa.Column('game_id', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('eta', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], ),
    sa.ForeignKeyConstraint(['type_id'], ['celery_task_types.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id', 'type_id'),
    sa.UniqueConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('celery_tasks')
    op.drop_table('games')
    op.drop_table('users')
    op.drop_table('celery_task_types')
    # ### end Alembic commands ###