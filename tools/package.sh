#!/bin/sh
# Builds out/Quantum Rift vX.Y.Z.zip with everything inside a "Quantum Rift vX.Y.Z" folder. Run from the quantum-rift folder.
# 2.6: if the zip would pass 28 MB, it is split: part 1 is the game, and the ship sprite sheets
# (client/assets/ships/*.webp) follow in as many parts as needed, each under 28 MB. Every part unzips into the same
# "Quantum Rift vX.Y.Z" folder.
set -e
V=$(git show HEAD:package.json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>console.log(JSON.parse(s).version))'); NAME="Quantum Rift v$V"; OUT=$(cd "${1:-..}" && pwd)/out; STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir -p "$STAGE/$NAME" "$OUT"
# Only committed source: never ship .git, local saves, credentials, or dependencies.
git archive --format=tar --output="$STAGE/source.tar" HEAD
tar -xf "$STAGE/source.tar" -C "$STAGE/$NAME"
rm -f "$OUT/$NAME.zip" "$OUT/$NAME part "*.zip
(cd "$STAGE" && zip -qr -9 "$OUT/$NAME.zip" "$NAME")
if [ "$(wc -c < "$OUT/$NAME.zip")" -gt 28000000 ]; then
  rm -f "$OUT/$NAME.zip"
  # group the ship sheets into lists of at most 27 MB each
  (cd "$STAGE" && node -e '
    const fs = require("fs"), d = process.argv[1] + "/client/assets/ships/", groups = [[]]; let n = 0;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith(".webp")).sort()) { const s = fs.statSync(d + f).size; if (n + s > 27e6) { groups.push([]); n = 0; } groups.at(-1).push(process.argv[1] + "/client/assets/ships/" + f); n += s; }
    groups.forEach((g, i) => fs.writeFileSync(`ships.part${i}`, g.join("\n") + "\n")); console.log(groups.length);' "$NAME" > parts.n)
  P=$(( $(cat "$STAGE/parts.n") + 1 ))
  (cd "$STAGE" && zip -qr -9 "$OUT/$NAME part 1 of $P.zip" "$NAME" -x "$NAME/client/assets/ships/*.webp")
  echo "$OUT/$NAME part 1 of $P.zip"
  i=0; while [ $i -lt $((P - 1)) ]; do
    (cd "$STAGE" && zip -q -0 "$OUT/$NAME part $((i + 2)) of $P.zip" -@ < "ships.part$i"); echo "$OUT/$NAME part $((i + 2)) of $P.zip"; i=$((i + 1))
  done
else
  echo "$OUT/$NAME.zip"
fi
rm -rf "$STAGE"
