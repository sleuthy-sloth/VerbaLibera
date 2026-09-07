#!/bin/bash
# Builds a minimal relocatable PostgreSQL runtime for the Electron macOS
# edition (Apple Silicon only), with OpenSSL built from pinned source and
# statically linked so remote TLS works with no system/Homebrew dependency.
# Output lands in .desktop-stage/postgres/.
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
SSL_VERSION="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['openssl']['version'])")"
SSL_URL="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['openssl']['url'])")"
SSL_SHA="$(python3 -c "import json;print(json.load(open('$MANIFEST'))['openssl']['sha256'])")"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "downloading openssl-$SSL_VERSION ..."
curl -sSL -o "$WORK/openssl.tar.gz" "$SSL_URL"
echo "$SSL_SHA  $WORK/openssl.tar.gz" | shasum -a 256 --check -

tar -xzf "$WORK/openssl.tar.gz" -C "$WORK"
cd "$WORK/openssl-$SSL_VERSION"
# Shared (not static): macOS rejects static libcrypto inside libpq
# (atexit refs trip libpq-refs-stamp). The dylibs ship beside postgres
# with an @loader_path rpath, so there is no system/Homebrew dependency.
./Configure darwin64-arm64-cc --prefix="$WORK/ssl" \
  >/tmp/openssl-configure.log 2>&1 || { tail -30 /tmp/openssl-configure.log; exit 1; }
make -j"$(sysctl -n hw.ncpu)" >/tmp/openssl-build.log 2>&1 || { tail -30 /tmp/openssl-build.log; exit 1; }
make install_sw >/tmp/openssl-install.log 2>&1 || { tail -30 /tmp/openssl-install.log; exit 1; }

echo "downloading postgresql-$VERSION ..."
curl -sSL -o "$WORK/postgresql.tar.bz2" "$URL"
echo "$SHA  $WORK/postgresql.tar.bz2" | shasum -a 256 --check -

tar -xf "$WORK/postgresql.tar.bz2" -C "$WORK"
SRC="$WORK/postgresql-$VERSION"

cd "$SRC"
CPPFLAGS="-I$WORK/ssl/include" LDFLAGS="-L$WORK/ssl/lib -Wl,-rpath,@loader_path/../lib -Wl,-rpath,@loader_path" ./configure \
  --prefix="$STAGE" \
  --with-ssl=openssl \
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
# Bundle the pinned OpenSSL runtime beside postgres (rpath above resolves it).
cp "$WORK/ssl/lib/libssl.3.dylib" "$WORK/ssl/lib/libcrypto.3.dylib" lib/
# The two OpenSSL libraries reference each other; give them a sibling rpath.
install_name_tool -add_rpath @loader_path lib/libssl.3.dylib
install_name_tool -add_rpath @loader_path lib/libcrypto.3.dylib
mkdir -p bin
mv bin-keep/* bin/
rmdir bin-keep
# Rewrite the throwaway build-tree SSL paths to @rpath (resolved by the
# @loader_path rpath above). Linking used absolute build paths so that
# configure/build-time test programs resolve while the tree exists.
for target in bin/* lib/*.dylib; do
  [ -f "$target" ] || continue
  for dep in "$WORK/ssl/lib/libssl.3.dylib" "$WORK/ssl/lib/libcrypto.3.dylib"; do
    if otool -L "$target" | grep -q "$dep"; then
      install_name_tool -change "$dep" "@rpath/$(basename "$dep")" "$target"
    fi
  done
done

cp "$SRC/COPYRIGHT" "$STAGE/COPYRIGHT"

echo "staged PostgreSQL $VERSION at $STAGE"
"$STAGE/bin/postgres" --version
