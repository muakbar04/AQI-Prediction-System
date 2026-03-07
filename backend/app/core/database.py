from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create the SQLAlchemy engine.
# pool_pre_ping=True ensures the connection is still active before executing a query, 
# which is particularly useful for remote databases like Supabase.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for our classes definitions
Base = declarative_base()

# Dependency to get a database session for FastAPI routes
def get_db():
    """
    Yields a database session to be used in a request, 
    and ensures it is closed when the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()