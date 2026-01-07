/// DELETE_ME__

// app.js
// Orchestrator module wiring together the texture editor, skin pack modal, and resource-pack import flows.

// removed inline texture processing & texture state management {}
// removed inline skin pack modal logic and pack file generation {}
// removed inline resource pack import and auto skin generation logic {}

import { initTextureEditor } from './textureEditor.js';
import { initSkinPack } from './skinPack.js';
import { initResourcePackImport } from './resourcePackImport.js';

const homeBtn = document.getElementById('homeBtn');

// Core editor DOM
const fileInput = document.getElementById('fileInput');
const canvasContainer = document.getElementById('canvasContainer');
const outputCanvas = document.getElementById('outputCanvas');
const downloadBtn = document.getElementById('downloadBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const addToPackBtn = document.getElementById('addToPackBtn');
const viewPackBtn = document.getElementById('viewPackBtn');
const importPackBtn = document.getElementById('importPackBtn');
const additionalTexturesInput = document.getElementById('additionalTextures');
const textureCount = document.getElementById('textureCount');
const textureListEl = document.getElementById('textureList');

const faceSelectors = {
  top: document.querySelector('[data-face="top"]'),
  front: document.querySelector('[data-face="front"]'),
  left: document.querySelector('[data-face="left"]'),
  bottom: document.querySelector('[data-face="bottom"]'),
  right: document.querySelector('[data-face="right"]'),
  back: document.querySelector('[data-face="back"]')
};

// Skin pack modal DOM
const skinPackModal = document.getElementById('skinPackModal');
const closeModal = document.querySelector('#skinPackModal .close');
const inputStep = document.getElementById('inputStep');
const packStep = document.getElementById('packStep');
const identifierInput = document.getElementById('identifierInput');
const skinNameInput = document.getElementById('skinNameInput');
const identifierError = document.getElementById('identifierError');
const continueBtn = document.getElementById('continueBtn');
const folderNameInput = document.getElementById('folderNameInput');
const manifestNameInput = document.getElementById('manifestNameInput');
const manifestDescInput = document.getElementById('manifestDescInput');
const addAnotherBtn = document.getElementById('addAnotherBtn');
const exportPackBtn = document.getElementById('exportPackBtn');

// Resource pack modal DOM
const rpModal = document.getElementById('resourcePackModal');
const rpClose = document.getElementById('rpClose');
const rpStepSelect = document.getElementById('rpStepSelect');
const rpProcessing = document.getElementById('rpProcessing');
const rpReview = document.getElementById('rpReview');
const rpFileInput = document.getElementById('resourcePackInput');

const rpProgressBar = document.getElementById('rpProgressBar');
const rpProgressFill = document.getElementById('rpProgressFill');
const rpProgressLabel = document.getElementById('rpProgressLabel');
const rpPackNameInput = document.getElementById('rpPackNameInput');
const rpPackDescInput = document.getElementById('rpPackDescInput');
const rpSkinList = document.getElementById('rpSkinList');
const rpBackBtn = document.getElementById('rpBackBtn');
const rpExportBtn = document.getElementById('rpExportBtn');
const rpExportFormat = document.getElementById('rpExportFormat');

// Initialize texture editor
const textureEditor = initTextureEditor({
  fileInput,
  canvasContainer,
  outputCanvas,
  downloadBtn,
  saveEditBtn,
  additionalTexturesInput,
  textureCountEl: textureCount,
  textureListEl,
  faceSelectors,
  addToPackBtn,
  viewPackBtn,
  importPackBtn
});

// Initialize skin pack flow
const skinPack = initSkinPack({
  outputCanvas,
  addToPackBtn,
  viewPackBtn,
  importPackBtn,
  modalEl: skinPackModal,
  closeModalEl: closeModal,
  inputStepEl: inputStep,
  packStepEl: packStep,
  identifierInput,
  skinNameInput,
  identifierErrorEl: identifierError,
  continueBtn,
  folderNameInput,
  manifestNameInput,
  manifestDescInput,
  addAnotherBtn,
  exportPackBtn,
  textureEditor
});

// Initialize resource pack import
const rpImportApi = initResourcePackImport({
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
  textureEditor
});

// Global click handler for closing modals when clicking backdrop
window.addEventListener('click', (e) => {
  if (e.target === skinPackModal) {
    skinPackModal.style.display = 'none';
  }
  if (e.target === rpModal) {
    rpModal.style.display = 'none';
  }
});

// Global Home / Back: reset state and return to home
homeBtn.addEventListener('click', () => {
  // Reset texture editor
  if (textureEditor && textureEditor.resetTextures) {
    textureEditor.resetTextures();
  }

  // Reset skin pack
  if (skinPack && skinPack.resetPack) {
    skinPack.resetPack();
  }

  // Close modals
  skinPackModal.style.display = 'none';
  rpModal.style.display = 'none';
});