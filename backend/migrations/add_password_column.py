"""
Simple database migration to add password_hash column to interviews table
Run this ONCE after updating your code
"""

import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), '..', 'interviews.db')

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if column exists
    cursor.execute("PRAGMA table_info(interviews)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'password_hash' not in columns:
        print("Adding password_hash column to interviews table...")
        cursor.execute("ALTER TABLE interviews ADD COLUMN password_hash VARCHAR(255)")
        conn.commit()
        print("✅ Migration completed successfully!")
    else:
        print("✅ password_hash column already exists. No migration needed.")
        
except Exception as e:
    print(f"❌ Error during migration: {e}")
    conn.rollback()
finally:
    conn.close()
