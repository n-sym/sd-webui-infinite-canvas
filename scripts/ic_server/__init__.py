# Infinite Canvas server package.
#
# WHY THIS EXISTS AS A SUBPACKAGE (not a flat file under scripts/):
#
# Forge's auto-loader scans the extension's `scripts/` directory for top-level
# *.py files and imports each one. If a module is ALSO imported by other code
# via `import scripts.<name>`, Python sees two import paths -> two separate
# module objects -> two singletons. That bit us hard with `api_routes.py`:
# the FastAPI router/WS endpoint lived on one `manager` instance while the
# autosave thread resolved another, so WS broadcasts silently went to a
# manager with zero connections.
#
# Forge's list_scripts() only walks top-level files (it skips directories via
# os.path.isfile), so anything inside this subpackage is invisible to the
# auto-loader. The only way to reach it is an explicit
# `import scripts.ic_server.api_routes`, which means exactly one module object
# and exactly one singleton — no more identity drift.
