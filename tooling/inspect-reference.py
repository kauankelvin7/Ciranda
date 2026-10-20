"""Read-only inventory of PE headers. Never executes/unpacks the reference."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import struct
import sys

root = Path(__file__).resolve().parent.parent
target = Path(sys.argv[1]).resolve(strict=True)
started = datetime.datetime.now(datetime.timezone.utc).isoformat()

def digest_file(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

before = target.stat()
initial_hash = digest_file(target)
with target.open('rb') as stream:
    def read(offset, size):
        if offset < 0 or size < 0 or offset + size > before.st_size:
            raise ValueError('PE metadata outside file bounds')
        stream.seek(offset)
        data = stream.read(size)
        if len(data) != size:
            raise ValueError('Truncated metadata')
        return data

    def u16(offset):
        return struct.unpack('<H', read(offset, 2))[0]

    def u32(offset):
        return struct.unpack('<I', read(offset, 4))[0]

    if read(0, 2) != b'MZ':
        raise ValueError('Not an MZ executable')
    pe = u32(0x3c)
    if read(pe, 4) != b'PE\0\0':
        raise ValueError('Not a PE executable')
    machine = u16(pe + 4)
    count = u16(pe + 6)
    if count > 96:
        raise ValueError('Unexpected section count')
    optional_size = u16(pe + 20)
    optional = pe + 24
    magic = u16(optional)
    if magic not in (0x10b, 0x20b):
        raise ValueError('Unsupported optional header')
    directory_start = optional + (96 if magic == 0x10b else 112)
    directory_count = min(u32(directory_start - 4), 16)
    directories = [dict(rva=u32(directory_start + i * 8), size=u32(directory_start + i * 8 + 4)) for i in range(directory_count)]
    sections = []
    for i in range(count):
        offset = optional + optional_size + i * 40
        name = read(offset, 8).split(b'\0')[0].decode('ascii', 'replace')
        sections.append(dict(name=name, virtual_size=u32(offset + 8), virtual_address=u32(offset + 12), raw_size=u32(offset + 16), raw_offset=u32(offset + 20), characteristics=hex(u32(offset + 36))))

    def rva_offset(rva):
        for section in sections:
            start = section['virtual_address']
            if start <= rva < start + max(section['virtual_size'], section['raw_size']):
                return section['raw_offset'] + rva - start
        if rva < u32(optional + 60):
            return rva
        raise ValueError('RVA not mapped')

    imports = []
    if len(directories) > 1 and directories[1]['rva']:
        offset = rva_offset(directories[1]['rva'])
        for i in range(min(directories[1]['size'] // 20, 512)):
            item = struct.unpack('<IIIII', read(offset + 20 * i, 20))
            if not any(item):
                break
            name_offset = rva_offset(item[3])
            name = read(name_offset, min(256, before.st_size - name_offset)).split(b'\0')[0]
            imports.append(name.decode('ascii', 'replace'))
    resources = []
    if len(directories) > 2 and directories[2]['rva']:
        resource = rva_offset(directories[2]['rva'])
        entries = u16(resource + 12) + u16(resource + 14)
        for i in range(min(entries, 256)):
            value = u32(resource + 16 + i * 8)
            resources.append({'type_id': value if not value & 0x80000000 else None, 'named_type': bool(value & 0x80000000)})

    headers = dict(format='PE32' if magic == 0x10b else 'PE32+', machine=hex(machine), architecture={0x14c:'x86',0x8664:'x64',0xaa64:'ARM64'}.get(machine, 'unknown'), subsystem=u16(optional + 68), coff_timestamp_raw=u32(pe + 8), sections=sections, imports=imports, resource_types=resources, clr_directory=directories[14] if len(directories)>14 else None, certificate_directory=directories[4] if len(directories)>4 else None, overlay_bytes=before.st_size-max((s['raw_offset']+s['raw_size'] for s in sections),default=0))

final_hash = digest_file(target)
record = dict(kind='reference-pe-metadata', status='observed', path=str(target), bytes=before.st_size, sha256=initial_hash, sha256_after=final_hash, original_unchanged=initial_hash==final_hash, started_at_utc=started, finished_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), commit=os.environ.get('CIRANDA_EVIDENCE_COMMIT'), pe=headers, windows_metadata=json.loads(os.environ.get('CIRANDA_REFERENCE_METADATA','{}')), scope='Installer file metadata only. No execution, installation, unpacking, disassembly, code/assets extraction or upload. Installer architecture/imports do not establish the installed application framework or runtime architecture.')
destination = root / 'proofs' / 'mvp-regente'
destination.mkdir(parents=True, exist_ok=True)
filename = destination / ('maestri-inventory-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
content = (json.dumps(record, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
with filename.open('xb') as stream:
    stream.write(content)
with Path(str(filename)+'.sha256').open('x',encoding='utf-8') as stream:
    stream.write(hashlib.sha256(content).hexdigest()+'\n')
print(json.dumps({'artifact':str(filename),'sha256':initial_hash,'unchanged':record['original_unchanged'],'pe':headers},ensure_ascii=False))
