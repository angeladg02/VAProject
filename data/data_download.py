import fastf1
import pandas as pd
import os

# 1. Configurazione Cache (FONDAMENTALE)
if not os.path.exists('cache'):
    os.makedirs('cache')
fastf1.Cache.enable_cache('cache') 

def get_full_season_data(year=2025):
    """
    Scarica i dati di gara (Race) per l'anno specificato.
    Include Telemetria di base (SpeedST), Meteo e Posizione.
    """
    
    # Ottieni il calendario
    try:
        schedule = fastf1.get_event_schedule(year)
    except Exception as e:
        print(f"Errore nel scaricare il calendario: {e}")
        return pd.DataFrame()
    
    # Filtra solo le gare ufficiali
    official_races = schedule[schedule['EventFormat'] != 'testing']
    
    all_races_data = []

    print(f"--- INIZIO DOWNLOAD STAGIONE {year} ---")

    for i, event in official_races.iterrows():
        round_num = event['RoundNumber']
        country = event['Country']
        event_name = event['EventName']
        
        # Saltiamo le gare future (se stiamo eseguendo oggi per testare)
        # Se stai simulando il 2025 "nel futuro", rimuovi questo controllo se necessario
        # ma fastf1 darà errore se la gara non è avvenuta.
        
        print(f"\nProcessing Round {round_num}: {event_name} ({country})")
        
        try:
            # Carica la sessione di Gara ('R')
            session = fastf1.get_session(year, round_num, 'R')
            
            # Carica i dati: laps=True (tempi), weather=True (meteo)
            # Nota: telemetry=False perché SpeedST è già dentro 'laps'
            session.load(laps=True, weather=True, telemetry=False, messages=False)
            
            laps = session.laps
            
            if laps.empty:
                print(f"   -> Nessun dato giri disponibile (Gara non disputata?)")
                continue

            # --- SELEZIONE COLONNE (AGGIORNATA) ---
            # Definiamo le colonne che VOGLIAMO
            cols_to_keep = [
                'Driver', 'Team', 'LapNumber', 'LapTime', 'LapStartTime', 
                'Sector1Time', 'Sector2Time', 'Sector3Time', 
                'Compound', 'TyreLife', 'FreshTyre', 'Stint', 'IsPersonalBest',
                # NUOVE COLONNE AGGIUNTE:
                'SpeedST',      # Speed Trap (Velocità massima)
                'IsAccurate',   # Fondamentale per pulire i dati PCA
                'Position',     # Posizione in gara
                'TrackStatus'   # Status pista (1=Verde, 4=SC, etc.)
            ]
            
            # Prendiamo solo quelle che esistono davvero nel dataset (per evitare errori)
            existing_cols = [c for c in cols_to_keep if c in laps.columns]
            laps_subset = laps[existing_cols].copy()

            # Aggiungi info gara
            laps_subset['RoundNumber'] = round_num
            laps_subset['EventName'] = event_name
            laps_subset['Country'] = country
            laps_subset['Year'] = year

            # --- MERGE METEO ---
            weather = session.weather_data
            
            # Converti i tempi per il merge
            laps_subset['LapStartTime'] = pd.to_timedelta(laps_subset['LapStartTime'])
            weather['Time'] = pd.to_timedelta(weather['Time'])

            # Merge asof (nearest time)
            merged_data = pd.merge_asof(
                laps_subset.sort_values('LapStartTime'),
                weather[['Time', 'AirTemp', 'TrackTemp', 'Humidity', 'Rainfall', 'WindSpeed', 'WindDirection']],
                left_on='LapStartTime',
                right_on='Time',
                direction='nearest'
            )

            # Converti LapTime in secondi (float) per i grafici
            if 'LapTime' in merged_data.columns:
                merged_data['LapTime_Sec'] = merged_data['LapTime'].dt.total_seconds()
            
            # Gestione colonne settori (converto in secondi se esistono)
            for col in ['Sector1Time', 'Sector2Time', 'Sector3Time']:
                if col in merged_data.columns:
                    merged_data[f'{col}_Sec'] = pd.to_timedelta(merged_data[col]).dt.total_seconds()

            all_races_data.append(merged_data)
            print(f"   -> OK: {len(merged_data)} giri scaricati.")

        except Exception as e:
            print(f"   -> ERRORE: {e}")

    # Concatena tutto
    if all_races_data:
        final_df = pd.concat(all_races_data, ignore_index=True)
        return final_df
    else:
        return pd.DataFrame()

# --- ESECUZIONE ---
if __name__ == "__main__":
    # Se vuoi testare con dati reali ORA, usa year=2024
    # Se stai simulando il progetto futuro, usa year=2025
    ANNO_DA_SCARICARE = 2025 
    
    df_result = get_full_season_data(ANNO_DA_SCARICARE)
    
    if not df_result.empty:
        filename = f"f1_{ANNO_DA_SCARICARE}_full_data_v2.csv"
        df_result.to_csv(filename, index=False)
        
        print("\n" + "="*40)
        print(f"DOWNLOAD COMPLETATO!")
        print(f"File salvato: {filename}")
        print(f"Dimensioni: {df_result.shape[0]} righe x {df_result.shape[1]} colonne")
        
        # Calcolo rapido Indice AS
        as_index = df_result.shape[0] * df_result.shape[1]
        print(f"Indice AS Totale: {as_index}")
        print("="*40)
    else:
        print("\nNessun dato trovato. Controlla l'anno o la connessione.")