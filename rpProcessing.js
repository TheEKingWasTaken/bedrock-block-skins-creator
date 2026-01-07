 // rpProcessing.js
// Extracted heavy resource-pack processing logic from resourcePackImport.js.
// Now acts as a thin orchestrator delegating to more focused modules.

import JSZip from 'jszip';
import { processBlocksJsonMode } from './rpBlocksMode.js';
import { generateUniformCubeSkinFromBlockTextureBlob } from './rpImageUtils.js';

// removed normalizeBlocksJson() {}
// removed chooseBlocksSourceMode() {}
// removed buildCombinedBlocks() {}
// removed BLOCK_NAME_EXCLUDE_SUBSTRINGS and isBlockNameExcluded() {}
// removed isNormalGlassName() {}
// removed isBlobSemiTransparent() {}
// removed processBlocksJsonMode() implementation {}
// removed loadBlobAs16Image() {}
// removed generateCubeSkinFromFaceBlobs() {}
// removed generateUniformCubeSkinFromBlockTextureBlob() inline implementation {}

export async function processResourcePackFile({
  file,
  vanillaBlocksJson,
  updateRpProgress
}) {
  const safeUpdate = (percent, label) => {
    if (typeof updateRpProgress === 'function') {
      updateRpProgress(percent, label);
    }
  };

  safeUpdate(5, 'Reading archive');
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  safeUpdate(15, 'Scanning folders');

  const fileNames = Object.keys(zip.files);

  let root = '';
  for (const name of fileNames) {
    if (name.endsWith('manifest.json')) {
      root = name.substring(0, name.lastIndexOf('manifest.json'));
      break;
    }
    if (name.includes('textures/')) {
      root = name.substring(0, name.indexOf('textures/'));
      break;
    }
    if (name.endsWith('pack_icon.png')) {
      root = name.substring(0, name.lastIndexOf('pack_icon.png'));
      break;
    }
  }

  // Detect blocks.json in resource pack
  safeUpdate(25, 'Detecting blocks.json');
  let resourceBlocksPath = '';
  for (const name of fileNames) {
    if (name === `${root}blocks.json` || name.endsWith('/blocks.json')) {
      resourceBlocksPath = name;
      break;
    }
  }

  let resourceBlocksJson = null;
  if (resourceBlocksPath) {
    try {
      const text = await zip.file(resourceBlocksPath).async('string');
      resourceBlocksJson = JSON.parse(text);
    } catch (err) {
      console.error('Failed to parse resource pack blocks.json', err);
    }
  }

  const hasResourceBlocks = !!resourceBlocksJson;
  const hasVanillaBlocks = !!vanillaBlocksJson;

  if (hasResourceBlocks || hasVanillaBlocks) {
    const rpSkins = await processBlocksJsonMode({
      zip,
      fileNames,
      root,
      resourceBlocksJson,
      vanillaBlocksJson,
      updateRpProgress: safeUpdate
    });
    safeUpdate(85, 'Updating skin pack files');
    safeUpdate(95, 'Finalizing export options');
    return rpSkins;
  }

  // Fallback: original block-texture-only processing
  const candidates = [root + 'textures/blocks/', root + 'textures/block/'];

  safeUpdate(25, 'Detecting block textures');

  const pngFiles = [];
  for (const path of fileNames) {
    if (!path.toLowerCase().endsWith('.png')) continue;
    if (path.toLowerCase().endsWith('.png.mcmeta')) continue;

    const isBlockTexture = candidates.some((prefix) => path.startsWith(prefix));
    if (!isBlockTexture) continue;

    pngFiles.push(path);
  }

  const total = pngFiles.length || 1;
  const usedIdentifiers = new Set();
  const rpSkins = [];

  let index = 0;
  for (const path of pngFiles) {
    index++;
    const baseName = path.split('/').pop();
    const nameWithoutExt = baseName.replace(/\.png$/i, '');
    let identifier = nameWithoutExt.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^[a-z0-9_]+$/.test(identifier)) continue;
    if (usedIdentifiers.has(identifier)) continue;
    usedIdentifiers.add(identifier);

    const stageBase = 25 + Math.floor((index / total) * 50);
    safeUpdate(stageBase, `Generating skins (${index}/${total})`);

    const fileObj = zip.file(path);
    if (!fileObj) continue;
    const blob = await fileObj.async('blob');
    const skinBlob = await generateUniformCubeSkinFromBlockTextureBlob(blob);

    rpSkins.push({
      identifier,
      skinName: nameWithoutExt,
      textureBlob: skinBlob
    });
  }

  safeUpdate(85, 'Updating skin pack files');
  safeUpdate(95, 'Finalizing export options');
  return rpSkins;
}