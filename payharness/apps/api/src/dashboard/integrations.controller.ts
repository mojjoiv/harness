import { Controller, Get, NotFoundException, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const PACKAGES = {
  woocommerce: 'woocommerce',
  joomla: 'joomla',
} as const;

type PackageName = keyof typeof PACKAGES;

export function integrationRoot(name: PackageName): string | undefined {
  const configuredRoot = process.env.PAYHARNESS_INTEGRATIONS_PATH?.trim();
  const candidates = [
    configuredRoot ? resolve(configuredRoot, PACKAGES[name]) : undefined,
    resolve(process.cwd(), 'integrations', PACKAGES[name]),
    resolve(process.cwd(), '..', 'integrations', PACKAGES[name]),
    resolve(__dirname, '../../../integrations', PACKAGES[name]),
    resolve(__dirname, '../../../../integrations', PACKAGES[name]),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate));
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function createZip(root: string): Buffer {
  const files: Array<{ name: string; data: Buffer; mtime: Date }> = [];

  function collect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        collect(fullPath);
      } else if (entry.isFile()) {
        files.push({
          name: relative(root, fullPath).split('\\').join('/'),
          data: readFileSync(fullPath),
          mtime: statSync(fullPath).mtime,
        });
      }
    }
  }

  collect(root);

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const { time, date } = dosDateTime(file.mtime);
    const crc = crc32(file.data);
    const local = Buffer.alloc(30 + name.length + file.data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    file.data.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard/integrations')
export class IntegrationsController {
  @Get(':integration/download')
  download(@Param('integration') integration: string) {
    if (!(integration in PACKAGES)) {
      throw new NotFoundException('Integration package not found');
    }

    const packageName = integration as PackageName;
    const root = integrationRoot(packageName);
    if (!root || !existsSync(root)) {
      throw new NotFoundException('Integration package is not available');
    }

    const archive = createZip(root);
    return new StreamableFile(archive, {
      type: 'application/zip',
      disposition: `attachment; filename="payharness-${basename(root)}.zip"`,
      length: archive.length,
    });
  }
}
