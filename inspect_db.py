import sqlite3
import os
db = os.path.join("backend", "app.db")

if not os.path.exists(db):
    print("No DB file found at", db)
    raise SystemExit(1)

con = sqlite3.connect(db)
cur = con.cursor()

print("Tables:")
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table';"):
    print("  -", row[0])

print("\nReport table schema:")
for col in cur.execute("PRAGMA table_info(report);"):
    # (cid, name, type, notnull, dflt_value, pk)
    print(" ", col)

print("\nRows in report (id, title, lat, lon, image_filename, status, created_at):")
for row in cur.execute(
    "SELECT id, title, latitude, longitude, image_filename, status, created_at FROM report ORDER BY id DESC LIMIT 50;"
):
    print(" ", row)

con.close()
