(() => {
  // ───────── CONFIGURATION & STATE ─────────
  const state = {
    boardType: 'esp32-s3-mini',
    components: [],
    connections: [],
    selectedPin: null,
    draggingComponent: null,
    dragOffset: { x: 0, y: 0 },
    nextId: 1
  };

  // ───────── HARDWARE DEFINITIONS ─────────
  const BOARDS = {
    'esp32-s3-mini': {
      label: 'ESP32-S3 Super Mini',
      width: 180, height: 240,
      pins: [
        { id: 'gnd', label: 'GND', x: 20, y: 20 }, { id: '3v3', label: '3V3', x: 50, y: 20 },
        { id: 'gpio0', label: 'GPIO0', x: 80, y: 20 }, { id: 'gpio1', label: 'GPIO1', x: 110, y: 20 },
        { id: 'gpio2', label: 'GPIO2', x: 140, y: 20 }, { id: 'gpio3', label: 'GPIO3', x: 170, y: 20 },
        { id: 'gpio4', label: 'GPIO4', x: 170, y: 50 }, { id: 'gpio5', label: 'GPIO5', x: 170, y: 80 },
        { id: 'gpio6', label: 'GPIO6', x: 170, y: 110 }, { id: 'gpio7', label: 'GPIO7', x: 170, y: 140 },
        { id: 'gpio8', label: 'GPIO8', x: 170, y: 170 }, { id: 'gpio9', label: 'GPIO9', x: 170, y: 200 },
        { id: 'gpio10', label: 'GPIO10', x: 170, y: 230 }, { id: 'gpio11', label: 'GPIO11', x: 140, y: 230 },
        { id: 'gpio12', label: 'GPIO12', x: 110, y: 230 }, { id: 'gpio13', label: 'GPIO13', x: 80, y: 230 },
        { id: 'gpio14', label: 'GPIO14', x: 50, y: 230 }, { id: 'gpio15', label: 'GPIO15', x: 20, y: 230 },
        { id: 'gpio16', label: 'GPIO16', x: 20, y: 200 }, { id: 'gpio17', label: 'GPIO17', x: 20, y: 170 },
        { id: 'gpio18', label: 'GPIO18 (USB D-)', x: 20, y: 140 }, { id: 'gpio19', label: 'GPIO19 (USB D+)', x: 20, y: 110 },
        { id: 'gpio33', label: 'GPIO33', x: 20, y: 80 }, { id: 'gpio34', label: 'GPIO34', x: 50, y: 80 },
        { id: 'gpio35', label: 'GPIO35', x: 80, y: 80 }, { id: 'gpio36', label: 'GPIO36', x: 110, y: 80 },
      ]
    },
    'esp32-c3-mini': {
      label: 'ESP32-C3 Super Mini',
      width: 160, height: 220,
      pins: [
        // Top Row (Left to Right)
        { id: 'gnd', label: 'GND', x: 15, y: 20 },
        { id: '3v3', label: '3V3', x: 45, y: 20 },
        { id: 'gpio0', label: 'GPIO0', x: 75, y: 20 },
        { id: 'gpio1', label: 'GPIO1', x: 105, y: 20 },
        { id: 'gpio2', label: 'GPIO2', x: 135, y: 20 },
        
        // Right Side (Top to Bottom)
        { id: 'gpio3', label: 'GPIO3', x: 160, y: 50 },
        { id: 'gpio4', label: 'GPIO4', x: 160, y: 80 },
        { id: 'gpio5', label: 'GPIO5', x: 160, y: 110 },
        { id: 'gpio6', label: 'GPIO6', x: 160, y: 140 },
        { id: 'gpio7', label: 'GPIO7', x: 160, y: 170 },
        
        // Bottom Row (Right to Left)
        { id: 'gpio8', label: 'GPIO8', x: 135, y: 220 },
        { id: 'gpio18', label: 'GPIO18', x: 105, y: 220 },
        { id: 'gpio19', label: 'GPIO19', x: 75, y: 220 },
        
        // Left Side (Bottom to Top)
        { id: 'gpio20', label: 'GPIO20', x: 0, y: 170 },
        { id: 'gpio21', label: 'GPIO21', x: 0, y: 140 },
        { id: 'adc3', label: 'ADC3 (IO26)', x: 0, y: 110 },
        { id: 'adc4', label: 'ADC4 (IO27)', x:
        { id: 'adc4', label: 'ADC4 (IO27)', x: 0, y: 80 },
        { id: 'gpio22', label: 'GPIO22', x: 0, y: 50 }
      ]
    }
  };

  const COMPONENT_TYPES = [
    { 
      type: 'dht22', 
      name: 'DHT22 Sensor', 
      icon: '🌡️', 
      libs: ['DHT sensor library by Adafruit'], 
      requiredPins: ['vcc', 'gnd', 'data'] 
    },
    { 
      type: 'bme280', 
      name: 'BME280 Sensor (I2C)', 
      icon: '🌬️', 
      libs: ['Adafruit_BME280.h'], 
      requiredPins: ['vcc', 'gnd', 'sda', 'scl'] 
    },
    { 
      type: 'relay', 
      name: 'Relay Module (3V/5V)', 
      icon: '🔌', 
      libs: ['None required'], 
      requiredPins: ['vcc', 'gnd', 'signal'] 
    },
    { 
      type: 'led', 
      name: 'LED + Resistor', 
      icon: '💡', 
      libs: ['None required'], 
      requiredPins: ['vcc', 'gnd', 'control'] 
    },
    { 
      type: 'potentiometer', 
      name: 'Potentiometer (ADC)', 
      icon: '🎛️', 
      libs: ['None required'], 
      requiredPins: ['vcc', 'gnd', 'analog'] 
    }
  ];

  // ───────── DOM ELEMENTS ─────────
  const els = {
    boardSelect: document.getElementById('board-select'),
    canvasContainer: document.getElementById('canvas-container'),
    wiringLayer: document.getElementById('wiring-layer'),
    componentArea: document.getElementById('component-area'),
    libraryList: document.getElementById('library-list'),
    propsContent: document.getElementById('props-content'),
    btnReset: document.getElementById('btn-reset'),
    btnExport: document.getElementById('btn-export')
  };

  // ───────── INITIALIZATION ─────────
  function init() {
    renderLibrary();
    setupEventListeners();
    
    // Initial board render
    renderBoard(els.boardSelect.value);
  }

  function renderLibrary() {
    els.libraryList.innerHTML = '';
    COMPONENT_TYPES.forEach(comp => {
      const li = document.createElement('li');
      li.className = 'lib-item';
      li.draggable = true;
      li.dataset.type = comp.type;
      li.innerHTML = `
        <strong>${comp.icon} ${comp.name}</strong>
        <small class="lib-meta">Pins: ${comp.requiredPins.join(', ')}</small>
      `;
      
      // Drag start from library (DataTransfer)
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('componentType', comp.type);
        e.dataTransfer.effectAllowed = 'copy';
      });

      els.libraryList.appendChild(li);
    });
  }

  // ───────── BOARD RENDERING ─────────
  function renderBoard(type) {
    state.boardType = type;
    const boardData = BOARDS[type];
    
    // Clear existing
    const oldZone = document.querySelector('.board-zone');
    if(oldZone) oldZone.remove();

    const zone = document.createElement('div');
    zone.className = 'board-zone';
    zone.style.width = `${boardData.width}px`;
    zone.style.height = `${boardData.height}px`;

    // Render Pins as SVG elements inside the board area (we'll overlay them with JS or append to SVG)
    // For simplicity in this draft, we will place pins directly into the DOM and handle SVG lines separately
    
    boardData.pins.forEach(pin => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", "pin");
      circle.setAttribute("id", `board-pin-${pin.id}`);
      // Adjust coordinates slightly to fit within the box visually
      // The board is positioned at 50% center, so we add offsets relative to the board's top-left corner
      // We use a local coordinate system for the pins (x,y) and translate them later
      circle.setAttribute("cx", pin.x);
      circle.setAttribute("cy", pin.y);
      
      // Label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.textContent = pin.label;
      text.setAttribute("x", pin.x + 10);
      text.setAttribute("y", pin.y - 5);
      text.setAttribute("font-size", "8px");
      text.setAttribute("fill", "#94a3b8");

      zone.appendChild(circle);
      zone.appendChild(text);
    });

    const label = document.createElement('div');
    label.className = 'board-label';
    label.textContent = boardData.label;
    zone.appendChild(label);

    els.componentArea.appendChild(zone);
  }

  // ───────── COMPONENT PLACEMENT (DRAG & DROP) ─────────
  els.canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  els.canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('componentType');
    if (!type) return;

    // Calculate drop position relative to canvas container
    const rect = els.componentArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    createComponentInstance(type, x, y);
  });

  function createComponentInstance(type, x, y) {
    const def = COMPONENT_TYPES.find(c => c.type === type);
    if (!def) return;

    const id = `comp-${Date.now()}`;
    
    // Create DOM Element
    const el = document.createElement('div');
    el.className = 'component';
    el.id = id;
    el.dataset.type = def.type;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // HTML Structure of Component
    let pinsHtml = '';
    def.requiredPins.forEach((pinName, index) => {
      const pinId = `${id}-pin-${index}`;
      pinsHtml += `
        <div class="comp-pin" data-comp-id="${id}" data-pin-name="${pinName}">
          <span class="pin-label">${pinName}</span>
          <circle class="pin" cx="0" cy="0" r="6" />
        </div>
      `;
    });

    el.innerHTML = `
      <div class="comp-header">
        <span class="comp-name">${def.icon} ${def.name}</span>
        <button class="btn-remove">&times;</button>
      </div>
      <div class="comp-body" style="display:flex; flex-wrap:wrap; gap:5px; margin-top:10px;">
        ${pinsHtml}
      </div>
    `;

    // Store State
    state.components.push({ id, type, x, y });

    els.componentArea.appendChild(el);

    // Attach Events to new element
    attachComponentEvents(el);
  }

  function attachComponentEvents(el) {
    const removeBtn = el.querySelector('.btn-remove');
    
    // Remove Component
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm('Remove this component?')) {
        // Remove connections associated with this component
        state.connections = state.connections.filter(conn => 
          conn.from.compId !== el.id && conn.to.compId !== el.id && 
          !conn.from.board && !conn.to.board // Simplified check for board pins logic later
        );
        updateWiringLines();
        el.remove();
      }
    });

    // Dragging Component on Canvas
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
      if(e.target.classList.contains('pin')) return; // Don't drag if clicking pin
      
      isDragging = true;
      el.classList.add('dragging');
      
      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = el.offsetLeft;
      initialTop = el.offsetTop;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      el.style.left = `${initialLeft + dx}px`;
      el.style.top = `${initialTop + dy}px`;
      
      // Update state position (optional, for export)
      const compData = state.components.find(c => c.id === el.id);
      if(compData) {
        compData.x = initialLeft + dx;
        compData.y = initialTop + dy;
      }

      updateWiringLines(); // Redraw wires
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      el.classList.remove('dragging');
    });
  }

  // ───────── WIRING LOGIC ─────────
  
  // Handle Pin Clicks (Start/End Connection)
  document.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin');
    if (!pin) return;

    // Identify source of click: Board or Component?
    const isBoardPin = pin.parentElement.classList.contains('board-zone') || 
                       pin.tagName === 'circle' && !pin.closest('.component');
    
    let pinId, pinName;
    
    if (isBoardPin) {
      pinId = `board-${pin.id}`; // Unique ID for board pins
      pinName = pin.getAttribute('cx') + ',' + pin.getAttribute('cy'); // Use coords as identifier or store label
      // Actually, let's use the ID we set earlier: 'board-pin-gpio0'
    } else {
      const compPinContainer = pin.closest('.comp-pin');
      pinId = `${compPinContainer.dataset.compId}-${pinName}`; 
      // Better approach: Use a global unique ID for pins if needed, but for now let's use the element reference
      pinId = `comp-${pin.closest('.component').id}-${pin.parentElement.dataset.pinName}`;
    }

    handlePinClick(pinId);
  });

  function handlePinClick(pinId) {
    const selectedPins = document.querySelectorAll('.pin.active');

    if (state.selectedPin === null) {
      // Select first pin
      state.selectedPin = pinId;
      highlightPin(pinId, true);
    } else {
      // Connect second pin
      if (state.selectedPin !== pinId) {
        addConnection(state.selectedPin, pinId);
      }
      
      // Deselect all
      selectedPins.forEach(p => p.classList.remove('active'));
      state.selectedPin = null;
    }
  }

  function highlightPin(pinId, active) {
    // Find the DOM element for this pin ID and add 'active' class
    // This is a simple lookup. In a larger app, we'd map IDs to elements.
    let el;
    if (pinId.startsWith('board-')) {
      const baseId = pinId.replace('board-', '');
      el = document.getElementById(baseId);
    } else {
       // It's a component pin, ID is like 'comp-xxx-GPIO'
       // We need to find the circle inside. 
       // For simplicity in this draft:
       const comps = document.querySelectorAll('.component');
       for(let c of comps) {
         if(pinId.includes(c.id)) {
           el = c.querySelector(`[data-pin-name="${pinId.split('-').pop()}"] .pin`);
           break;
         }
       }
    }
    
    // Fallback for board pins which are direct children of board-zone usually, but let's be robust
    if(!el) {
        const allPins = document.querySelectorAll('.pin');
        for(let p of allPins) {
            if(p.id === pinId.replace('board-','') || (p.closest('.comp-pin') && pinId.includes(p.closest('.component').id))) {
                el = p; break;
            }
        }
    }

    if(el) {
      if(active) el.classList.add('active');
      else el.classList.remove('active');
    }
  }

  function addConnection(fromId, toId) {
    // Check for duplicates
    const exists = state.connections.some(c => 
        (c.from.id === fromId && c.to.id === toId) || 
        (c.from.id === toId && c.to.id === fromId)
    );

    if (!exists) {
      state.connections.push({ from: { id: fromId }, to: { id: toId } });
      updateWiringLines();
      
      // Open properties for this connection? Optional. 
      // For now, just log or let user click component to see pins.
    } else {
        alert('Connection already exists.');
    }
  }

  function updateWiringLines() {
    els.wiringLayer.innerHTML = ''; // Clear existing lines

    state.connections.forEach(conn => {
      const el1 = getPinElement(conn.from.id);
      const el2 = getPinElement(conn.to.id);

      if (el1 && el2) {
        const svgLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        
        // Get absolute coordinates relative to canvas container
        const r1 = el1.getBoundingClientRect();
        const cRect = els.canvasContainer.getBoundingClientRect();
        
        const x1 = r1.left + r1.width/2 - cRect.left;
        const y1 = r1.top + r1.height/2 - cRect.top;

        const r2 = el2.getBoundingClientRect();
        const x2 = r2.left + r2.width/2 - cRect.left;
        const y2 = r2.top + r2.height/2 - cRect.top;

        svgLine.setAttribute("x1", x1);
        svgLine.setAttribute("y1", y1);
        svgLine.setAttribute("x2", x2);
        svgLine.setAttribute("y2", y2);
        svgLine.classList.add('wire-line');
        
        els.wiringLayer.appendChild(svgLine);
      }
    });
  }

  function getPinElement(id) {
    // Helper to find DOM element from our string ID logic
    if (id.startsWith('board-')) {
       return document.getElementById(id.replace('board-', ''));
    } else {
        // Component pin: 'comp-{timestamp}-{pinName}'
        const parts = id.split('-');
        const compId = `comp-${parts[1]}`; // Reconstruct component ID roughly or search
        // Simpler approach for this draft: Iterate all components to find the specific one based on string match logic if needed.
        // Let's assume we can just query by a data attribute if we set it better, but here is a quick fix:
        const comp = document.querySelector(`.component[id="${compId}"]`);
        if(comp) {
            return comp.querySelector('.pin'); // Returns first pin? No.
            // Better: The ID passed in `handlePinClick` was constructed. 
            // Let's refine the ID storage.
            // Actually, let's just use a global map of IDs to Elements for robustness if this gets complex.
            // For now, searching by text content or structure is brittle.
        }
    }
    return null;
  }

  // ───────── PROPERTIES PANEL ─────────
  
  function setupEventListeners() {
    els.boardSelect.addEventListener('change', (e) => renderBoard(e.target.value));
    
    els.btnReset.addEventListener('click', () => {
        if(confirm('Clear all components and connections?')) {
            state.components = [];
            state.connections = [];
            updateWiringLines();
            // Remove all component divs
            document.querySelectorAll('.component').forEach(el => el.remove());
        }
    });

    els.btnExport.addEventListener('click', exportConfig);
  }

  function exportConfig() {
      const config = {
          board: state.boardType,
          components: [],
          wiring: []
      };

      // Map components to simplified config
      state.components.forEach(c => {
          config.components.push({
              type: c.type,
              position: { x: Math.round(c.x), y: Math.round(c.y) }
          });
      });

      // Map wiring (simplified for Arduino usage later)
      state.connections.forEach(conn => {
          config.wiring.push([conn.from.id, conn.to.id]);
      });

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "esp32_config.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  }

  // Start App
  init();
})();
