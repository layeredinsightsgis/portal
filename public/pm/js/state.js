// Shared mutable app state. Every other module imports { state } from here
// and reads/writes its properties directly -- since ES module imports of an
// object give every importer the SAME reference, this is the equivalent of
// the closure-scoped `var`s the original single-file version used, just
// visible across files instead of trapped in one function's scope.
export var state = {
  // Lookups built from the initial data load (see main.js)
  floorsByStructure: {},  // StructureID -> sorted [{FloorID, FloorNumber}, ...]
  floorsById: {},         // FloorID -> {StructureID, FloorNumber}
  structuresById: {},     // StructureID -> {StructureName, Address, ...}
  roomsById: {},          // RoomID -> {FloorID, UnitID, RoomNumber}
  unitIdsByClient: {},    // ClientID -> [UnitID, ...]
  unitsById: {},          // UnitID -> {ClientID, FloorID, StructureID, UnitNumber, UnitName}

  // Raw rows, filtered/rendered client-side
  maintenanceLogs: [],
  mepContacts: [],
  clients: [],            // [{ClientID, ClientName}, ...]

  // Active filter/UI state
  activeStructureId: null,
  activeFloorId: null,    // null = "All floors"
  activeClientId: null,   // null = "All clients"
  activeWoTab: "open",    // "open" or "closed"
  editingWorkOrderId: null, // OBJECTID of the work order showing its edit form, or null

  // Unit attribute editing (click a unit on the map)
  editingObjectId: null,
  editingUnitId: null,

  // Set once during initMap()
  structuresLayer: null,
  unitsLayer: null,
  floorsLayer: null,
  roomsLayer: null,
  evacLayer: null,
  view: null,
  token: null,
  baseUrl: null
};
