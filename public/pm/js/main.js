import { state } from './state.js';
import { dom } from './dom.js';
import { queryTable } from './utils.js';
import { createLayers } from './mapLayers.js';
import { initMeasurement } from './measurement.js';
import { initFilters, showFloorPicker, refreshBookmarkRelevance } from './filters.js';
import { initClients, renderClientOptions } from './clients.js';
import { initMepContacts, renderMepContacts } from './mepContacts.js';
import { initWorkOrders, populateWoUnitSelect, renderWorkOrders } from './workOrders.js';
import { initUnitEditing, openEditPanel, closeEditPanel } from './unitEditing.js';
import { initReports } from './reports.js';

dom.layoutGuideBtn.addEventListener('click', function(e){
  e.stopPropagation();
  var isOpen = !dom.layoutGuidePanel.hidden;
  dom.layoutGuidePanel.hidden = isOpen;
  dom.layoutGuideBtn.classList.toggle('open', !isOpen);
});
document.addEventListener('click', function(e){
  if (dom.layoutGuidePanel.hidden) return;
  if (dom.layoutGuidePanel.contains(e.target) || dom.layoutGuideBtn.contains(e.target)) return;
  dom.layoutGuidePanel.hidden = true;
  dom.layoutGuideBtn.classList.remove('open');
});

function showLoggedOut(){
  dom.sessionBar.hidden = true;
  dom.mapView.hidden = true;
  dom.loginView.hidden = false;
}

export function showMapStatus(msg){
  dom.mapStatus.hidden = false;
  dom.mapStatus.textContent = msg;
}
function hideMapStatus(){
  dom.mapStatus.hidden = true;
}

function initMap(token, layerUrl, displayName){
  dom.sessionBar.hidden = false;
  dom.loginView.hidden = true;
  dom.mapView.hidden = false;
  // The PM login has full visibility -- the account itself is always
  // "Administrator", regardless of the display_name on the pm_users row.
  dom.pmName.textContent = "Logged in as: Administrator (" + displayName + ")";
  dom.viewingLine.textContent = "Viewing: all clients";

  require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Measurement"
  ], function(esriConfig, Map, MapView, FeatureLayer, Measurement){

    // A single app token, good for both the basemap styles service and the
    // private Units/Structures/Floors feature layers -- this OAuth app
    // (client_credentials) was granted access to exactly that one item, so
    // the token is scoped the same way here.
    esriConfig.apiKey = token;
    state.token = token;

    // layerUrl points at the Units sub-layer (".../FeatureServer/1");
    // Structures and Floors are sibling sub-layers of the same service.
    var baseUrl = layerUrl.replace(/\/\d+\/?$/, "");
    state.baseUrl = baseUrl;

    var layers = createLayers(FeatureLayer, baseUrl);
    var structuresLayer = layers.structuresLayer;
    var unitsLayer = layers.unitsLayer;
    var floorsLayer = layers.floorsLayer;
    var roomsLayer = layers.roomsLayer;
    var evacLayer = layers.evacLayer;
    state.structuresLayer = structuresLayer;
    state.unitsLayer = unitsLayer;
    state.floorsLayer = floorsLayer;
    state.roomsLayer = roomsLayer;
    state.evacLayer = evacLayer;

    var map = new Map({
      basemap: "arcgis/topographic",
      // Draw order back-to-front: Structures on the bottom, Evacuation
      // Routes on top, so the more detailed layers are visible above the
      // coarser ones once toggled on.
      layers: [structuresLayer, floorsLayer, unitsLayer, roomsLayer, evacLayer]
    });

    var view = new MapView({
      container: "mapContainer",
      map: map,
      zoom: 4,
      center: [-83.98, 34.53] // Dahlonega, GA area -- reasonable default
    });
    state.view = view;

    var measurement = initMeasurement(Measurement, view);

    // Clicking a Unit opens the edit panel (in addition to its normal
    // popup) -- hitTest is scoped to unitsLayer only so clicking a
    // Structure/Room/etc. doesn't trigger it. Suppressed while the
    // measurement tool is active so a click meant to place a measurement
    // point doesn't also pop open the Edit Unit panel underneath it.
    view.on("click", function(event){
      if (measurement.visible) return;
      view.hitTest(event, { include: unitsLayer }).then(function(response){
        var result = response.results && response.results[0];
        if (result && result.graphic) openEditPanel(result.graphic.attributes);
      });
    });

    // Sidebar checkboxes -- one per layer, user-controlled rather than
    // toggled automatically by zoom scale.
    var toggleableLayers = [
      { layer: structuresLayer, label: "Structures" },
      { layer: unitsLayer, label: "Units" },
      { layer: floorsLayer, label: "Floors" },
      { layer: roomsLayer, label: "Rooms" },
      { layer: evacLayer, label: "Evacuation Routes" }
    ];

    toggleableLayers.forEach(function(entry){
      var id = "layer-toggle-" + entry.label.toLowerCase().replace(/\s+/g, "-");

      var wrapper = document.createElement("label");
      wrapper.className = "layer-toggle";
      wrapper.setAttribute("for", id);

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = entry.layer.visible;

      checkbox.addEventListener("change", function(){
        entry.layer.visible = checkbox.checked;
      });

      var text = document.createElement("span");
      text.textContent = entry.label;

      wrapper.appendChild(checkbox);
      wrapper.appendChild(text);
      dom.layerToggles.appendChild(wrapper);
    });

    initFilters();
    initClients();
    initMepContacts();
    initWorkOrders();
    initUnitEditing();
    initReports();

    showMapStatus("Loading properties…");

    view.when(function(){
      return Promise.all([
        structuresLayer.queryFeatures({
          where: "1=1",
          outFields: ["*"],
          returnGeometry: true
        }),
        floorsLayer.queryFeatures({
          where: "1=1",
          outFields: ["FloorID", "StructureID", "FloorNumber"],
          returnGeometry: false
        }),
        queryTable(7, { where: "1=1", outFields: "ClientID,ClientName" }),
        unitsLayer.queryFeatures({
          where: "1=1",
          outFields: ["UnitID", "ClientID", "FloorID", "StructureID", "UnitNumber", "UnitName"],
          returnGeometry: false
        }),
        queryTable(9, {
          where: "1=1",
          outFields: "OBJECTID,UnitID,StructureID,FloorID,RoomID,DateReported,DateModified,IssueType,Description,ReportedBy,Status,DateResolved,Severity"
        }),
        queryTable(8, {
          where: "1=1",
          outFields: "OBJECTID,StructureID,UnitID,Trade,VendorName,ContactName,Phone,Email,Notes"
        }),
        roomsLayer.queryFeatures({
          where: "1=1",
          outFields: ["RoomID", "FloorID", "UnitID", "RoomNumber"],
          returnGeometry: false
        })
      ]);
    }).then(function(results){
      var structuresResult = results[0];
      var floorsResult = results[1];
      var clientsResult = results[2];
      var allUnitsResult = results[3];
      var maintenanceLogResult = results[4];
      var mepContactsResult = results[5];
      var roomsResult = results[6];

      // Group floors by structure, sorted low-to-high, for the floor
      // picker shown once a building is selected. floorsById is the
      // companion lookup for going the other way -- resolving a single
      // FloorID (e.g. a Floor-level work order) back to its Structure.
      floorsResult.features.forEach(function(f){
        var attrs = f.attributes;
        var list = state.floorsByStructure[attrs.StructureID] || (state.floorsByStructure[attrs.StructureID] = []);
        list.push(attrs);
        state.floorsById[attrs.FloorID] = attrs;
      });
      Object.keys(state.floorsByStructure).forEach(function(sid){
        state.floorsByStructure[sid].sort(function(a, b){ return a.FloorNumber - b.FloorNumber; });
      });

      // Build the UnitID -> {ClientID, FloorID, UnitNumber, UnitName}
      // lookup used for the client filter (Rooms/Evacuation Routes only
      // carry UnitID, not ClientID) and for scoping work orders by
      // floor/client (MaintenanceLog only carries UnitID).
      allUnitsResult.features.forEach(function(f){
        var attrs = f.attributes;
        state.unitsById[attrs.UnitID] = attrs;
        if (attrs.ClientID){
          var list = state.unitIdsByClient[attrs.ClientID] || (state.unitIdsByClient[attrs.ClientID] = []);
          list.push(attrs.UnitID);
        }
      });

      // RoomID -> {FloorID, UnitID, RoomNumber} -- backs the Room-level Add
      // Work Order picker and resolveWorkOrderContext() for Room-attached
      // MaintenanceLog rows.
      roomsResult.features.forEach(function(f){
        state.roomsById[f.attributes.RoomID] = f.attributes;
      });

      state.maintenanceLogs = (maintenanceLogResult.features || []).map(function(f){ return f.attributes; });
      state.mepContacts = (mepContactsResult.features || []).map(function(f){ return f.attributes; });

      // Populate the "Unit" dropdown on the add-work-order form. No
      // building is selected yet at initial load, so this shows the full
      // portfolio list -- populateWoUnitSelect() re-scopes it to just the
      // active building every time the Add Work Order form is opened.
      populateWoUnitSelect();

      // Populate the client dropdowns (the sidebar filter and the Edit
      // Unit panel's assignment field) from the Clients table.
      state.clients = (clientsResult.features || []).map(function(f){ return f.attributes; });
      renderClientOptions();

      hideMapStatus();
      dom.bookmarkList.innerHTML = "";

      if (!structuresResult.features.length){
        dom.bookmarkList.textContent = "No structures found.";
        return;
      }

      structuresResult.features.forEach(function(feature){
        var attrs = feature.attributes;
        state.structuresById[attrs.StructureID] = attrs;
        var name = attrs.StructureName || ("Structure " + attrs.StructureID);
        var addr = attrs.Address || "";

        var btn = document.createElement("button");
        btn.className = "bookmark-btn";
        btn.dataset.structureId = attrs.StructureID;
        btn.innerHTML =
          '<span class="b-name"></span><span class="b-addr"></span>';
        btn.querySelector(".b-name").textContent = name;
        btn.querySelector(".b-addr").textContent = addr;

        btn.addEventListener("click", function(){
          // Close any unit currently open in the Edit panel first --
          // otherwise Work Orders/Vendor Contacts would stay scoped to a
          // unit in the building you just navigated away from.
          closeEditPanel();

          // Zoom to the building...
          if (feature.geometry && feature.geometry.extent){
            view.goTo(feature.geometry.extent.expand(1.8));
          } else {
            view.goTo(feature.geometry);
          }

          // ...and scope Units/Rooms/Floors/Evacuation Routes to its floors.
          showFloorPicker(attrs.StructureID);

          var allBookmarkBtns = dom.bookmarkList.querySelectorAll(".bookmark-btn");
          allBookmarkBtns.forEach(function(b){ b.classList.remove("active"); });
          btn.classList.add("active");
        });

        dom.bookmarkList.appendChild(btn);
      });

      refreshBookmarkRelevance();

      // Show all open work orders by default, before any building/client is picked.
      renderWorkOrders();
      renderMepContacts();

      // Zoom to the full extent of all structures on first load.
      return structuresLayer.queryExtent();
    }).then(function(extentResult){
      if (extentResult && extentResult.extent){
        view.goTo(extentResult.extent.expand(1.3));
      }
    }).catch(function(err){
      showMapStatus("Could not load properties: " + (err && err.message ? err.message : err));
    });
  });
}

function loadPmSession(){
  fetch('/api/pm/token', { credentials: 'same-origin' })
    .then(function(res){
      if (res.status === 401) { showLoggedOut(); return null; }
      return res.json();
    })
    .then(function(data){
      if (!data) return;
      if (data.error) { showLoggedOut(); return; }
      initMap(data.token, data.layerUrl, data.displayName);
    })
    .catch(function(){ showLoggedOut(); });
}

dom.loginForm.addEventListener('submit', function(e){
  e.preventDefault();
  dom.loginError.textContent = '';
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;

  fetch('/api/pm/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(result){
      if (!result.ok){
        dom.loginError.textContent = result.data.error || 'Sign in failed.';
        return;
      }
      loadPmSession();
    })
    .catch(function(){ dom.loginError.textContent = 'Could not reach the server. Try again.'; });
});

document.getElementById('logoutBtn').addEventListener('click', function(){
  fetch('/api/pm/logout', { method: 'POST', credentials: 'same-origin' }).then(function(){
    location.reload();
  });
});

// On load, see if there's already a valid PM session.
loadPmSession();
