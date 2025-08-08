  const upload = document.getElementById("upload");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const downloadBtn = document.getElementById("download");
  const resetBtn = document.getElementById("reset");

  // === Tunables ===
  const OVERLAY_WIDTH_RATIO = 0.28; // overlay width as % of image width
  const BASE_PADDING_PX     = 12;   // min padding to edges
  const CLAMP_WITHIN_BOUNDS = true; // keep overlay fully inside canvas
  const NUDGE_STEP          = 1;    // arrow keys (px)
  const NUDGE_STEP_FAST     = 8;    // arrow keys with Shift (px)

  // Images
  let headshot = null;
  const overlayImage = new Image();

  // If overlay is cross-origin and you need to download the result to be anonymous. this will fail on file:// URLs, so putting in a try block
 
  overlayImage.crossOrigin = "anonymous";
  overlayImage.src = "CopilotChampionOverlay.png";
  

  // State for overlay rectangle (in CSS pixel coordinates)
  const overlay = { x: 0, y: 0, w: 0, h: 0 };

  // Drag state
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // For crisp rendering on high-DPI displays, we’ll draw in CSS pixel units and scale the backing store.
  function setupHiDPI() {
    const dpr = window.devicePixelRatio || 1;
    // Keep the "CSS size" equal to the image size (in CSS pixels)
    const cssWidth  = headshot.naturalWidth;
    const cssHeight = headshot.naturalHeight;

    // Backing store size is scaled by DPR
    canvas.width  = Math.max(1, Math.round(cssWidth  * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));

    // Reset transform and apply DPR scaling so all coords are in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Also set the canvas element's logical (CSS) size so it can downscale responsively
    canvas.style.width  = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
  }

  function whenLoaded(img) {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
  }

  function drawAll() {
    if (!headshot) return;
    // Clear and redraw
    ctx.clearRect(0, 0, canvasWidth(), canvasHeight());
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(headshot, 0, 0, canvasWidth(), canvasHeight());
    // Draw overlay
    if (overlayImage.complete && overlayImage.naturalWidth > 0) {
      ctx.drawImage(overlayImage, overlay.x, overlay.y, overlay.w, overlay.h);
    }
  }

  function canvasWidth()  { return headshot ? headshot.naturalWidth  : canvas.width; }
  function canvasHeight() { return headshot ? headshot.naturalHeight : canvas.height; }

  function computeInitialOverlay() {
    const padding = dynamicPadding();
    const natW = overlayImage.naturalWidth;
    const natH = overlayImage.naturalHeight;
    const aspect = natH / natW;

    let w = Math.round(canvasWidth() * OVERLAY_WIDTH_RATIO);
    let h = Math.round(w * aspect);

    // Fit by height if needed
    const maxH = canvasHeight() - 2 * padding;
    if (h > maxH) {
      h = Math.round(maxH);
      w = Math.round(h / aspect);
    }

    // Left-aligned with padding, vertically centered
    const x = padding;
    const y = Math.round((canvasHeight() - h) / 2);

    overlay.x = x;
    overlay.y = y;
    overlay.w = w;
    overlay.h = h;
  }

  function dynamicPadding() {
    return Math.round(Math.max(BASE_PADDING_PX, canvasWidth() * 0.015));
  }

  // Hit test: is point inside current overlay rect?
  function hitOverlay(px, py) {
    return (
      px >= overlay.x &&
      py >= overlay.y &&
      px <= overlay.x + overlay.w &&
      py <= overlay.y + overlay.h
    );
  }

  // Get pointer position in canvas CSS-pixel coordinates
  function getCanvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    // Scale client coords into canvas CSS pixels
    const scaleX = canvasWidth() / rect.width;
    const scaleY = canvasHeight() / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  function clampOverlay() {
    if (!CLAMP_WITHIN_BOUNDS) return;
    const pad = dynamicPadding();
    const minX = pad;
    const minY = pad;
    const maxX = canvasWidth() - pad - overlay.w;
    const maxY = canvasHeight() - pad - overlay.h;
    overlay.x = Math.min(Math.max(overlay.x, minX), maxX);
    overlay.y = Math.min(Math.max(overlay.y, minY), maxY);
  }

  // Pointer Events (mouse/touch/pen unified)
  canvas.addEventListener("pointerdown", (e) => {
    if (!headshot) return;
    const p = getCanvasPoint(e);
    if (hitOverlay(p.x, p.y)) {
      isDragging = true;
      dragOffsetX = p.x - overlay.x;
      dragOffsetY = p.y - overlay.y;
      canvas.classList.add("dragging");
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const p = getCanvasPoint(e);
    overlay.x = Math.round(p.x - dragOffsetX);
    overlay.y = Math.round(p.y - dragOffsetY);
    clampOverlay();
    drawAll();
    e.preventDefault();
  });

  function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    canvas.classList.remove("dragging");
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", endDrag); // safety

  // Keyboard nudging (arrow keys). Focus the page or the canvas to use.
  window.addEventListener("keydown", (e) => {
    if (!headshot) return;
    const fast = e.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP;
    let moved = false;
    if (e.key === "ArrowLeft")  { overlay.x -= fast; moved = true; }
    if (e.key === "ArrowRight") { overlay.x += fast; moved = true; }
    if (e.key === "ArrowUp")    { overlay.y -= fast; moved = true; }
    if (e.key === "ArrowDown")  { overlay.y += fast; moved = true; }
    if (moved) {
      clampOverlay();
      drawAll();
      e.preventDefault();
    }
  });

    // Upload workflow
  upload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        headshot = new Image();
        headshot.src = event.target.result;
        await whenLoaded(headshot);
        await whenLoaded(overlayImage);

        // Prepare canvas for crisp drawing at devicePixelRatio
        setupHiDPI();

        // Place overlay initially on the left, vertically centered
        computeInitialOverlay();

        drawAll();
      } catch (err) {
        console.error("Failed to render:", err);
      }
    };
    reader.readAsDataURL(file);
  });

  // Download button
  downloadBtn.addEventListener("click", () => {
    try {
      const link = document.createElement("a");
      link.download = "CopilotChampion-TeamsImage.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed (possible CORS issue):", err);
    }
  });

