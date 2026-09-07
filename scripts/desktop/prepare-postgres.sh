#!/bin/bash
# Builds a minimal relocatable PostgreSQL runtime for the Electron macOS
# edition (Apple Silicon only). Output lands in .desktop-stage/postgres/.
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "error: postgres:prepare supports macOS only (uname -s = $(uname -s))" >&2
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "error: postgres:prepare supports Apple Silicon only (uname -m = $(uname -m))" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE="$REPO_ROOT/.desktop-stage/postgres"
MANIFEST="$REPO_ROOT/desktop/release-manifest.json"

VERSION="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['postgresql']['version'])")"
URL="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['postgresql']['url'])")"
SHA="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['postgresql']['sha256'])")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "downloading postgresql-$VERSION ..."
curl -sSL -o "$WORK/postgresql.tar.bz2" "$URL"
echo "$SHA  $WORK/postgresql.tar.bz2" | shasum -a 256 --check -

tar -xf "$WORK/postgresql.tar.bz2" -C "$WORK"
SRC="$WORK/postgresql-$VERSION"

cd "$SRC"
./configure \
  --prefix="$STAGE" \
  --without-readline \
  --without-zlib \
  --without-icu \
  --disable-nls \
  --with-system-tzdata=/usr/share/zoneinfo \
  >/tmp/pg-configure.log 2>&1 || { tail -30 /tmp/pg-configure.log; exit 1; }

make -j"$(sysctl -n hw.ncpu)" >/tmp/pg-build.log 2>&1 || { tail -30 /tmp/pg-build.log; exit 1; }
make install >/tmp/pg-install.log 2>&1 || { tail -30 /tmp/pg-install.log; exit 1; }

# Prune to the runtime closure: keep only the executables the desktop
# lifecycle needs, required libraries, timezone/server catalog data,
# extension files, and the license. Drop headers, docs, and static libs.
cd "$STAGE"
mkdir -p bin-keep
for exe in postgres initdb pg_ctl createdb psql; do
  mv "bin/$exe" bin-keep/ 2>/dev/null || true
done
rm -rf bin include lib/postgresql/pgxs share/doc share/man lib/pkgconfig lib/*.a lib/*.la
mkdir -p bin
mv bin-keep/* bin/
rmdir bin-keep

cp "$SRC/COPYRIGHT" "$STAGE/COPYRIGHT"

echo "staged PostgreSQL $VERSION at $STAGE"
"$STAGE/bin/postgres" --version
