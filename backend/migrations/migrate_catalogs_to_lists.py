"""
Database Migration: catalogs → lists

This script migrates the database from the old 'catalogs' naming to 'lists'.

Changes:
1. Rename table 'catalogs' to 'lists'
2. Rename column 'catalog_id' to 'list_id' in 'products' and 'processing_logs'
3. Update indexes

Run with: python migrations/migrate_catalogs_to_lists.py
"""
import sqlite3
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings

settings = get_settings()


def migrate():
    """Execute the migration from catalogs to lists."""
    
    # Get database path from URL
    db_url = settings.database_url
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
    else:
        print(f"This migration only supports SQLite. Current database: {db_url}")
        return False
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        print("The database will be created with the new schema automatically.")
        return True
    
    print(f"Migrating database: {db_path}")
    
    # Backup database
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    import shutil
    shutil.copy(db_path, backup_path)
    print(f"Backup created: {backup_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if migration is needed
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='catalogs';")
        if not cursor.fetchone():
            # Check if 'lists' table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lists';")
            if cursor.fetchone():
                print("Migration already complete. 'lists' table exists.")
                return True
            else:
                print("No 'catalogs' or 'lists' table found. Fresh database.")
                return True
        
        print("Starting migration...")
        
        # 1. Rename catalogs table to lists
        print("1. Renaming table 'catalogs' to 'lists'...")
        cursor.execute("ALTER TABLE catalogs RENAME TO lists;")
        
        # 2. Check if products table has catalog_id column
        cursor.execute("PRAGMA table_info(products);")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'catalog_id' in columns and 'list_id' not in columns:
            print("2. Renaming column 'catalog_id' to 'list_id' in products...")
            cursor.execute("ALTER TABLE products RENAME COLUMN catalog_id TO list_id;")
        elif 'list_id' in columns:
            print("2. Column 'list_id' already exists in products.")
        else:
            print("2. Neither catalog_id nor list_id found - skipping.")
        
        # 3. Check if processing_logs table has catalog_id column
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='processing_logs';")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(processing_logs);")
            log_columns = [col[1] for col in cursor.fetchall()]
            
            if 'catalog_id' in log_columns and 'list_id' not in log_columns:
                print("3. Renaming column 'catalog_id' to 'list_id' in processing_logs...")
                cursor.execute("ALTER TABLE processing_logs RENAME COLUMN catalog_id TO list_id;")
            elif 'list_id' in log_columns:
                print("3. Column 'list_id' already exists in processing_logs.")
            else:
                print("3. Neither catalog_id nor list_id found in processing_logs - skipping.")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        print(f"   Backup saved at: {backup_path}")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        print(f"   Restoring from backup...")
        conn.close()
        shutil.copy(backup_path, db_path)
        print(f"   Database restored from backup.")
        return False
        
    finally:
        conn.close()


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
