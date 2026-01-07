/// DELETE_ME__
// textureEditor.js
// Handles texture upload, selection, and canvas rendering for the block skin,
// now with unlimited textures and searchable thumbnail dropdowns.

export function initTextureEditor({
  fileInput,
  canvasContainer,
  outputCanvas,
  downloadBtn,
  saveEditBtn,
  additionalTexturesInput,
  textureCountEl,
  textureListEl,
  faceSelectors,
  addToPackBtn,
  viewPackBtn,
  importPackBtn
}) {
  const ctx = outputCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /**
   * Internal texture model:
   * textures: [{ id, name, img }]
   */
  const textures = [];
  let nextTextureId = 1;

  // Edit mode state (for hover pencil special face selection)
  let isEditMode = false;
  let editingTextureId = null;

  // Per-face selected texture id
  const faceTextureIds = {
    top: null,
    bottom: null,
    left: null,
    right: null,
    front: null,
    back: null
  };

  // Searchable dropdown UI per face
  const faceDropdowns = {};

  function updateTextureCount() {
    const count = textures.length;
    textureCountEl.textContent = `${count} texture${count === 1 ? '' : 's'}`;
  }

  function setEditMode(enabled, textureId = null) {
    isEditMode = enabled;
    editingTextureId = enabled ? textureId : null;

    if (saveEditBtn) {
      saveEditBtn.style.display = enabled ? 'inline-block' : 'none';
    }
    if (addToPackBtn) {
      addToPackBtn.style.display = enabled ? 'none' : 'inline-block';
    }
    if (viewPackBtn) {
      viewPackBtn.style.display = enabled && !viewPackBtn.dataset.forceVisible ? 'none' : viewPackBtn.style.display || 'none';
      if (!enabled && textures.length) {
        // keep whatever existing state is
      }
    }
    if (importPackBtn) {
      importPackBtn.style.display = enabled ? 'none' : 'inline-block';
    }
  }

  function renderTextureList() {
    textureListEl.innerHTML = '';

    textures
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach((tex) => {
        const div = document.createElement('div');
        div.className = 'texture-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'texture-name';
        nameSpan.textContent = tex.name;

        const controls = document.createElement('div');
        controls.className = 'texture-controls';

        const editIcon = document.createElement('button');
        editIcon.className = 'texture-edit-icon';
        editIcon.title = 'Edit this texture';
        editIcon.textContent = '✏️';
        editIcon.addEventListener('click', () => {
          // Enter special face selection edit mode for this texture
          if (!tex) return;
          // apply this texture to all faces
          Object.keys(faceTextureIds).forEach((face) => {
            faceTextureIds[face] = tex.id;
          });
          Object.entries(faceDropdowns).forEach(([face, dd]) => {
            dd.setSelectedTexture(tex);
          });
          processTexture();
          canvasContainer.style.display = 'flex';
          fileInput.style.display = 'none';
          setEditMode(true, tex.id);
        });

        const renameBtn = document.createElement('button');
        renameBtn.className = 'texture-rename-icon';
        renameBtn.title = 'Change display name';
        renameBtn.textContent = '⋯';
        renameBtn.addEventListener('click', () => {
          const newName = window.prompt('Display name for this texture:', tex.name);
          if (newName !== null) {
            const trimmed = newName.trim();
            if (trimmed) {
              tex.name = trimmed;
              renderTextureList();
              rebuildAllFaceDropdowns();
            }
          }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'texture-delete-icon';
        deleteBtn.title = 'Remove this texture';
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', () => deleteTexture(tex.id));

        controls.appendChild(editIcon);
        controls.appendChild(renameBtn);
        controls.appendChild(deleteBtn);

        div.appendChild(nameSpan);
        div.appendChild(controls);
        textureListEl.appendChild(div);
      });
  }

  function deleteTexture(id) {
    if (textures.length === 1) {
      alert('Error: Must keep at least one texture');
      return;
    }

    const idx = textures.findIndex((t) => t.id === id);
    if (idx === -1) return;
    textures.splice(idx, 1);

    // Clear any faces using this texture
    Object.keys(faceTextureIds).forEach((face) => {
      if (faceTextureIds[face] === id) {
        faceTextureIds[face] = textures[0]?.id ?? null;
      }
    });

    updateTextureCount();
    renderTextureList();
    rebuildAllFaceDropdowns();
    processTexture();
  }

  function getTextureById(id) {
    return textures.find((t) => t.id === id) || null;
  }

  function getTextureForFace(faceName) {
    const id = faceTextureIds[faceName];
    if (id != null) {
      return getTextureById(id)?.img || null;
    }
    return textures[0]?.img || null;
  }

  function processTexture() {
    if (!textures.length) return;

    ctx.clearRect(0, 0, 128, 128);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 16;
    tempCanvas.height = 16;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;

    const bottomTexture = getTextureForFace('bottom');
    const topTexture = getTextureForFace('top');
    const leftTexture = getTextureForFace('left');
    const frontTexture = getTextureForFace('front');
    const rightTexture = getTextureForFace('right');
    const backTexture = getTextureForFace('back');

    if (!bottomTexture || !topTexture || !leftTexture || !frontTexture || !rightTexture || !backTexture) {
      return;
    }

    // Bottom: (16, 0)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.drawImage(bottomTexture, 0, 0, 16, 16);
    ctx.drawImage(tempCanvas, 16, 0);

    // Top: rotate 180° + flip horizontally, (32, 0)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.translate(8, 8);
    tempCtx.rotate(Math.PI);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(topTexture, -8, -8, 16, 16);
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 32, 0);

    // Left: rotate 180°, (0, 16)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.translate(8, 8);
    tempCtx.rotate(Math.PI);
    tempCtx.drawImage(leftTexture, -8, -8, 16, 16);
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 0, 16);

    // Front: rotate 180°, (16, 16)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.translate(8, 8);
    tempCtx.rotate(Math.PI);
    tempCtx.drawImage(frontTexture, -8, -8, 16, 16);
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 16, 16);

    // Right: rotate 180°, (32, 16)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.translate(8, 8);
    tempCtx.rotate(Math.PI);
    tempCtx.drawImage(rightTexture, -8, -8, 16, 16);
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 32, 16);

    // Back: rotate 180°, (48, 16)
    tempCtx.clearRect(0, 0, 16, 16);
    tempCtx.translate(8, 8);
    tempCtx.rotate(Math.PI);
    tempCtx.drawImage(backTexture, -8, -8, 16, 16);
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tempCanvas, 48, 16);
  }

  function createFaceDropdown(faceName, selectEl) {
    selectEl.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'face-dropdown';

    const label = document.createElement('div');
    label.className = 'face-dropdown-label';
    label.textContent = 'Select texture';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'face-search-input';
    searchInput.placeholder = 'Search textures';

    const list = document.createElement('div');
    list.className = 'face-dropdown-list';
    list.style.display = 'none';

    wrapper.appendChild(label);
    wrapper.appendChild(searchInput);
    wrapper.appendChild(list);

    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

    function closeList() {
      list.style.display = 'none';
    }

    function openList() {
      list.style.display = 'block';
    }

    function setSelectedTexture(tex) {
      if (!tex) return;
      faceTextureIds[faceName] = tex.id;

      // Show only thumbnail (no text) on the label
      label.innerHTML = '';
      const thumb = document.createElement('img');
      thumb.className = 'face-label-thumb';
      thumb.src = tex.img.src;
      thumb.alt = tex.name;
      label.appendChild(thumb);

      processTexture();
    }

    function rebuildList() {
      list.innerHTML = '';
      const q = searchInput.value.trim().toLowerCase();

      textures.forEach((tex) => {
        if (q && !tex.name.toLowerCase().includes(q)) return;

        const item = document.createElement('div');
        item.className = 'face-option';

        const thumb = document.createElement('img');
        thumb.className = 'face-option-thumb';
        thumb.src = tex.img.src;
        thumb.alt = tex.name;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'face-option-name';
        nameSpan.textContent = tex.name;

        item.appendChild(thumb);
        item.appendChild(nameSpan);

        item.addEventListener('click', () => {
          setSelectedTexture(tex);
          closeList();
        });

        list.appendChild(item);
      });
    }

    label.addEventListener('click', () => {
      if (!textures.length) return;
      if (list.style.display === 'none') {
        rebuildList();
        openList();
      } else {
        closeList();
      }
    });

    searchInput.addEventListener('focus', () => {
      if (!textures.length) return;
      rebuildList();
      openList();
    });

    searchInput.addEventListener('input', () => {
      rebuildList();
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        closeList();
      }
    });

    faceDropdowns[faceName] = {
      wrapper,
      label,
      searchInput,
      list,
      rebuildList,
      setSelectedTexture
    };
  }

  function rebuildAllFaceDropdowns() {
    Object.values(faceDropdowns).forEach((dd) => dd.rebuildList());
  }

  // Initialize dropdowns for each face
  Object.entries(faceSelectors).forEach(([faceName, selectEl]) => {
    createFaceDropdown(faceName, selectEl);
  });

  function ensureFacesHaveDefaultTexture() {
    if (!textures.length) return;
    const defaultId = textures[0].id;
    Object.keys(faceTextureIds).forEach((face) => {
      if (faceTextureIds[face] == null) faceTextureIds[face] = defaultId;
    });
    Object.entries(faceDropdowns).forEach(([face, dd]) => {
      const tex = getTextureById(faceTextureIds[face]) || textures[0];
      dd.setSelectedTexture(tex);
    });
  }

  function addTextureInternal(name, img, { applyToAllFaces = false } = {}) {
    const tex = {
      id: nextTextureId++,
      name: name || `Texture ${nextTextureId - 1}`,
      img
    };
    textures.push(tex);
    updateTextureCount();
    renderTextureList();
    rebuildAllFaceDropdowns();

    if (textures.length === 1 || applyToAllFaces) {
      Object.keys(faceTextureIds).forEach((face) => {
        faceTextureIds[face] = tex.id;
      });
      Object.values(faceDropdowns).forEach((dd) => dd.setSelectedTexture(tex));
    } else {
      ensureFacesHaveDefaultTexture();
    }

    processTexture();
    return tex.id;
  }

  function addTextureFromBlob(name, blob, options = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const id = addTextureInternal(name, img, options);
        URL.revokeObjectURL(img.src);
        resolve(id);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(img.src);
        reject(err);
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  function loadBlobAsImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  async function updateExternalTextureInternal(id, { name, blob } = {}) {
    const tex = getTextureById(id);
    if (!tex) return;

    if (name && typeof name === 'string') {
      tex.name = name;
    }

    if (blob) {
      const img = await loadBlobAsImage(blob);
      tex.img = img;
    }

    renderTextureList();
    rebuildAllFaceDropdowns();
    ensureFacesHaveDefaultTexture();
    processTexture();
  }

  // File input: initial textures (unlimited)
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const promises = files.map(
      (file) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            addTextureInternal(file.name.replace(/\.png$/i, ''), img);
            URL.revokeObjectURL(img.src);
            resolve();
          };
          img.src = URL.createObjectURL(file);
        })
    );

    Promise.all(promises).then(() => {
      canvasContainer.style.display = 'flex';
      fileInput.style.display = 'none';
    });
  });

  // Additional textures (unlimited)
  additionalTexturesInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const promises = files.map(
      (file) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            addTextureInternal(file.name.replace(/\.png$/i, ''), img);
            URL.revokeObjectURL(img.src);
            resolve();
          };
          img.src = URL.createObjectURL(file);
        })
    );

    Promise.all(promises).then(() => {
      if (!textures.length) return;
      canvasContainer.style.display = 'flex';
      fileInput.style.display = 'none';
    });
  });

  // Download single PNG
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

  // Save button: exit edit mode and keep current face assignments
  if (saveEditBtn) {
    saveEditBtn.addEventListener('click', () => {
      setEditMode(false, null);
    });
  }

  function resetTextures() {
    textures.length = 0;
    nextTextureId = 1;
    Object.keys(faceTextureIds).forEach((face) => (faceTextureIds[face] = null));

    textureListEl.innerHTML = '';
    canvasContainer.style.display = 'none';
    fileInput.style.display = 'block';
    fileInput.value = '';
    additionalTexturesInput.value = '';
    updateTextureCount();
    ctx.clearRect(0, 0, 128, 128);

    Object.values(faceDropdowns).forEach((dd) => {
      dd.label.innerHTML = 'Select texture';
      dd.searchInput.value = '';
      dd.list.innerHTML = '';
    });

    setEditMode(false, null);
  }

  // Public API for external modules (skinPack, resourcePackImport)
  return {
    resetTextures,
    getCurrentCanvas: () => outputCanvas,
    hasBaseTexture: () => Boolean(textures.length),
    /**
     * Add a texture from an external blob (e.g. skin pack PNG or resource pack output).
     * options:
     *  - applyToAllFaces: boolean (default false)
     * Returns a Promise resolving to the internal texture id.
     */
    addExternalTexture: (name, blob, options = {}) => addTextureFromBlob(name, blob, options),
    /**
     * Update an existing external texture by id.
     * changes: { name?: string, blob?: Blob }
     */
    updateExternalTexture: (id, changes = {}) => updateExternalTextureInternal(id, changes),
    showEditor: () => {
      if (textures.length) {
        canvasContainer.style.display = 'flex';
        fileInput.style.display = 'none';
      }
    }
  };
}