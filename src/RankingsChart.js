import * as d3 from 'd3';

const lampprechtPalette = [
    "#006400", "#228b22", "#32cd32", "#7cfc00", "#adff2f", 
    "#d4ff00", "#eeff00", "#ffff00", "#fff700", "#ffea00", 
    "#ffcc00", "#ffaa00", "#ff8800", "#ff6600", "#ff4400", 
    "#ff0000", "#dd0000", "#bb0000", "#990000", "#7f0000"
];

const getRankColor = (position) => {
    const index = Math.max(0, Math.min(position - 1, lampprechtPalette.length - 1));
    return lampprechtPalette[index];
};

export function drawRankingsChart(data, containerId, callbacks, selectedStints = []) {
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const node = container.node();
    const margin = { top: 15, right: 29, bottom: 17, left: 15 };
    const width = node.clientWidth - margin.left - margin.right;
    const height = node.clientHeight - margin.top - margin.bottom;

    const svgBase = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block")
        .on("dblclick", function(event) {
            event.preventDefault(); 
            if (callbacks && callbacks.onReset) callbacks.onReset();
        });

    const svg = svgBase.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain(d3.extent(data, d => +d.LapNumber)).range([0, width]);
    const yScale = d3.scaleLinear().domain([1, d3.max(data, d => +d.Position)]).range([0, height]);

    // Assi
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(10).tickFormat(d => `L${d}`))
        .attr("color", "#888");

    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(10))
        .attr("color", "#888");

    const lineGenerator = d3.line()
        .x(d => xScale(+d.LapNumber))
        .y(d => yScale(+d.Position))
        .curve(d3.curveMonotoneX);

    const dataByDriver = d3.group(data, d => d.Driver);
    const hasSelection = selectedStints.length > 0;
    
    // Set per identificare velocemente i piloti selezionati
    const selectedDriversNames = new Set(selectedStints.map(s => s.Driver));

    const linesGroup = svg.append("g").attr("class", "lines-group");

    dataByDriver.forEach((laps, driver) => {
        const isSelected = selectedDriversNames.has(driver);
        const lastLap = laps[laps.length - 1];
        const finalPos = +lastLap.Position;
        const driverColor = getRankColor(finalPos);

        // Disegno della linea
        const path = linesGroup.append("path")
            .datum(laps)
            .attr("fill", "none")
            .attr("stroke", driverColor)
            .attr("stroke-width", isSelected ? 4 : 1.5)
            .attr("opacity", hasSelection ? (isSelected ? 1 : 0.15) : 0.8)
            .attr("d", lineGenerator)
            .style("cursor", "pointer")
            .style("transition", "opacity 0.2s, stroke-width 0.2s");

        // Se il pilota è selezionato, aggiungiamo il cartellino
        if (isSelected) {
            path.raise();

            svg.append("text")
                .attr("x", xScale(lastLap.LapNumber) + 8)
                .attr("y", yScale(lastLap.Position))
                .attr("dy", "0.35em")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("fill", driverColor)
                .text(driver);
        }

        // Interazioni
        path.on("mouseover", function(event) {
            if (!isSelected) d3.select(this).attr("stroke-width", 3).attr("opacity", 1);
            
            const lastLapNumber = d3.max(data, d => +d.LapNumber);
            const lastLapData = data.filter(d => +d.LapNumber === lastLapNumber);
            const winner = lastLapData.find(d => +d.Position === 1);
            const currentDriverFinal = lastLapData.find(d => d.Driver === driver);
            const teamName = laps[0].Team || "N/A";
            
            let timeInfo = "";
            if (currentDriverFinal && winner) {
                if (driver === winner.Driver) {
                    timeInfo = `<div style="color: #ffd400; font-weight: bold; margin-top: 4px;">🏆 RACE WINNER</div>`;
                } else {
                    const gap = currentDriverFinal.LapStartSeconds - winner.LapStartSeconds;
                    timeInfo = `<div style="margin-top: 4px;">Final Gap: <strong>+${gap.toFixed(3)}s</strong></div>`;
                }
            }

            d3.select("#tooltip").classed("hidden", false)
                .html(`
                    <div style="border-left: 4px solid ${driverColor}; padding-left: 8px;">
                        <div style="font-weight: bold; font-size: 1rem;">${driver}</div>
                        <div style="font-size: 0.85rem; color: #aaa; margin-bottom: 5px;">${teamName}</div>
                        <div style="font-size: 0.85rem; color: #aaa;">
                            Final Position: <strong>P${finalPos}</strong>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #444; margin: 6px 0;">
                        <div style="font-size: 0.8rem;">
                            ${timeInfo}
                        </div>
                    </div>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            if (!isSelected) {
                d3.select(this)
                    .attr("stroke-width", 1.5)
                    .attr("opacity", hasSelection ? 0.15 : 0.8);
            }
            d3.select("#tooltip").classed("hidden", true);
        })
        // ===== ECCO LA MODIFICA INTEGRATA =====
        .on("click", function(event) {
            if (!callbacks.onRankingBrush) return;

            let newSelectedDrivers = new Set(selectedDriversNames);
            const isCtrlOrCmdPressed = event.ctrlKey || event.metaKey;

            if (isCtrlOrCmdPressed) {
                // Selezione Multipla
                if (isSelected) {
                    newSelectedDrivers.delete(driver);
                } else {
                    newSelectedDrivers.add(driver);
                }
            } else {
                // Selezione Singola
                if (isSelected && newSelectedDrivers.size === 1) {
                    newSelectedDrivers.clear();
                } else {
                    newSelectedDrivers.clear();
                    newSelectedDrivers.add(driver);
                }
            }

            const driversArray = Array.from(newSelectedDrivers);

            if (driversArray.length === 0) {
                callbacks.onRankingBrush([], null, null);
            } else {
                let minLap = Infinity;
                let maxLap = -Infinity;

                driversArray.forEach(dName => {
                    const dLaps = dataByDriver.get(dName);
                    if (dLaps) {
                        const start = d3.min(dLaps, l => +l.LapNumber);
                        const end = d3.max(dLaps, l => +l.LapNumber);
                        if (start < minLap) minLap = start;
                        if (end > maxLap) maxLap = end;
                    }
                });

                callbacks.onRankingBrush(driversArray, minLap, maxLap);
            }
        });
        // ======================================
    });
}