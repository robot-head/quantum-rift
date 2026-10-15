"""Verify split ZIPs against the committed Git tree, then extract for smoke tests."""
import hashlib
import io
import json
import pathlib
import subprocess
import sys
import tarfile
import zipfile

out = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
version = json.loads(subprocess.check_output(['git', 'show', 'HEAD:package.json']))['version']
root = f'Quantum Rift v{version}'
expected = {}
archive = subprocess.check_output(['git', 'archive', '--format=tar', 'HEAD'])
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    for member in source:
        if member.isfile():
            expected[f'{root}/{member.name}'] = hashlib.sha256(source.extractfile(member).read()).hexdigest()
actual = {}
zips = sorted(out.glob(f'{root}*.zip'))
assert zips, 'No release ZIPs found'
for filename in zips:
    assert filename.stat().st_size <= 28_000_000, f'Oversized ZIP: {filename}'
    with zipfile.ZipFile(filename) as package:
        assert package.testzip() is None, f'Corrupt ZIP: {filename}'
        for entry in package.infolist():
            name = pathlib.PurePosixPath(entry.filename)
            assert not name.is_absolute() and '..' not in name.parts and name.parts[0] == root
            if entry.is_dir():
                continue
            assert entry.filename not in actual, f'Duplicate entry: {entry.filename}'
            contents = package.read(entry)
            actual[entry.filename] = hashlib.sha256(contents).hexdigest()
            target = destination.joinpath(*name.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(contents)
assert actual == expected, 'ZIP payload differs from committed source tree'
print(f'Verified {len(zips)} ZIPs and {len(actual)} files against HEAD; extracted to {destination / root}')
