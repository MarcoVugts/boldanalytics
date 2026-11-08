# Local stand-in for MotherDuck's Postgres endpoint: serves a DuckDB file over the Postgres
# wire protocol and passes SQL through unchanged (DuckDB dialect, like MotherDuck).
#   python3 -m venv .duckenv && .duckenv/bin/pip install duckdb buenavista
#   .duckenv/bin/python scripts/local-duckdb-pg.py /tmp/bold.duckdb     # listens on :5433
# then set MD_LOCAL_URL=postgres://local@localhost:5433/local in .env.local
import sys

import duckdb
from buenavista import postgres
from buenavista.backends.duckdb import DuckDBConnection

db = duckdb.connect(sys.argv[1] if len(sys.argv) > 1 else ":memory:")
server = postgres.BuenaVistaServer(("127.0.0.1", 5433), DuckDBConnection(db))
print("DuckDB over Postgres wire on 127.0.0.1:5433", flush=True)
try:
    server.serve_forever()
finally:
    server.shutdown()
    db.close()
