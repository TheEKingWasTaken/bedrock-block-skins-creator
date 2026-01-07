 // resourcePackImport.js
// Handles importing a resource pack (.mcpack/.zip) and generating a skin pack from block textures or blocks.json.

import JSZip from 'jszip';
import { generateUUID } from './utils.js';
import { processResourcePackFile } from './rpProcessing.js';

// removed direct dependency on editor canvas; import flow now fully self-contained {}
// removed processResourcePackFile and helper functions into rpProcessing.js {}

export function initResourcePackImport({
  importPackBtn,
  rpModal,
  rpClose,
  rpStepSelect,
  rpProcessing,
  rpReview,
  rpFileInput,

  rpProgressBar,
  rpProgressFill,
  rpProgressLabel,
  rpPackNameInput,
  rpPackDescInput,
  rpSkinList,
  rpBackBtn,
  rpExportBtn,
  rpExportFormat,
  // Optional: wire generated skins into texture editor for face selection
  textureEditor
}) {
  let rpSkins = [];
  let rpHeaderUUID = generateUUID();
  let rpModuleUUID = generateUUID();

  const rpTopDropArea = document.getElementById('rpDropArea');
  const rpTopFileInput = document.getElementById('rpTopFileInput');
  const rpExtraTexturesInput = document.getElementById('rpExtraTexturesInput');

  // Cache built-in vanilla blocks.json from assets/blocks_fixed.json
  let vanillaBlocksJsonPromise = null;
  function loadVanillaBlocksJson() {
    if (!vanillaBlocksJsonPromise) {
      vanillaBlocksJsonPromise = fetch('blocks_fixed.json')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load blocks_fixed.json');
          return res.json();
        })
        .catch((err) => {
          console.error('Error loading built-in blocks_fixed.json', err);
          return null;
        });
    }
    return vanillaBlocksJsonPromise;
  }

  function updateRpProgress(percent, label) {
    rpProgressFill.style.width = `${percent}%`;
    rpProgressLabel.textContent = `${label} (${Math.round(percent)}%)`;
  }

  function createPreviewTooltip(blob) {
    const tooltip = document.createElement('div');
    tooltip.className = 'texture-preview-tooltip';

    const img = document.createElement('img');
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.objectFit = 'contain';
    img.src = URL.createObjectURL(blob);

    tooltip.appendChild(img);
    document.body.appendChild(tooltip);

    return { tooltip, img };
  }

  function setRpInteractionEnabled(enabled) {
    const disabled = !enabled;
    rpFileInput.disabled = disabled;
    rpPackNameInput.disabled = disabled;
    rpPackDescInput.disabled = disabled;
    rpExportBtn.disabled = disabled;
    rpBackBtn.disabled = disabled;
    rpExportFormat.disabled = disabled;
  }

  function resetResourcePackModal() {
    rpStepSelect.style.display = 'block';
    rpProcessing.style.display = 'none';
    rpReview.style.display = 'none';
    rpFileInput.value = '';
    rpSkinList.innerHTML = '';
    rpSkins = [];
    rpHeaderUUID = generateUUID();
    rpModuleUUID = generateUUID();
    updateRpProgress(0, 'Waiting...');
    setRpInteractionEnabled(true);
  }

  async function handleResourcePackFile(file) {
    if (!file) return;

    resetResourcePackModal();
    rpModal.style.display = 'block';

    rpStepSelect.style.display = 'none';
    rpProcessing.style.display = 'block';
    rpReview.style.display = 'none';
    setRpInteractionEnabled(false);

    try {
      const vanillaBlocksJson = await loadVanillaBlocksJson();

      rpSkins = await processResourcePackFile({
        file,
        vanillaBlocksJson,
        updateRpProgress
      });

      // Make each generated skin texture available in the face selector dropdown
      if (textureEditor && textureEditor.addExternalTexture) {
        for (const skin of rpSkins) {
          try {
            const id = await textureEditor.addExternalTexture(
              skin.skinName || skin.identifier,
              skin.textureBlob
            );
            skin.textureEditorId = id;
          } catch (err) {
            console.error('Failed to add texture from resource pack skin', err);
          }
        }
        if (textureEditor.showEditor) {
          textureEditor.showEditor();
        }
      }

      renderRpSkinList();
      rpProcessing.style.display = 'none';
      rpReview.style.display = 'block';
      setRpInteractionEnabled(true);
    } catch (err) {
      console.error(err);
      alert('There was an error processing the resource pack.');
      resetResourcePackModal();
      rpModal.style.display = 'none';
    }
  }

  importPackBtn.addEventListener('click', () => {
    resetResourcePackModal();
    rpModal.style.display = 'block';
  });

  rpClose.addEventListener('click', () => {
    rpModal.style.display = 'none';
  });

  rpBackBtn.addEventListener('click', () => {
    rpStepSelect.style.display = 'block';
    rpProcessing.style.display = 'none';
    rpReview.style.display = 'none';
    rpSkinList.innerHTML = '';
    rpSkins = [];
  });

  rpFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleResourcePackFile(file);
  });

  if (rpTopFileInput) {
    rpTopFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await handleResourcePackFile(file);
      rpTopFileInput.value = '';
    });
  }

  if (rpTopDropArea) {
    ['dragenter', 'dragover'].forEach((type) => {
      rpTopDropArea.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        rpTopDropArea.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      rpTopDropArea.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
        rpTopDropArea.classList.remove('drag-over');
      });
    });

    rpTopDropArea.addEventListener('drop', async (e) => {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      await handleResourcePackFile(file);
    });
  }

  if (rpExtraTexturesInput) {
    rpExtraTexturesInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      for (const file of files) {
        let baseName = file.name.replace(/\.png$/i, '');
        let identifier = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'texture';
        const original = identifier;
        let counter = 2;
        while (rpSkins.some((s) => s.identifier === identifier)) {
          identifier = `${original}_${counter++}`;
        }

        const skinName =
          baseName
            .split(/[_\s]+/)
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ') || identifier;

        const textureBlob = file;
        const skin = {
          identifier,
          skinName,
          textureBlob
        };

        if (textureEditor && textureEditor.addExternalTexture) {
          try {
            const id = await textureEditor.addExternalTexture(
              skinName || identifier,
              textureBlob
            );
            skin.textureEditorId = id;
          } catch (err) {
            console.error('Failed to add extra texture to editor', err);
          }
        }

        rpSkins.push(skin);
      }

      renderRpSkinList();
      rpExtraTexturesInput.value = '';
    });
  }

  function renderRpSkinList() {
    if (!rpSkins.length) {
      rpSkinList.innerHTML = '<div class="tree-item file">No block skins were generated.</div>';
      return;
    }

    const items = rpSkins
      .map((skin, idx) => {
        return `
      <div class="tree-item file" data-skin-index="${idx}">
        <label class="rp-skin-row" data-index="${idx}">
          <input type="checkbox" class="rp-skin-toggle" data-index="${idx}" checked>
          <span class="rp-skin-name">${skin.identifier}.png</span>
          <button type="button" class="rp-skin-edit" title="Edit texture">✏️</button>
        </label>
      </div>
    `;
      })
      .join('');

    rpSkinList.innerHTML = `
    <div class="tree-item folder">
      <span>📁 ${rpPackNameInput.value || 'ImportedBlockSkinPack'}</span>
      <div class="tree-children">
        ${items}
        <div class="tree-item file">manifest.json</div>
        <div class="tree-item file">skins.json</div>
        <div class="tree-item folder">
          <span>📁 text</span>
          <div class="tree-children">
            <div class="tree-item file">languages.json</div>
            <div class="tree-item file">en_US.lang</div>
          </div>
        </div>
      </div>
    </div>
  `;

    // Wire hover preview + inline edit
    const rows = rpSkinList.querySelectorAll('.rp-skin-row');
    rows.forEach((row) => {
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const skin = rpSkins[idx];
      if (!skin || !skin.textureBlob) return;

      const nameSpan = row.querySelector('.rp-skin-name');
      const editBtn = row.querySelector('.rp-skin-edit');
      let tooltipData = null;

      function showTooltip(ev) {
        if (tooltipData) return;
        tooltipData = createPreviewTooltip(skin.textureBlob);
        const { tooltip } = tooltipData;
        const rect = ev.target.getBoundingClientRect();
        tooltip.style.left = `${rect.right + 8}px`;
        tooltip.style.top = `${rect.top}px`;
      }

      function hideTooltip() {
        if (!tooltipData) return;
        const { tooltip, img } = tooltipData;
        if (img && img.src) {
          URL.revokeObjectURL(img.src);
        }
        tooltip.remove();
        tooltipData = null;
      }

      nameSpan.addEventListener('mouseenter', showTooltip);
      nameSpan.addEventListener('mouseleave', hideTooltip);
      nameSpan.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        if (tooltipData) {
          hideTooltip();
        } else {
          showTooltip(ev);
        }
      });

      editBtn.addEventListener('click', async () => {
        const newDisplayName = window.prompt(
          'Display name for this skin:',
          skin.skinName || skin.identifier
        );
        if (newDisplayName !== null) {
          const trimmed = newDisplayName.trim();
          if (trimmed) {
            skin.skinName = trimmed;
            if (textureEditor && textureEditor.updateExternalTexture && skin.textureEditorId) {
              textureEditor.updateExternalTexture(skin.textureEditorId, {
                name: skin.skinName
              });
            }
          }
        }

        const newIdentifier = window.prompt(
          'Filename (identifier, lowercase/underscores only):',
          skin.identifier
        );
        if (newIdentifier !== null) {
          const clean = newIdentifier.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          if (clean && !rpSkins.some((s, i) => i !== idx && s.identifier === clean)) {
            skin.identifier = clean;
          } else if (clean) {
            alert('That identifier is already in use.');
          }
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          document.body.removeChild(fileInput);
          if (!file) {
            renderRpSkinList();
            return;
          }

          skin.textureBlob = file;
          if (textureEditor && textureEditor.updateExternalTexture && skin.textureEditorId) {
            try {
              await textureEditor.updateExternalTexture(skin.textureEditorId, {
                blob: file
              });
            } catch (err) {
              console.error('Failed to update texture in editor', err);
            }
          }

          renderRpSkinList();
        });

        fileInput.click();
      });
    });
  }

  rpPackNameInput.addEventListener('input', () => {
    renderRpSkinList();
  });

  rpExportBtn.addEventListener('click', async () => {
    if (!rpSkins.length) {
      alert('No skins to export.');
      return;
    }

    setRpInteractionEnabled(false);
    updateRpProgress(98, 'Finalizing export');
    rpProcessing.style.display = 'block';
    rpReview.style.display = 'none';

    const toggles = rpSkinList.querySelectorAll('.rp-skin-toggle');
    const selectedIndices = new Set();
    toggles.forEach((input) => {
      if (input.checked) {
        selectedIndices.add(parseInt(input.getAttribute('data-index'), 10));
      }
    });

    const selectedSkins = rpSkins.filter((_, idx) => selectedIndices.has(idx));
    if (!selectedSkins.length) {
      alert('No skins selected to export.');
      resetResourcePackModal();
      rpModal.style.display = 'none';
      return;
    }

    const zip = new JSZip();
    const folderNameRaw = rpPackNameInput.value || 'ImportedBlockSkinPack';
    const folderName =
      folderNameRaw.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'ImportedBlockSkinPack';
    const rootFolder = zip.folder(folderName);

    for (const skin of selectedSkins) {
      rootFolder.file(`${skin.identifier}.png`, skin.textureBlob);
    }

    const manifest = {
      format_version: 1,
      header: {
        name: rpPackNameInput.value || 'Imported Block Skin Pack',
        description: rpPackDescInput.value || 'Skins generated from a resource pack',
        uuid: rpHeaderUUID,
        version: [1, 0, 0]
      },
      modules: [
        {
          type: 'skin_pack',
          uuid: rpModuleUUID,
          version: [1, 0, 0]
        }
      ]
    };

    rootFolder.file('manifest.json', JSON.stringify(manifest, null, 2));

    const packKey = 'imported_blocks';

    const skinsJson = {
      format_version: '1.10.0',
      serialize_name: packKey,
      localization_name: packKey,
      skins: selectedSkins.map((skin) => ({
        localization_name: skin.identifier,
        geometry: 'geometry.humanoid.custom',
        texture: `${skin.identifier}.png`,
        cape: 'cape.png',
        type: 'free',
        animations: {
          humanoid_base_pose: 'animation.player.base_pose.upside_down',
          look_at_target: 'animation.witch.general',
          look_at_target_ui: 'animation.witch.general',
          'move.legs': 'animation.chicken.baby_transform',
          'move.arms': 'animation.sheep.setup',
          bob: 'animation.parrot.sitting',
          holding: 'animation.evoker.general',
          'attack.positions': 'animation.witch.general',
          'attack.rotations': 'animation.witch.general',
          sneaking: 'animation.witch.general'
        },
        enable_attachables: false
      }))
    };

    rootFolder.file('skins.json', JSON.stringify(skinsJson, null, 2));

    const textFolder = rootFolder.folder('text');
    textFolder.file('languages.json', JSON.stringify(['en_US'], null, 2));

    let langContent = `skinpack.${packKey}=${rpPackNameInput.value || 'Imported Block Skin Pack'}\n`;
    for (const skin of selectedSkins) {
      langContent += `skin.${packKey}.${skin.identifier}=${skin.skinName}\n`;
    }
    textFolder.file('en_US.lang', langContent);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName =
      folderNameRaw.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'ImportedBlockSkinPack';
    const ext = rpExportFormat.value === 'zip' ? 'zip' : 'mcpack';
    a.download = `${safeName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    updateRpProgress(100, 'Done');
    rpModal.style.display = 'none';
    resetResourcePackModal();
  });

  return {
    reset: resetResourcePackModal
  };
}