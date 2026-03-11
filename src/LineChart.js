import * as d3 from 'd3';

const TEAM_COLORS = {
    "Ferrari": "#e8002d",
    "McLaren": "#ff8000",
    "Mercedes": "#27f4d2",
    "Red Bull Racing": "#3671c6",
    "Aston Martin": "#229971",
    "Alpine": "#0093cc",
    "Williams": "#64c4ff",
    "RB": "#6692ff",
    "Kick Sauber": "#52e252",
    "Haas F1 Team": "#ffffff"
};

// 1. Palette Lampprecht (Coerente con RankingsChart)
const lampprechtPalette = [
    "#006400", "#228b22", "#32cd32", "#7cfc00", "#adff2f", // Top 5 (Verdi)
    "#d4ff00", "#eeff00", "#ffff00", "#fff700", "#ffea00", // P6-P10 (Gialli)
    "#ffcc00", "#ffaa00", "#ff8800", "#ff6600", "#ff4400", // P11-P15 (Arancioni)
    "#ff0000", "#dd0000", "#bb0000", "#990000", "#7f0000"  // P16-P20 (Rossi)
];

const getRankColor = (position) => {
    const index = Math.max(0, Math.min(Math.floor(position) - 1, lampprechtPalette.length - 1));
    return lampprechtPalette[index];
};

export function drawLineChart(rawData, containerId, callbacks, selectedStints = []) {
    const data = rawData.map(d => ({
        ...d,
        LapNumber: +d.LapNumber,
        LapTime: +d.LapTimeSeconds,
        Position: +d.Position,
        TyreLife: +d.TyreLife,
        Driver: d.Driver,
        Team: d.Team,
        IsSafetyCar: d.IsSafetyCar === "True" || d.IsSafetyCar === "true"
    })).filter(d => d.LapNumber > 0 && d.LapTime > 0);

    if (!data || data.length === 0) return; 

    const hasSelection = selectedStints && selectedStints.length > 0;
    const isDriverSelected = (driver) => hasSelection && selectedStints.some(s => s.Driver === driver);
    const isLapInSelectedStints = (driver, lap) => hasSelection && selectedStints.some(s => s.Driver === driver && lap >= s.LapStart && lap <= s.LapEnd);

    // --- LOGICA COLORI PER PILOTA ---
    const driverColors = new Map();
    const lapsByDriver = d3.group(data, d => d.Driver);
    
    // Calcoliamo i colori basati sulla posizione finale
    lapsByDriver.forEach((laps, driver) => {
        const sorted = laps.sort((a, b) => a.LapNumber - b.LapNumber);
        const finalPos = sorted[sorted.length - 1].Position;
        driverColors.set(driver, getRankColor(finalPos));
    });

    // --- SETUP SCALARE ---
    const sortedLapTimes = data.map(d => d.LapTime).sort(d3.ascending);
    const minLapTime = sortedLapTimes[0];
    const p90LapTime = d3.quantile(sortedLapTimes, 0.90); 

    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const containerNode = container.node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight;
    const margin = { top: 15, right: 0, bottom: 17, left: 33 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .on("dblclick", function(event) {
            event.preventDefault();
            if (callbacks && callbacks.onReset) callbacks.onReset();
        });

    svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.LapNumber)).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([p90LapTime, minLapTime - 0.5]).range([innerHeight, 0]).clamp(true);
    const rScale = d3.scaleLinear().domain([0, d3.max(data, d => d.TyreLife) || 30]).range([2, 6]);

    // --- ASSI E GRIGLIA ---
   // --- ASSI E GRIGLIA ---
g.append("g")
    .attr("class", "grid")
    .attr("stroke-opacity", 0.1)
    .attr("color", "#888") // Aggiunto per uniformità
    .call(d3.axisLeft(yScale).ticks(8).tickSize(-innerWidth).tickFormat(""));

g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickFormat(d => `L${d}`))
    .attr("color", "#888") // Cambiato da default a #888
    .selectAll("text")
    .style("fill", "#888"); // Forza il colore del testo

g.append("g")
    .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => d.toFixed(1) + "s"))
    .attr("color", "#888") // Cambiato da default a #888
    .selectAll("text")
    .style("fill", "#888");

    const plotArea = g.append("g").attr("clip-path", "url(#clip)");

    // Bande Safety Car
    const scLaps = Array.from(new Set(data.filter(d => d.IsSafetyCar).map(d => d.LapNumber)));
    plotArea.selectAll(".sc-band").data(scLaps).enter().append("rect")
        .attr("x", d => xScale(d - 0.5)).attr("y", 0)
        .attr("width", d => xScale(d + 0.5) - xScale(d - 0.5))
        .attr("height", innerHeight).attr("fill", "#ffffff").attr("opacity", 0.05);

    const lineGenerator = d3.line()
        .x(d => xScale(d.LapNumber))
        .y(d => yScale(d.LapTime))
        .defined(d => !isNaN(d.LapTime) && d.LapTime > 0)
        .curve(d3.curveMonotoneX);

    const linesGroup = plotArea.append("g");
    const circlesGroup = plotArea.append("g");
    const tooltip = d3.select("#tooltip");

    // --- DISEGNO LINEE E PUNTI ---
    lapsByDriver.forEach((laps, driver) => {
        const color = driverColors.get(driver);
        const isThisDriverSelected = isDriverSelected(driver);

        linesGroup.append("path")
            .datum(laps)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", hasSelection ? (isThisDriverSelected ? 3 : 1) : 1.2)
            .attr("opacity", hasSelection ? (isThisDriverSelected ? 1 : 0.1) : 0.6)
            .attr("d", lineGenerator);

        circlesGroup.selectAll(`.circle-${driver}`)
            .data(laps).enter().append("circle")
            .attr("cx", d => xScale(d.LapNumber))
            .attr("cy", d => yScale(d.LapTime))
            .attr("r", d => rScale(d.TyreLife))
            .attr("fill", color)
            .attr("opacity", d => isLapInSelectedStints(d.Driver, d.LapNumber) ? 1 : 0)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 0.5)
           .on("mouseover", function(event, d) {
    d3.select(this)
        .attr("opacity", 1)
        .attr("stroke-width", 2)
        .attr("r", d => rScale(d.TyreLife) + 2); // Dynamic visual feedback

    const compColor = d.Compound === 'SOFT' ? '#e10600' : d.Compound === 'MEDIUM' ? '#ffeb3b' : '#ffffff';
    
    tooltip.classed("hidden", false)
        .html(`
            <div style="border-left: 4px solid ${driverColors.get(d.Driver)}; padding-left: 8px;">
                <div style="font-weight: bold; font-size: 1rem;">${d.Driver}</div>
                <div style="font-size: 0.85rem; color: #aaa; margin-bottom: 5px;">${d.Team}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px;">
                    <div>Lap: <strong>L${d.LapNumber}</strong></div>
                    <div>Time: <strong>${d.LapTime.toFixed(3)}s</strong></div>
                </div>

                <div style="margin-top: 8px; font-size: 0.85rem;">
                    <div>Compound: <strong style="color:${compColor}">${d.Compound}</strong></div>
                    <div>Tyre Age: <strong>${d.TyreLife} laps</strong></div>
                </div>

                <hr style="border: 0; border-top: 1px solid #444; margin: 6px 0;">
                
                <div style="font-size: 0.75rem; color: #00ffcc;">
                    Speed ST: <strong>${d.SpeedST || 'N/A'} km/h</strong>
                </div>
                ${d.IsSafetyCar ? '<div style="color: #ffd400; font-weight: bold; font-size: 0.7rem;">⚠️ SAFETY CAR PERIOD</div>' : ''}
            </div>
        `)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
})
           .on("mouseout", function(event, d) {
    const selected = isLapInSelectedStints(d.Driver, d.LapNumber);
    d3.select(this)
        .attr("opacity", selected ? 1 : 0)
        .attr("r", rScale(d.TyreLife)) // Ripristina raggio originale
        .attr("stroke-width", 0.5);
    tooltip.classed("hidden", true);
});
    });

    // --- ANALISI STINT SELEZIONATI (Regressione e Crossover) ---
    if (hasSelection) {
        selectedStints.forEach(stint => {
            if (!stint.LapStart || stint.DegradationSlope === undefined) return;

            const startX = xScale(stint.LapStart);
            const endX = xScale(stint.LapEnd);
            const midLap = (stint.LapStart + stint.LapEnd) / 2;
            const startY = yScale(stint.AvgLapTime - (midLap - stint.LapStart) * stint.DegradationSlope);
            const endY = yScale(stint.AvgLapTime + (stint.LapEnd - midLap) * stint.DegradationSlope);

            // Retta di regressione (Degrado)
            plotArea.append("line")
                .attr("x1", startX).attr("y1", startY).attr("x2", endX).attr("y2", endY)
                .attr("stroke", "#ffffff").attr("stroke-width", 2).attr("stroke-dasharray", "4,4");

            // Banda colore del Team
            plotArea.append("polygon")
                .attr("points", `${startX},${startY-10} ${endX},${endY-10} ${endX},${endY+10} ${startX},${startY+10}`)
                .attr("fill", TEAM_COLORS[stint.Team] || "#ffffff").attr("opacity", 0.15).lower();
        });

        // Calcolo Crossover Point (solo se 2 stint selezionati)
        if (selectedStints.length === 2) {
            const s1 = selectedStints[0], s2 = selectedStints[1];
            const m1 = s1.DegradationSlope, m2 = s2.DegradationSlope;
            if (m1 !== m2) {
                const q1 = s1.AvgLapTime - (m1 * ((s1.LapStart + s1.LapEnd) / 2));
                const q2 = s2.AvgLapTime - (m2 * ((s2.LapStart + s2.LapEnd) / 2));
                const crossoverLap = (q2 - q1) / (m1 - m2);

                if (crossoverLap > 0 && crossoverLap < 100) {
                    const cx = xScale(crossoverLap);
                    plotArea.append("line").attr("x1", cx).attr("y1", 0).attr("x2", cx).attr("y2", innerHeight)
                        .attr("stroke", "#ff00ff").attr("stroke-width", 2).attr("stroke-dasharray", "5,5");
                    plotArea.append("text").attr("x", cx + 8).attr("y", 20).attr("fill", "#ff00ff")
                        .style("font-weight", "bold").text(`Crossover L${Math.round(crossoverLap)}`);
                }
            }
        }
    }
}