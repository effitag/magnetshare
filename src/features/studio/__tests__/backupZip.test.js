// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, zipSync, strToU8 } from 'fflate';
import { createCloudRepo } from '@/features/studio/storage/cloudRepo';
import { exportAllTemplates, importBackup, remapAssetPaths, templateFolders } from '@/features/studio/storage/backupZip';
import { createImage } from '@/features/studio/model/schema';
import { createMemoryGateway } from '@/features/studio/storage/memoryGateway';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

async function seed(repo) {
  const a = await repo.create('חתונה – נועה ואיתי');
  const logo = await repo.uploadAsset(a.id, new File([SVG], 'לוגו.svg', { type: 'image/svg+xml' }));
  const bg = await repo.uploadAsset(a.id, new File([new Uint8Array([1, 2, 3])], 'bg.png', { type: 'image/png' }));
  const doc = {
    ...a.doc,
    elements: [{ ...a.doc.elements[0], image: bg }, createImage(a.doc.size, logo, 10, 10, 'לוגו')],
  };
  await repo.save(a.id, doc, a.revision);
  await repo.saveThumbnail(a.id, new Blob([new Uint8Array([9, 9])], { type: 'image/png' }));
  const b = await repo.create('בר מצווה');
  return { a: a.id, b: b.id, logo, bg };
}

describe('zip backup', () => {
  it('exports every template in the folder layout of the local version', async () => {
    const repo = createCloudRepo(createMemoryGateway());
    await seed(repo);
    const { blob, count } = await exportAllTemplates(repo);
    expect(count).toBe(2);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      'בר מצווה/template.json',
      'חתונה – נועה ואיתי/preview.png',
      'חתונה – נועה ואיתי/template.json',
    ]);
    const doc = JSON.parse(strFromU8(files['חתונה – נועה ואיתי/template.json']));
    expect(doc.elements[1].src.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('restores a backup into another account as new copies, with working images', async () => {
    const source = createCloudRepo(createMemoryGateway());
    const ids = await seed(source);
    const { blob } = await exportAllTemplates(source);

    const target = createCloudRepo(createMemoryGateway());
    const progress = [];
    const result = await importBackup(target, new Uint8Array(await blob.arrayBuffer()), { onProgress: (d, t) => progress.push(`${d}/${t}`) });
    expect(result).toEqual({ imported: 2, failed: [] });
    expect(progress).toEqual(['1/2', '2/2']);

    const list = await target.list();
    expect(list.map((t) => t.name).sort()).toEqual(['בר מצווה', 'חתונה – נועה ואיתי']);
    const restored = list.find((t) => t.name.startsWith('חתונה'));
    expect(restored.id).not.toBe(ids.a); // a copy, never the same id
    expect(restored.thumbnailUrl).toBeTruthy();

    const { doc } = await target.load(restored.id);
    const original = (await source.load(ids.a)).doc;
    expect(doc.elements.map((e) => e.type)).toEqual(original.elements.map((e) => e.type));
    const logo = await target.readAsset(restored.id, doc.elements[1].src);
    expect(await logo.text()).toBe(SVG);
    expect(await target.readAsset(restored.id, doc.elements[0].image)).toBeInstanceOf(Blob);
  });

  it('importing twice adds a second copy instead of overwriting', async () => {
    const repo = createCloudRepo(createMemoryGateway());
    await seed(repo);
    const bytes = new Uint8Array(await (await exportAllTemplates(repo)).blob.arrayBuffer());
    await importBackup(repo, bytes);
    expect((await repo.list()).length).toBe(4);
  });

  it('renames Hebrew image names from older backups to storage-safe ones and fixes the references', async () => {
    const doc = {
      format: 'magnet-frame-studio',
      version: 1,
      name: 'ישן',
      elements: [
        { id: 'bg', type: 'background', fill: '#fff', image: 'assets/רקע.png' },
        { id: 'i', type: 'image', x: 0, y: 0, width: 10, height: 10, src: 'assets/עלה.svg' },
      ],
    };
    const zip = zipSync({
      'ישן/template.json': strToU8(JSON.stringify(doc)),
      'ישן/assets/רקע.png': new Uint8Array([1]),
      'ישן/assets/עלה.svg': strToU8(SVG),
    });
    const repo = createCloudRepo(createMemoryGateway());
    expect(await importBackup(repo, zip)).toEqual({ imported: 1, failed: [] });
    const [item] = await repo.list();
    const loaded = (await repo.load(item.id)).doc;
    expect(loaded.elements[0].image.startsWith('data:image/png;base64,')).toBe(true);
    expect(loaded.elements[1].src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(await (await repo.readAsset(item.id, loaded.elements[1].src)).text()).toBe(SVG);
  });

  it('skips broken templates and reports them, importing the rest', async () => {
    const good = { format: 'magnet-frame-studio', version: 1, name: 'טובה', elements: [] };
    const zip = zipSync({
      'backup/טובה/template.json': strToU8(JSON.stringify(good)),
      'backup/שבורה/template.json': strToU8('{ not json'),
      '__MACOSX/backup/._x/template.json': strToU8('junk'),
    });
    const repo = createCloudRepo(createMemoryGateway());
    const result = await importBackup(repo, zip);
    expect(result.imported).toBe(1);
    expect(result.failed.map((f) => f.folder)).toEqual(['backup/שבורה']);
  });

  it('finds template folders at any depth, including a single template at the root', () => {
    expect(templateFolders({ 'template.json': 1, 'a/template.json': 1, 'x/y/template.json': 1, '.hidden/template.json': 1 })).toEqual([
      '',
      'a/',
      'x/y/',
    ]);
  });

  it('rewrites asset paths anywhere in the document', () => {
    const map = new Map([['assets/old.png', 'assets/new.png']]);
    expect(remapAssetPaths({ a: 'assets/old.png', b: [{ c: 'assets/old.png' }], d: 'keep', e: 3 }, map)).toEqual({
      a: 'assets/new.png',
      b: [{ c: 'assets/new.png' }],
      d: 'keep',
      e: 3,
    });
  });
});
