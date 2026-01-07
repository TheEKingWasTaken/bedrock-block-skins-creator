 // skinPack.js
// Manages the skin pack modal, identifier validation, and .mcpack export,
// plus interactive file explorer previews and pencil-based editing back into the face selector.

import JSZip from 'jszip';
import { generateUUID } from './utils.js';

// removed inline editor logic coupling inside skin pack implementation {}

export function initSkinPack({
  outputCanvas,
  addToPackBtn,
  viewPackBtn,
  importPackBtn,
  modalEl,
  closeModalEl,
  inputStepEl,
  packStepEl,
  identifierInput,
  skinNameInput,
  identifierErrorEl,
  continueBtn,
  folderNameInput,
  manifestNameInput,
  manifestDescInput,
  addAnotherBtn,
  exportPackBtn,
  textureEditor
}) {
  const skinPackData = {
    skins: [],
    folderName: 'MyBlockSkinPack',
    manifestName: 'Block Skin Pack',
    manifestDesc: 'Custom block skins',
    headerUUID: generateUUID(),
    moduleUUID: generateUUID(),
    inProgress: false
  };

  const identifierRegex = /^[a-z0-9_]+$/;

  function validateIdentifier() {
    const value = identifierInput.value.trim();

    if (!value) {
      identifierErrorEl.textContent = '';
      continueBtn.disabled = true;
      return false;
    }

    if (!identifierRegex.test(value)) {
      identifierErrorEl.textContent =
        'Identifier may only contain lowercase letters, numbers, and underscores.';
      continueBtn.disabled = true;
      return false;
    }

    const isDuplicate = skinPackData.skins.some((skin) => skin.identifier === value);
    if (isDuplicate) {
      identifierErrorEl.textContent = 'This identifier is already used in this skin pack.';
      continueBtn.disabled = true;
      return false;
    }

    identifierErrorEl.textContent = '';
    continueBtn.disabled = !skinNameInput.value.trim();
    return true;
  }

  function createPreviewTooltip(blob) {
    const tooltip = document.createElement('div');
    tooltip.className = 'texture-preview-tooltip';

    const img = document.createElement('img');
    img.style.width = '64px';
    img.style.height = '64px';
    img.style.objectFit = 'contain';
    img.src = URL.createObjectURL(blob);

    img.onload = () => {
      // revoke later when tooltip removed
    };

    tooltip.appendChild(img);
    document.body.appendChild(tooltip);

    return { tooltip, img };
  }

  function resetPack() {
    skinPackData.skins = [];
    skinPackData.inProgress = false;
    skinPackData.headerUUID = generateUUID();
    skinPackData.moduleUUID = generateUUID();
    folderNameInput.value = skinPackData.folderName;
    manifestNameInput.value = skinPackData.manifestName;
    manifestDescInput.value = skinPackData.manifestDesc;

    const folderTree = modalEl.querySelector('.folder-tree');
    if (folderTree) {
      folderTree.innerHTML = `
        <div class="tree-item folder">
          <span>📁 <span id="previewFolderName">${folderNameInput.value}</span></span>
          <div class="tree-children">
            <div class="tree-item file">No skins yet</div>
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
    }

    if (viewPackBtn) {
      viewPackBtn.style.display = 'none';
    }
  }

  function updatePreview() {
    const folderTree = modalEl.querySelector('.folder-tree');

    const filesHtml = skinPackData.skins
      .map(
        (skin, index) => `
        <div class="tree-item file skin-file-row" data-skin-index="${index}">
          <span class="skin-file-name">${skin.identifier}.png</span>
          <button class="skin-file-edit" title="Edit in face selector">
            ✏️
          </button>
        </div>`
      )
      .join('');

    folderTree.innerHTML = `
      <div class="tree-item folder">
        <span>📁 <span id="previewFolderName">${folderNameInput.value}</span></span>
        <div class="tree-children">
          ${filesHtml || '<div class="tree-item file">No skins yet</div>'}
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

    // Wire hover preview + pencil editing
    const rows = folderTree.querySelectorAll('.skin-file-row');
    rows.forEach((row) => {
      const idx = parseInt(row.getAttribute('data-skin-index'), 10);
      const skin = skinPackData.skins[idx];
      if (!skin) return;

      const nameSpan = row.querySelector('.skin-file-name');
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

      const editBtn = row.querySelector('.skin-file-edit');
      editBtn.addEventListener('click', async () => {
        // Load this PNG into the texture editor and apply to all faces
        if (textureEditor && textureEditor.addExternalTexture) {
          await textureEditor.addExternalTexture(
            skin.identifier,
            skin.textureBlob,
            { applyToAllFaces: true }
          );
          if (textureEditor.showEditor) {
            textureEditor.showEditor();
          }
        }
        // Close modal so user can immediately edit faces
        modalEl.style.display = 'none';
      });
    });
  }

  async function addCurrentSkinToPack() {
    const identifier = identifierInput.value.trim();
    const skinName = skinNameInput.value.trim();

    const blob = await new Promise((resolve) => outputCanvas.toBlob(resolve));

    skinPackData.skins.push({
      identifier,
      skinName,
      textureBlob: blob
    });

    skinPackData.inProgress = true;
    folderNameInput.value = skinPackData.folderName;
    manifestNameInput.value = skinPackData.manifestName;
    manifestDescInput.value = skinPackData.manifestDesc;

    updatePreview();
    viewPackBtn.style.display = 'block';
  }

  async function exportSkinPack() {
    if (!skinPackData.skins.length) {
      alert('No skins in pack to export.');
      return;
    }

    const zip = new JSZip();
    const rootFolder = zip.folder(skinPackData.folderName);

    for (const skin of skinPackData.skins) {
      rootFolder.file(`${skin.identifier}.png`, skin.textureBlob);
    }

    const manifest = {
      header: {
        version: [1, 0, 0],
        description: skinPackData.manifestDesc,
        name: skinPackData.manifestName,
        uuid: skinPackData.headerUUID
      },
      modules: [
        {
          version: [1, 0, 0],
          type: 'skin_pack',
          uuid: skinPackData.moduleUUID
        }
      ],
      format_version: 1
    };
    rootFolder.file('manifest.json', JSON.stringify(manifest, null, 2));

    const skinsJson = {
      format_version: '1.10.0',
      serialize_name: 'blocks',
      localization_name: 'blocks',
      skins: skinPackData.skins.map((skin) => ({
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

    let langContent = 'skinpack.blocks=Block Skins\n';
    for (const skin of skinPackData.skins) {
      langContent += `skin.blocks.${skin.identifier}=${skin.skinName}\n`;
    }
    textFolder.file('en_US.lang', langContent);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skinPackData.folderName}.mcpack`;
    a.click();
    URL.revokeObjectURL(url);

    modalEl.style.display = 'none';
  }

  // Event wiring
  addToPackBtn.addEventListener('click', () => {
    modalEl.style.display = 'block';
    inputStepEl.style.display = 'block';
    packStepEl.style.display = 'none';
    identifierInput.value = '';
    skinNameInput.value = '';
    identifierErrorEl.textContent = '';
    continueBtn.disabled = true;
  });

  viewPackBtn.addEventListener('click', () => {
    if (!skinPackData.skins.length) return;
    modalEl.style.display = 'block';
    inputStepEl.style.display = 'none';
    packStepEl.style.display = 'block';
    updatePreview();
  });

  closeModalEl.addEventListener('click', () => {
    modalEl.style.display = 'none';
  });

  identifierInput.addEventListener('input', validateIdentifier);
  skinNameInput.addEventListener('input', () => {
    if (validateIdentifier() && skinNameInput.value.trim()) {
      continueBtn.disabled = false;
    } else {
      continueBtn.disabled = true;
    }
  });

  continueBtn.addEventListener('click', async () => {
    await addCurrentSkinToPack();
    inputStepEl.style.display = 'none';
    packStepEl.style.display = 'block';
  });

  folderNameInput.addEventListener('input', () => {
    skinPackData.folderName = folderNameInput.value;
    updatePreview();
  });

  manifestNameInput.addEventListener('input', () => {
    skinPackData.manifestName = manifestNameInput.value;
  });

  manifestDescInput.addEventListener('input', () => {
    skinPackData.manifestDesc = manifestDescInput.value;
  });

  addAnotherBtn.addEventListener('click', () => {
    modalEl.style.display = 'none';
    textureEditor.resetTextures();
  });

  exportPackBtn.addEventListener('click', () => {
    exportSkinPack();
  });

  // Return public API for other modules
  return {
    getSkinCount: () => skinPackData.skins.length,
    resetPack
  };
}