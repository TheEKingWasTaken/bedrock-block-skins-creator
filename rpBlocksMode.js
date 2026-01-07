// rpBlocksMode.js
// Focused handling of blocks.json-driven skin generation for resource packs.

import {
  isBlobSemiTransparent,
  generateCubeSkinFromFaceBlobs
} from './rpImageUtils.js';

// removed direct JSZip usage; this module operates on already-loaded zip + filenames {}

function normalizeBlocksJson(blocksJson) {
  if (!blocksJson) return {};
  if (blocksJson.blocks && typeof blocksJson.blocks === 'object') {
    return blocksJson.blocks;
  }
  return blocksJson;
}

function chooseBlocksSourceMode(hasResource, hasVanilla) {
  if (hasResource && !hasVanilla) return 'resource';
  if (!hasResource && hasVanilla) return 'vanilla';
  if (!hasResource && !hasVanilla) return 'none';

  // Both available: prompt user
  const msg =
    'Blocks.json found in resource pack and vanilla blocks.json provided.\n' +
    'Enter 1 for "Vanilla only", 2 for "Resource pack only", 3 for "Both (resource first)":';
  const choice = window.prompt(msg, '3');
  if (choice === '1') return 'vanilla';
  if (choice === '2') return 'resource';
  return 'both';
}

function buildCombinedBlocks(resourceBlocksJson, vanillaBlocksJson) {
  const resBlocks = normalizeBlocksJson(resourceBlocksJson);
  const vanBlocks = normalizeBlocksJson(vanillaBlocksJson);
  const mode = chooseBlocksSourceMode(!!resourceBlocksJson, !!vanillaBlocksJson);

  const combined = {};
  if (mode === 'resource') {
    Object.assign(combined, resBlocks);
  } else if (mode === 'vanilla') {
    Object.assign(combined, vanBlocks);
  } else if (mode === 'both') {
    // resource first, then vanilla for missing blocks
    Object.assign(combined, resBlocks);
    for (const key of Object.keys(vanBlocks)) {
      if (!combined[key]) combined[key] = vanBlocks[key];
    }
  }
  return combined;
}

const BLOCK_NAME_EXCLUDE_SUBSTRINGS = [
  'anvil',
  'enchanting_table',
  'flower',
  'sapling',
  'tall_grass',
  'rose_bush',
  'peony',
  'dead_bush',
  'fern',
  '_stairs',
  '_slab',
  'fence',
  '_door',
  'bed',
  '_button',
  '_pressure_plate',
  'rail',
  'torch',
  'ladder',
  'carpet',
  'pane',
  'banner',
  'sign',
  'trapdoor',
  'scaffolding',
  'chain',
  'bar',
  'cauldron',
  'fire',
  'vine',
  'tinted',
  'dyed',
  // Additional non-full / special blocks
  'waxed',
  'infested',
  'shelf',
  'shelves',
  'mushroom',
  'sea_pickle',
  'sea_pickel',
  'lantern',
  'root',
  'roots',
  'sculk',
  'sensor',
  'heavy_core',
  'spore',
  'mangrove_root',
  'mangrove_roots',
  'sea_pickle',
  'sea_pickles'
];

function isBlockNameExcluded(blockKey, def) {
  const keyName = (blockKey || '').toLowerCase();
  const typeName =
    def && typeof def === 'object' && typeof def.type === 'string'
      ? def.type.toLowerCase()
      : '';

  const haystack = `${keyName} ${typeName}`;

  return BLOCK_NAME_EXCLUDE_SUBSTRINGS.some((substr) => haystack.includes(substr));
}

function isNormalGlassName(blockKey) {
  const name = (blockKey || '').toLowerCase();
  return name.includes('glass') && !name.includes('tinted') && !name.includes('dyed');
}

export async function processBlocksJsonMode({
  zip,
  fileNames,
  root,
  resourceBlocksJson,
  vanillaBlocksJson,
  updateRpProgress
}) {
  const candidates = [root + 'textures/blocks/', root + 'textures/block/'];

  const blocksMap = buildCombinedBlocks(resourceBlocksJson, vanillaBlocksJson);
  const blockKeys = Object.keys(blocksMap);
  if (!blockKeys.length) return [];

  const safeUpdate = (percent, label) => {
    if (typeof updateRpProgress === 'function') {
      updateRpProgress(percent, label);
    }
  };

  safeUpdate(30, 'Analyzing blocks.json entries');

  const texPathCache = new Map();
  function findTexturePath(texName) {
    if (!texName) return null;
    if (texPathCache.has(texName)) return texPathCache.get(texName);

    for (const prefix of candidates) {
      const candidate = `${prefix}${texName}.png`;
      if (fileNames.includes(candidate)) {
        texPathCache.set(texName, candidate);
        return candidate;
      }
    }
    texPathCache.set(texName, null);
    return null;
  }

  // Pre-scan to determine how many "full blocks" we actually have to process
  const processableKeys = [];

  for (const blockKey of blockKeys) {
    const def = blocksMap[blockKey] || {};

    // Name/type-based filtering for non-full blocks and special cases (including tinted/dyed etc.)
    if (isBlockNameExcluded(blockKey, def)) {
      continue;
    }

    const texturesDef = def.textures !== undefined ? def.textures : def;
    if (!texturesDef) continue;

    let textureMap = {};
    if (typeof texturesDef === 'string') {
      textureMap['*'] = texturesDef;
    } else {
      textureMap = texturesDef;
    }

    const baseTex = textureMap['*'] || textureMap['all'] || textureMap['default'] || null;

    // Resolve per-face texture names
    const topTexName = textureMap.top || textureMap.up || textureMap.end || baseTex;
    const bottomTexName = textureMap.bottom || textureMap.down || textureMap.end || baseTex;

    const sideTexName =
      textureMap.side || textureMap.sides || textureMap.wall || textureMap.north || baseTex;

    const northTexName = textureMap.north || textureMap.front || sideTexName || baseTex;
    const southTexName = textureMap.south || textureMap.back || sideTexName || baseTex;
    const eastTexName = textureMap.east || textureMap.right || sideTexName || baseTex;
    const westTexName = textureMap.west || textureMap.left || sideTexName || baseTex;

    const requiredNames = [
      topTexName,
      bottomTexName,
      northTexName,
      southTexName,
      eastTexName,
      westTexName
    ];

    if (requiredNames.some((n) => !n)) {
      continue;
    }

    // Map texture names to concrete paths; skip if any missing
    const uniqueNames = Array.from(new Set(requiredNames));
    let missing = false;
    for (const name of uniqueNames) {
      const path = findTexturePath(name);
      if (!path) {
        missing = true;
        break;
      }
    }
    if (missing) continue;

    processableKeys.push(blockKey);
  }

  const totalFullBlocks = processableKeys.length;
  if (!totalFullBlocks) {
    safeUpdate(40, 'No full blocks found to process');
    return [];
  }

  safeUpdate(40, `Found ${totalFullBlocks} full blocks to process`);

  const usedIdentifiers = new Set();
  const rpSkins = [];

  let completedFullBlocks = 0;
  const startTime = performance.now();

outer: for (const blockKey of processableKeys) {
    const def = blocksMap[blockKey] || {};
    const texturesDef = def.textures !== undefined ? def.textures : def;

    let textureMap = {};
    if (typeof texturesDef === 'string') {
      textureMap['*'] = texturesDef;
    } else {
      textureMap = texturesDef;
    }

    const baseTex = textureMap['*'] || textureMap['all'] || textureMap['default'] || null;

    const topTexName = textureMap.top || textureMap.up || textureMap.end || baseTex;
    const bottomTexName = textureMap.bottom || textureMap.down || textureMap.end || baseTex;

    const sideTexName =
      textureMap.side || textureMap.sides || textureMap.wall || textureMap.north || baseTex;

    const northTexName = textureMap.north || textureMap.front || sideTexName || baseTex;
    const southTexName = textureMap.south || textureMap.back || sideTexName || baseTex;
    const eastTexName = textureMap.east || textureMap.right || sideTexName || baseTex;
    const westTexName = textureMap.west || textureMap.left || sideTexName || baseTex;

    const requiredNames = [
      topTexName,
      bottomTexName,
      northTexName,
      southTexName,
      eastTexName,
      westTexName
    ];

    const uniqueNames = Array.from(new Set(requiredNames));
    const nameToPath = {};
    for (const name of uniqueNames) {
      const path = findTexturePath(name);
      if (!path) {
        // Should not happen due to pre-scan, but guard anyway
        continue outer;
      }
      nameToPath[name] = path;
    }

    const topBlob = await zip.file(nameToPath[topTexName]).async('blob');
    const bottomBlob = await zip.file(nameToPath[bottomTexName]).async('blob');
    const northBlob = await zip.file(nameToPath[northTexName]).async('blob');
    const southBlob = await zip.file(nameToPath[southTexName]).async('blob');
    const eastBlob = await zip.file(nameToPath[eastTexName]).async('blob');
    const westBlob = await zip.file(nameToPath[westTexName]).async('blob');

    // Semi-transparency filtering (except for normal glass blocks)
    const isNormalGlass = isNormalGlassName(blockKey);
    if (!isNormalGlass) {
      const faceBlobs = [topBlob, bottomBlob, northBlob, southBlob, eastBlob, westBlob];
      for (const blob of faceBlobs) {
        if (await isBlobSemiTransparent(blob)) {
          // Skip blocks with semi-transparent textures
          continue outer;
        }
      }
    }

    const faces = {
      top: topBlob,
      bottom: bottomBlob,
      front: northBlob,
      back: southBlob,
      right: eastBlob,
      left: westBlob
    };

    const skinBlob = await generateCubeSkinFromFaceBlobs(faces);

    // Identifier and skin name from block key
    const rawId = blockKey.includes(':') ? blockKey.split(':')[1] : blockKey;
    const identifier = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^[a-z0-9_]+$/.test(identifier)) continue;
    if (usedIdentifiers.has(identifier)) continue;
    usedIdentifiers.add(identifier);

    const words = identifier.split('_').filter(Boolean);
    const skinName =
      words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || identifier;

    rpSkins.push({
      identifier,
      skinName,
      textureBlob: skinBlob
    });

    // Progress + ETA based only on full blocks
    completedFullBlocks += 1;
    const elapsedMs = performance.now() - startTime;
    const avgPerBlock = completedFullBlocks > 0 ? elapsedMs / completedFullBlocks : 0;
    const remaining = totalFullBlocks - completedFullBlocks;
    const etaMs = avgPerBlock * remaining;
    const etaSec = Math.round(etaMs / 1000);
    const etaText = etaSec <= 0 ? '<1s' : `${etaSec}s`;

    const progressPortion = completedFullBlocks / totalFullBlocks;
    const percent = 40 + progressPortion * 45; // map full-block work roughly into 40–85%

    const workingOnLabel = blockKey || identifier;
    safeUpdate(
      percent,
      `Processing full blocks ${completedFullBlocks}/${totalFullBlocks} • ETA ${etaText} • Working on ${workingOnLabel}`
    );
  }

  return rpSkins;
}