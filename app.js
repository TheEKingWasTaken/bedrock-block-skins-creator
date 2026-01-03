import JSZip from 'jszip';

const fileInput = document.getElementById('fileInput');
const canvasContainer = document.getElementById('canvasContainer');
const outputCanvas = document.getElementById('outputCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const addToPackBtn = document.getElementById('addToPackBtn');
const viewPackBtn = document.getElementById('viewPackBtn');
const additionalTexturesInput = document.getElementById('additionalTextures');
const textureCount = document.getElementById('textureCount');
const ctx = outputCanvas.getContext('2d');

// Modal elements
const modal = document.getElementById('skinPackModal');
const closeModal = document.querySelector('.close');
const inputStep = document.getElementById('inputStep');
const packStep = document.getElementById('packStep');
const identifierInput = document.getElementById('identifierInput');
const skinNameInput = document.getElementById('skinNameInput');
const identifierError = document.getElementById('identifierError');
const continueBtn = document.getElementById('continueBtn');
const folderNameInput = document.getElementById('folderNameInput');
const manifestNameInput = document.getElementById('manifestNameInput');
const manifestDescInput = document.getElementById('manifestDescInput');
const previewFolderName = document.getElementById('previewFolderName');
const previewIdentifierFile = document.getElementById('previewIdentifierFile');
const addAnotherBtn = document.getElementById('addAnotherBtn');
const exportPackBtn = document.getElementById('exportPackBtn');

// Skin pack data
const skinPackData = {
  skins: [],
  folderName: 'MyBlockSkinPack',
  manifestName: 'Block Skin Pack',
  manifestDesc: 'Custom block skins',
  headerUUID: generateUUID(),
  moduleUUID: generateUUID(),
  inProgress: false
};

// Disable image smoothing for sharp pixels
ctx.imageSmoothingEnabled = false;

// Texture storage
const numberedTextures = {}; // {1: img, 2: img, ...}
const textureNames = {}; // {1: 'name', 2: 'name', ...}
const textureListEl = document.getElementById('textureList');
const faceSelectors = {
  top: document.querySelector('[data-face="top"]'),
  front: document.querySelector('[data-face="front"]'),
  left: document.querySelector('[data-face="left"]'),
  bottom: document.querySelector('[data-face="bottom"]'),
  right: document.querySelector('[data-face="right"]'),
  back: document.querySelector('[data-face="back"]')
};

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  
  const filesToLoad = files.slice(0, 6); // Max 6 textures
  let loadedCount = 0;
  
  filesToLoad.forEach((file, index) => {
    const img = new Image();
    img.onload = () => {
      const textureNum = index + 1;
      numberedTextures[textureNum] = img;
      textureNames[textureNum] = file.name.replace('.png', '');
      
      // Add option to all selectors
      Object.values(faceSelectors).forEach(select => {
        if (!select.querySelector(`[value="${textureNum}"]`)) {
          const option = document.createElement('option');
          option.value = textureNum;
          option.textContent = textureNum;
          select.appendChild(option);
          if (textureNum === 1) select.value = '1'; // Set default to 1
        }
      });
      
      loadedCount++;
      if (loadedCount === filesToLoad.length) {
        updateTextureCount();
        renderTextureList();
        sortDropdownOptions();
        processTexture();
        canvasContainer.style.display = 'flex';
        fileInput.style.display = 'none'; // Hide initial file input
        
        // Show view pack button if we have skins already
        if (skinPackData.skins.length > 0) {
          viewPackBtn.style.display = 'block';
        }
      }
    };
    img.src = URL.createObjectURL(file);
  });
});

additionalTexturesInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  const availableSlots = 6 - Object.keys(numberedTextures).length;
  
  if (availableSlots === 0) {
    alert('Max textures reached. Delete existing textures to add more.');
    additionalTexturesInput.value = ''; // Clear the file input
    return;
  }
  
  const filesToLoad = files.slice(0, availableSlots);
  
  let loadedCount = 0;
  filesToLoad.forEach((file, index) => {
    const img = new Image();
    img.onload = () => {
      const textureNum = Object.keys(numberedTextures).length + 1;
      numberedTextures[textureNum] = img;
      textureNames[textureNum] = file.name.replace('.png', '');
      
      // Add option to all selectors
      Object.values(faceSelectors).forEach(select => {
        const option = document.createElement('option');
        option.value = textureNum;
        option.textContent = textureNum;
        select.appendChild(option);
      });
      
      loadedCount++;
      if (loadedCount === filesToLoad.length) {
        updateTextureCount();
        renderTextureList();
        sortDropdownOptions();
        if (numberedTextures[1]) processTexture();
      }
    };
    img.src = URL.createObjectURL(file);
  });
});

function updateTextureCount() {
  const count = Object.keys(numberedTextures).length;
  textureCount.textContent = `${count}/6`;
}

function renderTextureList() {
  textureListEl.innerHTML = '';
  
  Object.keys(numberedTextures).sort((a, b) => Number(a) - Number(b)).forEach(num => {
    const div = document.createElement('div');
    div.className = 'texture-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${num}: ${textureNames[num] || `Texture ${num}`}`;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.addEventListener('click', () => deleteTexture(num));
    
    div.appendChild(nameSpan);
    div.appendChild(deleteBtn);
    textureListEl.appendChild(div);
  });
}

function deleteTexture(num) {
  if (Object.keys(numberedTextures).length === 1) {
    alert('Error: Must keep at least one texture');
    return;
  }
  
  delete numberedTextures[num];
  delete textureNames[num];
  
  // Remove from all selectors and update selected if needed
  Object.values(faceSelectors).forEach(select => {
    const option = select.querySelector(`[value="${num}"]`);
    if (option) {
      option.remove();
      if (select.value === num.toString()) {
        select.value = '1'; // Default to texture 1
      }
    }
  });
  
  updateTextureCount();
  renderTextureList();
  sortDropdownOptions();
  processTexture();
}

function sortDropdownOptions() {
  Object.values(faceSelectors).forEach(select => {
    const selectedValue = select.value;
    const options = Array.from(select.options);
    
    options.sort((a, b) => Number(a.value) - Number(b.value));
    
    select.innerHTML = '';
    options.forEach(option => select.appendChild(option));
    select.value = selectedValue;
  });
}

function getTextureForFace(faceName) {
  const value = faceSelectors[faceName].value;
  return numberedTextures[value] || numberedTextures[1];
}

// Add change listeners to all selectors
Object.values(faceSelectors).forEach(select => {
  select.addEventListener('change', () => {
    if (numberedTextures[1]) processTexture();
  });
});

function processTexture() {
  if (!numberedTextures[1]) return;
  
  // Clear canvas with transparency
  ctx.clearRect(0, 0, 128, 128);
  
  // Create temporary canvas for transformations
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 16;
  tempCanvas.height = 16;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.imageSmoothingEnabled = false;
  
  // Get all textures
  const bottomTexture = getTextureForFace('bottom');
  const topTexture = getTextureForFace('top');
  const leftTexture = getTextureForFace('left');
  const frontTexture = getTextureForFace('front');
  const rightTexture = getTextureForFace('right');
  const backTexture = getTextureForFace('back');
  
  // Bottom: No transformation, draw at (16, 0) - this is the original texture position
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.drawImage(bottomTexture, 0, 0, 16, 16);
  ctx.drawImage(tempCanvas, 16, 0);
  
  // Top: Rotate 180° + flip horizontally, draw at (32, 0)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.scale(-1, 1);
  tempCtx.drawImage(topTexture, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tempCanvas, 32, 0);
  
  // Left: Rotate 180°, draw at (0, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(leftTexture, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tempCanvas, 0, 16);
  
  // Front: Rotate 180°, draw at (16, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(frontTexture, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tempCanvas, 16, 16);
  
  // Right: Rotate 180°, draw at (32, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(rightTexture, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tempCanvas, 32, 16);
  
  // Back: Rotate 180°, draw at (48, 16)
  tempCtx.clearRect(0, 0, 16, 16);
  tempCtx.translate(8, 8);
  tempCtx.rotate(Math.PI);
  tempCtx.drawImage(backTexture, -8, -8, 16, 16);
  tempCtx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tempCanvas, 48, 16);
}

downloadBtn.addEventListener('click', () => {
  outputCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed-texture.png';
    a.click();
    URL.revokeObjectURL(url);
  });
});

// UUID Generator (v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Modal controls
addToPackBtn.addEventListener('click', () => {
  modal.style.display = 'block';
  inputStep.style.display = 'block';
  packStep.style.display = 'none';
  identifierInput.value = '';
  skinNameInput.value = '';
  identifierError.textContent = '';
  continueBtn.disabled = true;
});

viewPackBtn.addEventListener('click', () => {
  if (skinPackData.skins.length === 0) return;
  modal.style.display = 'block';
  inputStep.style.display = 'none';
  packStep.style.display = 'block';
  updatePreview();
});

closeModal.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Identifier validation
const identifierRegex = /^[a-z0-9_]+$/;

function validateIdentifier() {
  const value = identifierInput.value.trim();
  
  if (!value) {
    identifierError.textContent = '';
    continueBtn.disabled = true;
    return false;
  }
  
  if (!identifierRegex.test(value)) {
    identifierError.textContent = 'Identifier may only contain lowercase letters, numbers, and underscores.';
    continueBtn.disabled = true;
    return false;
  }

  const isDuplicate = skinPackData.skins.some(skin => skin.identifier === value);
  if (isDuplicate) {
    identifierError.textContent = 'This identifier is already used in this skin pack.';
    continueBtn.disabled = true;
    return false;
  }
  
  identifierError.textContent = '';
  continueBtn.disabled = !skinNameInput.value.trim();
  return true;
}

identifierInput.addEventListener('input', validateIdentifier);
skinNameInput.addEventListener('input', () => {
  if (validateIdentifier() && skinNameInput.value.trim()) {
    continueBtn.disabled = false;
  } else {
    continueBtn.disabled = true;
  }
});

// Continue to pack step
continueBtn.addEventListener('click', async () => {
  const identifier = identifierInput.value.trim();
  const skinName = skinNameInput.value.trim();
  
  // Get current canvas as blob
  const blob = await new Promise(resolve => outputCanvas.toBlob(resolve));
  
  // Add skin to pack
  skinPackData.skins.push({
    identifier,
    skinName,
    textureBlob: blob
  });
  
  // Update folder name inputs
  folderNameInput.value = skinPackData.folderName;
  manifestNameInput.value = skinPackData.manifestName;
  manifestDescInput.value = skinPackData.manifestDesc;
  
  // Update preview
  updatePreview();
  
  // Show pack step
  inputStep.style.display = 'none';
  packStep.style.display = 'block';
});

// Update preview
function updatePreview() {
  previewFolderName.textContent = folderNameInput.value;
  
  // Update the folder tree to show all skins
  const folderTree = document.querySelector('.folder-tree');
  
  folderTree.innerHTML = `
    <div class="tree-item folder">
      <span>📁 <span id="previewFolderName">${folderNameInput.value}</span></span>
      <div class="tree-children">
        ${skinPackData.skins.map(skin => `<div class="tree-item file">${skin.identifier}.png</div>`).join('')}
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

// Add another skin
addAnotherBtn.addEventListener('click', () => {
  // Close modal and reset to initial state
  modal.style.display = 'none';
  
  // Reset textures
  Object.keys(numberedTextures).forEach(key => delete numberedTextures[key]);
  Object.keys(textureNames).forEach(key => delete textureNames[key]);
  
  // Clear all selectors
  Object.values(faceSelectors).forEach(select => {
    select.innerHTML = '';
  });
  
  // Reset UI
  textureListEl.innerHTML = '';
  canvasContainer.style.display = 'none';
  fileInput.style.display = 'block';
  fileInput.value = '';
  additionalTexturesInput.value = '';
  updateTextureCount();
  
  // Clear canvas
  ctx.clearRect(0, 0, 128, 128);
});

// Export skin pack
exportPackBtn.addEventListener('click', async () => {
  const zip = new JSZip();
  const rootFolder = zip.folder(skinPackData.folderName);
  
  // Add texture files
  for (const skin of skinPackData.skins) {
    rootFolder.file(`${skin.identifier}.png`, skin.textureBlob);
  }
  
  // Create manifest.json
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
        type: "skin_pack",
        uuid: skinPackData.moduleUUID
      }
    ],
    format_version: 1
  };
  rootFolder.file('manifest.json', JSON.stringify(manifest, null, 2));
  
  // Create skins.json
  const skinsJson = {
    format_version: "1.10.0",
    serialize_name: "blocks",
    localization_name: "blocks",
    skins: skinPackData.skins.map(skin => ({
      localization_name: skin.identifier,
      geometry: "geometry.humanoid.custom",
      texture: `${skin.identifier}.png`,
      cape: "cape.png",
      type: "free",
      animations: {
        humanoid_base_pose: "animation.player.base_pose.upside_down",
        look_at_target: "animation.witch.general",
        look_at_target_ui: "animation.witch.general",
        "move.legs": "animation.chicken.baby_transform",
        "move.arms": "animation.sheep.setup",
        bob: "animation.parrot.sitting",
        holding: "animation.evoker.general",
        "attack.positions": "animation.witch.general",
        "attack.rotations": "animation.witch.general",
        sneaking: "animation.witch.general"
      },
      enable_attachables: false
    }))
  };
  rootFolder.file('skins.json', JSON.stringify(skinsJson, null, 2));
  
  // Create text folder
  const textFolder = rootFolder.folder('text');
  textFolder.file('languages.json', JSON.stringify(["en_US"], null, 2));
  
  // Create en_US.lang
  let langContent = 'skinpack.blocks=Block Skins\n';
  for (const skin of skinPackData.skins) {
    langContent += `skin.blocks.${skin.identifier}=${skin.skinName}\n`;
  }
  textFolder.file('en_US.lang', langContent);
  
  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${skinPackData.folderName}.mcpack`;
  a.click();
  URL.revokeObjectURL(url);
  
  modal.style.display = 'none';
});