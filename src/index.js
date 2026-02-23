// Importa lo stile (se hai creato la cartella styles come detto prima, altrimenti lascia './index.scss')
import 'index.scss'; 

// Importa i dati processati col tuo script Python
import f1Data from '../data/Spanish_Grand_Prix.csv'; 

// Importa la funzione di disegno dello scatterplot
import { drawScatterPlot } from './Scatterplot.js';

console.log('Dati caricati dal CSV:', f1Data);

// Esegui la funzione puntando al div #root
if (f1Data && f1Data.length > 0) {
    drawScatterPlot(f1Data, "#root"); 
} else {
    console.error("Errore: nessun dato caricato o array vuoto.");
}