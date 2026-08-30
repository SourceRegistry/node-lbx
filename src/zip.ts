import AdmZip from 'adm-zip';
import { readFileSync } from 'node:fs';

/** Thin seam over the zip engine so it can be swapped (e.g. for jszip) without touching the rest of the library. */
export interface LbxArchive {
  listEntries(): string[];
  hasEntry(name: string): boolean;
  readText(name: string): string;
  readBinary(name: string): Buffer;
  writeText(name: string, content: string): void;
  writeBinary(name: string, content: Buffer): void;
  toBuffer(): Buffer;
}

class AdmZipArchive implements LbxArchive {
  constructor(private readonly zip: AdmZip) {}

  listEntries(): string[] {
    return this.zip.getEntries().map((e) => e.entryName);
  }

  hasEntry(name: string): boolean {
    return this.zip.getEntry(name) !== null;
  }

  readText(name: string): string {
    return this.readBinary(name).toString('utf-8');
  }

  readBinary(name: string): Buffer {
    const entry = this.zip.getEntry(name);
    if (!entry) throw new Error(`node-lbx: archive entry "${name}" not found`);
    const data = this.zip.readFile(entry);
    if (!data) throw new Error(`node-lbx: failed to read archive entry "${name}"`);
    return data;
  }

  writeText(name: string, content: string): void {
    this.writeBinary(name, Buffer.from(content, 'utf-8'));
  }

  writeBinary(name: string, content: Buffer): void {
    if (this.hasEntry(name)) this.zip.deleteFile(name);
    this.zip.addFile(name, content);
  }

  toBuffer(): Buffer {
    return this.zip.toBuffer();
  }
}

export function openArchive(source: string | Buffer): LbxArchive {
  const buffer = typeof source === 'string' ? readFileSync(source) : source;
  return new AdmZipArchive(new AdmZip(buffer));
}

export function createArchive(): LbxArchive {
  return new AdmZipArchive(new AdmZip());
}
