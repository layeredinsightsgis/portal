// Structure/Floor/Unit/Room polygons commonly stack exactly on top of each
// other (a single-story building's footprint, floor, and unit can all share
// one outline). With no explicit renderer each layer falls back to
// ArcGIS's default symbology, which looks similar enough across layers that
// a stacked view is unreadable. Giving each layer its own translucent fill
// color and a label makes it possible to tell, at a glance, which layer
// you're actually looking at -- Structures barely tinted with a bold
// outline (it's the "floor" of the stack), Floors blue, Units green, Rooms
// orange, each lighter than the one below so what's underneath still shows
// through.
//
// Takes the esri/layers/FeatureLayer class and the service's base URL
// (".../FeatureServer", with the trailing sub-layer index stripped) as
// parameters rather than importing them, since they come from the AMD
// require() callback in main.js -- this factory has no state/dom
// dependency of its own.
export function createLayers(FeatureLayer, baseUrl){
  var structuresLayer = new FeatureLayer({
    url: baseUrl + "/0",
    title: "Structures",
    outFields: ["*"],
    popupTemplate: {
      title: "{StructureName}",
      content: "Address: {Address}<br>Structure ID: {StructureID}"
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [28, 37, 48, 0.05],
        outline: { color: [28, 37, 48, 0.9], width: 2 }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: { expression: "$feature.StructureName" },
      labelPlacement: "always-horizontal",
      symbol: {
        type: "text",
        color: "#1c2530",
        haloColor: "#ffffff",
        haloSize: 1.2,
        font: { size: 11, weight: "bold" }
      }
    }]
  });

  var unitsLayer = new FeatureLayer({
    url: baseUrl + "/1",
    title: "Units",
    outFields: ["*"],
    popupTemplate: {
      title: "Unit {UnitNumber} — {UnitName}",
      content: "Status: {Status}<br>Sq Ft: {SqFt}<br>Client ID: {ClientID}"
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [47, 111, 94, 0.28],
        outline: { color: [47, 111, 94, 0.9], width: 1.5 }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: { expression: "'Unit ' + $feature.UnitNumber" },
      labelPlacement: "always-horizontal",
      symbol: {
        type: "text",
        color: "#1d4a3e",
        haloColor: "#ffffff",
        haloSize: 1.2,
        font: { size: 10, weight: "bold" }
      }
    }]
  });

  var floorsLayer = new FeatureLayer({
    url: baseUrl + "/2",
    title: "Floors",
    outFields: ["*"],
    visible: false, // detail layer -- off by default, toggle in sidebar
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [58, 90, 140, 0.18],
        outline: { color: [58, 90, 140, 0.9], width: 1.5 }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: { expression: "'Floor ' + $feature.FloorNumber" },
      labelPlacement: "always-horizontal",
      symbol: {
        type: "text",
        color: "#2c4570",
        haloColor: "#ffffff",
        haloSize: 1.2,
        font: { size: 10, weight: "bold" }
      }
    }]
  });

  var roomsLayer = new FeatureLayer({
    url: baseUrl + "/3",
    title: "Rooms",
    outFields: ["*"],
    visible: false, // detail layer -- off by default, toggle in sidebar
    popupTemplate: {
      title: "Room {RoomNumber}",
      content: "Type: {RoomType}<br>Sq Ft: {SqFt}<br>Unit ID: {UnitID}"
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: [167, 103, 30, 0.22],
        outline: { color: [167, 103, 30, 0.9], width: 1 }
      }
    },
    labelingInfo: [{
      labelExpressionInfo: { expression: "$feature.RoomNumber" },
      labelPlacement: "always-horizontal",
      symbol: {
        type: "text",
        color: "#7a4c17",
        haloColor: "#ffffff",
        haloSize: 1,
        font: { size: 9, weight: "bold" }
      }
    }]
  });

  var evacLayer = new FeatureLayer({
    url: baseUrl + "/4",
    title: "Evacuation Routes",
    outFields: ["*"],
    visible: false, // detail layer -- off by default, toggle in sidebar
    popupTemplate: {
      title: "Evacuation Route",
      content: "Floor ID: {FloorID}<br>Unit ID: {UnitID}"
    }
  });

  return { structuresLayer: structuresLayer, unitsLayer: unitsLayer, floorsLayer: floorsLayer, roomsLayer: roomsLayer, evacLayer: evacLayer };
}
