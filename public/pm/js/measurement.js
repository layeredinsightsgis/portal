// esri/widgets/Measurement has no built-in Distance/Area picker of its own
// -- it only renders once activeTool is explicitly set to "distance" or
// "area", and shows nothing while it's null. So the toggle buttons below
// are the actual picker; this matches Esri's own documented usage pattern
// for this widget, not a workaround.
//
// Takes the esri/widgets/Measurement class and the MapView as parameters
// (both come from main.js's AMD require()/MapView construction) -- this
// widget is fully self-contained otherwise, no shared state/dom needed.
export function initMeasurement(Measurement, view){
  var measurement = new Measurement({ view: view, activeTool: null, visible: false });
  view.ui.add(measurement, "top-right");

  var measureToolbar = document.createElement("div");
  measureToolbar.className = "measure-toolbar";
  measureToolbar.hidden = true;
  measureToolbar.innerHTML =
    '<button type="button" class="measure-tool-btn" data-tool="distance">Distance</button>' +
    '<button type="button" class="measure-tool-btn" data-tool="area">Area</button>';
  view.ui.add(measureToolbar, "top-right");

  var distanceToolBtn = measureToolbar.querySelector('[data-tool="distance"]');
  var areaToolBtn = measureToolbar.querySelector('[data-tool="area"]');

  function setActiveMeasureTool(tool){
    measurement.activeTool = tool;
    distanceToolBtn.classList.toggle("active-tool", tool === "distance");
    areaToolBtn.classList.toggle("active-tool", tool === "area");
  }
  distanceToolBtn.addEventListener("click", function(){ setActiveMeasureTool("distance"); });
  areaToolBtn.addEventListener("click", function(){ setActiveMeasureTool("area"); });

  var measureBtn = document.createElement("button");
  measureBtn.className = "esri-widget esri-widget--button esri-interactive";
  measureBtn.type = "button";
  measureBtn.title = "Measure distance or area";
  measureBtn.style.fontSize = "16px";
  measureBtn.textContent = "\u{1F4CF}"; // 📏
  measureBtn.addEventListener("click", function(){
    if (measurement.visible){
      measurement.clear();
      measurement.activeTool = null;
      measurement.visible = false;
      measureToolbar.hidden = true;
      distanceToolBtn.classList.remove("active-tool");
      areaToolBtn.classList.remove("active-tool");
      measureBtn.classList.remove("active-tool");
    } else {
      measurement.visible = true;
      measureToolbar.hidden = false;
      setActiveMeasureTool("distance"); // sensible default when first opened
      measureBtn.classList.add("active-tool");
    }
  });
  view.ui.add(measureBtn, "top-right");

  return measurement;
}
