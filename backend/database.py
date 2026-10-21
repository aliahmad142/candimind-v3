from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings

settings = get_settings()

# Create SQLAlchemy engine
connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}
engine = create_engine(
    settings.database_url,
    connect_args=connect_args
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and run safe column migrations"""
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration for SQLite new columns
    if "sqlite" in settings.database_url:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Add columns to interview_results
            columns_to_add = [
                ("recording_video_path", "VARCHAR(500)"),
                ("recording_video_filename", "VARCHAR(255)"),
                ("recording_uploaded_at", "DATETIME"),
                ("integrity_summary", "JSON"),
                ("vapi_audio_url", "VARCHAR(1000)"),
                ("merged_video_path", "VARCHAR(500)"),
                ("audio_offset_ms", "FLOAT"),
                ("video_started_at_ms", "FLOAT"),
                ("vapi_started_at_ms", "FLOAT")
            ]
            for col_name, col_type in columns_to_add:
                try:
                    conn.execute(text(f"ALTER TABLE interview_results ADD COLUMN {col_name} {col_type}"))
                    print(f"➕ Added database column '{col_name}' to interview_results")
                except Exception:
                    pass  # Column already exists

            # Add category column to interviews table if missing
            try:
                conn.execute(text("ALTER TABLE interviews ADD COLUMN category VARCHAR(50) DEFAULT 'scholarship'"))
                conn.execute(text("UPDATE interviews SET category = 'scholarship' WHERE category IS NULL"))
                conn.commit()
                print("➕ Added database column 'category' to interviews table")
            except Exception:
                pass  # Column already exists

            # Auto-backfill vapi_audio_url for existing rows if raw_webhook_data is present
            try:
                import json
                from services.vapi_service import extract_vapi_audio_url
                cursor = conn.execute(text("SELECT id, raw_webhook_data FROM interview_results WHERE vapi_audio_url IS NULL AND raw_webhook_data IS NOT NULL"))
                rows = cursor.fetchall()
                for row_id, raw_data_str in rows:
                    if raw_data_str:
                        try:
                            data = json.loads(raw_data_str)
                            audio_url = extract_vapi_audio_url(data)
                            if audio_url:
                                conn.execute(
                                    text("UPDATE interview_results SET vapi_audio_url = :url WHERE id = :id"),
                                    {"url": audio_url, "id": row_id}
                                )
                                print(f"✨ Backfilled vapi_audio_url for interview_result #{row_id}")
                        except Exception as ex:
                            print(f"⚠️ Failed to backfill interview_result #{row_id}: {ex}")
            except Exception as e:
                print(f"⚠️ Backfill check notice: {e}")

            conn.commit()
