import * as d3 from 'd3';

let lapPoints;
let lapLines;
let colorScale;
let x, y;
let allData;

// Variabili di stato
let currentSelectedDrivers = [];
let currentlyViewedDriver = null;
let containerDiv;
let onBrushSelectionCallback;

// Stato del grafico ('LAP_TIME' o 'POSITION')
let currentMode = 'LAP_TIME'; 

export function drawLapTimeDelta(data, containerSelector, onBrushSelection) {
    allData = data;
    containerDiv = d3.select(containerSelector);
    onBrushSelectionCallback = onBrushSelection;

    renderChart(); 
}

function renderChart() {
    containerDiv.selectAll("*").remove();

    // 1. HEADER CON FRECCE DI NAVIGAZIONE E TITOLO
    const header = containerDiv.append("div")
        .style("display", "flex")
        .style("justify-content", "space-between")
        .style("align-items", "center")
        .style("margin-bottom", "5px")
        .style("padding", "0 10px");

    header.append("button")
        .html("&#9664;") 
        .style("background", "none").style("border", "none").style("cursor", "pointer")
        .style("font-size", "18px").style("color", "#e94560")
        .on("click", toggleMode);

    header.append("h3")
        .style("margin", "0").style("font-size", "13px").style("color", "#2c3e50")
        .text(currentMode === 'LAP_TIME' ? "Andamento (Lap Time)" : "Classifica (Track Position)");

    header.append("button")
        .html("&#9654;") 
        .style("background", "none").style("border", "none").style("cursor", "pointer")
        .style("font-size", "18px").style("color", "#e94560")
        .on("click", toggleMode);

    // 2. CONTENITORE PER IL MENU A TENDINA
    containerDiv.append("div")
        .attr("class", "dropdown-container")
        .style("text-align", "center")
        .style("margin-bottom", "5px")
        .style("min-height", "28px"); 

    // 3. CALCOLO SPAZIO SVG RESPONSIVE (Margine destro a 50 per far leggere "Media")
    const width = containerDiv.node().clientWidth || 400;
    const height = (containerDiv.node().clientHeight || 200) - 65; 
    const margin = { top: 10, right: 50, bottom: 30, left: 40 }; 
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = containerDiv.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // ASSE X
    x = d3.scaleLinear().domain(d3.extent(allData, d => +d.LapNumber)).range([0, innerWidth]);

    // ASSE Y
    if (currentMode === 'LAP_TIME') {
        y = d3.scaleLinear().domain(d3.extent(allData, d => +d.LapTime_Sec)).range([innerHeight, 0]);
        svg.append("g").call(d3.axisLeft(y).ticks(5));
    } else {
        const maxPos = d3.max(allData, d => +d.Position) || 20;
        y = d3.scaleLinear().domain([maxPos, 1]).range([innerHeight, 0]);
        svg.append("g").call(d3.axisLeft(y).ticks(maxPos).tickFormat(d3.format("d")));
    }

    colorScale = d3.scaleOrdinal()
        .domain(["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"])
        .range(["#d7191c", "#fdae61", "#878787", "#1a9641", "#2b83ba"]);

    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));

    const dataByDriver = d3.group(allData, d => d.Driver);
    const getYValue = d => currentMode === 'LAP_TIME' ? +d.LapTime_Sec : +d.Position;

    const lineGenerator = d3.line()
        .x(d => x(+d.LapNumber))
        .y(d => y(getYValue(d)));

    // --- CALCOLO E DISEGNO DELLA MEDIA DEL GRUPPO (BASELINE) ---
    if (currentMode === 'LAP_TIME') {
        const meanData = Array.from(d3.group(allData, d => +d.LapNumber), ([lap, entries]) => {
            return {
                LapNumber: lap,
                LapTime_Sec: d3.mean(entries, d => +d.LapTime_Sec) 
            };
        }).sort((a, b) => a.LapNumber - b.LapNumber);

        const meanLineGenerator = d3.line()
            .x(d => x(d.LapNumber))
            .y(d => y(d.LapTime_Sec));

        svg.append("path")
            .datum(meanData)
            .attr("class", "mean-line")
            .attr("d", meanLineGenerator)
            .style("fill", "none")
            .style("stroke", "#7f8c8d") 
            .style("stroke-width", 2)
            .style("stroke-dasharray", "5,5") 
            .style("opacity", 0.6);

        const lastPoint = meanData[meanData.length - 1];
        if(lastPoint) {
            svg.append("text")
               .attr("class", "mean-label")
               .attr("x", x(lastPoint.LapNumber) + 5)
               .attr("y", y(lastPoint.LapTime_Sec))
               .text("Media")
               .style("font-size", "11px")
               .style("fill", "#7f8c8d")
               .style("font-weight", "bold")
               .style("alignment-baseline", "middle");
        }
    }
    // --------------------------------------------------------

    // DISEGNO LINEE PILOTI
    lapLines = svg.selectAll(".driver-line")
        .data(dataByDriver).enter().append("path")
        .attr("class", "driver-line")
        .attr("d", d => lineGenerator(d[1]))
        .style("fill", "none")
        .style("stroke", "#bdc3c7")
        .style("stroke-width", 1.5)
        .style("opacity", 0.2);

    // DISEGNO PUNTI PILOTI
    lapPoints = svg.selectAll(".lap-point")
        .data(allData).enter().append("circle")
        .attr("class", "lap-point")
        .attr("cx", d => x(+d.LapNumber))
        .attr("cy", d => y(getYValue(d)))
        .attr("r", 3)
        .style("fill", d => colorScale(d.Compound ? d.Compound.toUpperCase() : "MEDIUM"))
        .style("opacity", 0.4)
        .style("stroke", "#fff")
        .style("stroke-width", 0.5);

    lapPoints.append("title").text(d => `${d.Driver} - Lap ${d.LapNumber} - ${currentMode === 'LAP_TIME' ? d.LapTime_Sec + 's' : 'Pos: ' + d.Position}`);

    // BRUSH ADATTIVO
    const brush = d3.brush().extent([[0, 0], [innerWidth, innerHeight]])
        .on("brush end", (event) => {
            if (!event.selection) { 
                if(onBrushSelectionCallback && event.type === 'end') onBrushSelectionCallback([]); 
                return; 
            }
            const [[x0, y0], [x1, y1]] = event.selection;
            
            let dataToFilter = currentlyViewedDriver ? allData.filter(d => d.Driver === currentlyViewedDriver) : allData;
            
            const selected = dataToFilter.filter(d => {
                const cx = x(d.LapNumber), cy = y(getYValue(d));
                return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
            });
            if (onBrushSelectionCallback && event.type === 'end') onBrushSelectionCallback(selected);
        });

    svg.append("g").attr("class", "brush").call(brush);

    renderDropdown();
    updateVisuals();
}

function toggleMode() {
    currentMode = currentMode === 'LAP_TIME' ? 'POSITION' : 'LAP_TIME';
    renderChart();
}

function updateVisuals() {
    if (!lapLines || !lapPoints) return;
    const isFullSet = currentSelectedDrivers.length === 0;

    lapLines.transition().duration(400)
        .style("opacity", d => {
            if (isFullSet) return 0.2; 
            return d[0] === currentlyViewedDriver ? 0.9 : 0.02; 
        })
        .style("stroke", d => (!isFullSet && d[0] === currentlyViewedDriver) ? "#e94560" : "#bdc3c7")
        .style("stroke-width", d => (!isFullSet && d[0] === currentlyViewedDriver) ? 2.5 : 1.5);

    lapPoints.transition().duration(400)
        .style("opacity", d => {
            if (isFullSet) return 0.4; 
            return d.Driver === currentlyViewedDriver ? 1 : 0.02; 
        })
        .attr("r", d => (!isFullSet && d.Driver === currentlyViewedDriver) ? 5 : 2)
        .style("stroke", d => (!isFullSet && d.Driver === currentlyViewedDriver) ? "#000" : "none");
}

function renderDropdown() {
    const container = containerDiv.select(".dropdown-container");
    
    if (currentSelectedDrivers.length === 0) {
        container.selectAll("select").remove();
        return;
    }

    let select = container.select("select");
    if (select.empty()) {
        select = container.append("select")
            .attr("class", "driver-dropdown")
            .style("padding", "4px 12px")
            .style("border-radius", "6px")
            .style("border", "1px solid #e94560") 
            .style("background-color", "#1a1a2e") 
            .style("color", "white")
            .style("font-weight", "bold")
            .style("cursor", "pointer")
            .style("outline", "none")
            .on("change", function() {
                currentlyViewedDriver = d3.select(this).property("value");
                updateVisuals();
            });
    }

    const options = select.selectAll("option")
        .data(currentSelectedDrivers, d => d);

    options.exit().remove();

    options.enter()
        .append("option")
        .merge(options)
        .attr("value", d => d)
        .text(d => `Analisi Pilota: ${d}`);

    select.property("value", currentlyViewedDriver);
}

export function highlightLapTime(selectedData) {
    if (!lapPoints) return;
    
    // Controlla se abbiamo selezionato tutto o niente
    const isFullSet = selectedData.length === 0 || selectedData.length === allData.length;
    
    if (isFullSet) {
        currentSelectedDrivers = [];
        currentlyViewedDriver = null;
        renderDropdown(); 
    } else {
        const newSelectedDrivers = Array.from(new Set(selectedData.map(d => d.Driver))).sort();
        currentSelectedDrivers = newSelectedDrivers;
        
        if (!currentSelectedDrivers.includes(currentlyViewedDriver)) {
            currentlyViewedDriver = currentSelectedDrivers[0];
        }
        renderDropdown(); 
    }
    updateVisuals(); 
}

export function calculateRegression(selectedData) {
    if (selectedData.length < 2) return null;
    const n = selectedData.length;
    const sumX = d3.sum(selectedData, d => +d.TyreLife);
    const sumY = d3.sum(selectedData, d => +d.LapTime_Sec);
    const sumXY = d3.sum(selectedData, d => (+d.TyreLife) * (+d.LapTime_Sec));
    const sumX2 = d3.sum(selectedData, d => (+d.TyreLife) * (+d.TyreLife));
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

export function drawDegradationLine(containerSelector, selectedData, data) {
    const container = d3.select(containerSelector);
    const svg = container.select("g");
    
    // Puliamo sempre eventuali linee di regressione vecchie
    svg.selectAll(".regression-line").remove();

    // Se non c'è una selezione specifica, non calcoliamo nulla
    if (!selectedData || selectedData.length < 2 || selectedData.length === data.length) {
        return null;
    }

    const regression = calculateRegression(selectedData);
    if (!regression) return null;

    // RITORNIAMO IL VALORE PER LA SIDEBAR (ms/giro), MA NON DISEGNIAMO PIÙ LA LINEA SUL GRAFICO!
    return regression.slope * 1000; 
}