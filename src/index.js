// Importa lo stile (se hai creato la cartella styles come detto prima, altrimenti lascia './index.scss')
import 'index.scss'; 

// Importa i dati processati col tuo script Python
import f1Data from '../data/Dutch_Grand_Prix_Weighted.csv'; 

// Importa la funzione di disegno dello scatterplot
import { drawScatterPlot } from './Scatterplot.js';

import { drawSectorBarChart } from './SectorBarChart.js';

console.log('Dati caricati dal CSV:', f1Data);

// Inizializza il Bar Chart con tutti i dati all'avvio
drawSectorBarChart(f1Data, "#bar-chart-container");

// Disegna lo Scatterplot passando la funzione di callback per il brush
drawScatterPlot(f1Data, "#scatterplot-container", (selectedData) => {
    // Ogni volta che "spennelli" (brush) dei punti, il Bar Chart si aggiorna!
    drawSectorBarChart(selectedData, "#bar-chart-container");
});